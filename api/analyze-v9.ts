// FILE: api/analyze.ts
// HYDRA v9.0 - Slim Analysis Handler
// Evidence-based pipeline: IDENTIFY → FETCH → REASON → VALIDATE
// Reduced from 866 lines to ~200 lines — orchestration only
//
// CHANGELOG:
// v6.3: AI category passed to detectItemCategory
// v6.4: originalImageUrls for marketplace
// v6.5: HYDRA blended price (was ignoring market data)
// v6.6: Aggressive market weighting
// v7.5: eBay data in response
// v8.0: Provider benchmark tracking
// v8.1: Scanner barcode passthrough (additionalContext)
// v8.2: Barcode Spider cascade + Kroger retail pricing
// v9.0: Evidence-based pipeline — AIs reason WITH market data, not blind
// v9.0.1: Barcode passthrough wired into pipeline (was missing from v9.0)

import type { VercelRequest, VercelResponse } from '@vercel/node';

// v9.0: Pipeline orchestrator replaces manual stage management
import { runPipeline } from '../src/lib/hydra/pipeline/index.js';

// Self-heal: dynamic weights from benchmark data
import { getDynamicWeights } from '../src/lib/hydra/self-heal/index.js';

// Response formatting + storage (unchanged)
import {
  formatAnalysisResponse,
  formatAPIResponse,
  formatErrorResponse,
  saveAnalysisAsync,
  isSupabaseAvailable,
} from '../src/lib/hydra/index.js';

// =============================================================================
// CONFIG
// =============================================================================

export const config = {
  maxDuration: 60,
};

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

interface AnalyzeRequest {
  itemName: string;
  imageBase64?: string;
  additionalImages?: string[];
  userId?: string;
  analysisId?: string;
  categoryHint?: string;
  condition?: string;
  originalImageUrls?: string[];
  // v8.1+: Raw barcodes from device scanner (react-zxing reads all 12/13 digits)
  // These are MORE accurate than AI vision barcode reading (which truncates)
  scannedBarcodes?: string[];
}

interface MultiModalItem {
  type: 'photo' | 'video' | 'document' | 'certificate';
  name: string;
  data: string;
  originalUrl?: string;
  additionalFrames?: string[];
  metadata?: {
    documentType?: string;
    description?: string;
    extractedText?: string;
    barcodes?: string[];
  };
}

function validateRequest(body: unknown): AnalyzeRequest {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const rawBody = body as Record<string, unknown>;

  // ==========================================================================
  // HANDLE MULTI-MODAL FORMAT (from DualScanner)
  // ==========================================================================
  if (rawBody.items && Array.isArray(rawBody.items) && rawBody.items.length > 0) {
    const items = rawBody.items as MultiModalItem[];
    const primaryItem = items[0];

    // Extract primary image
    let imageBase64: string | undefined;
    if (primaryItem.data) {
      imageBase64 = primaryItem.data.includes('base64,')
        ? primaryItem.data.split('base64,')[1]
        : primaryItem.data;
    }

    // Collect additional images from other items and video frames
    const additionalImages: string[] = [];
    if (primaryItem.additionalFrames) {
      primaryItem.additionalFrames.forEach(frame => {
        additionalImages.push(frame.includes('base64,') ? frame.split('base64,')[1] : frame);
      });
    }
    items.slice(1).forEach(item => {
      if (item.data) {
        additionalImages.push(item.data.includes('base64,') ? item.data.split('base64,')[1] : item.data);
      }
    });

    // Collect original image URLs for marketplace listings
    const originalImageUrls: string[] = [];
    items.forEach(item => {
      if (item.originalUrl && !item.originalUrl.startsWith('blob:')) {
        originalImageUrls.push(item.originalUrl);
      }
    });
    if (Array.isArray(rawBody.originalImageUrls)) {
      (rawBody.originalImageUrls as string[]).forEach(url => {
        if (url && !url.startsWith('blob:') && !originalImageUrls.includes(url)) {
          originalImageUrls.push(url);
        }
      });
    }

    // ========================================================================
    // FIXED v8.1/v9.0.1: Extract raw barcodes from device scanner
    // The device's barcode scanner (react-zxing) reads all 12/13 digits perfectly.
    // AI vision often truncates barcode numbers when reading from images.
    // DualScanner sends barcodes via: items[].metadata.barcodes[]
    // ========================================================================
    const scannedBarcodes: string[] = [];
    items.forEach(item => {
      if (item.metadata?.barcodes && Array.isArray(item.metadata.barcodes)) {
        item.metadata.barcodes.forEach(bc => {
          if (bc && typeof bc === 'string' && bc.length >= 8 && !scannedBarcodes.includes(bc)) {
            scannedBarcodes.push(bc);
          }
        });
      }
    });

    if (scannedBarcodes.length > 0) {
      console.log(`📊 Scanner barcodes extracted: ${scannedBarcodes.join(', ')}`);
    }

    // Extract item name
    let itemName = '';
    if (primaryItem.name && !primaryItem.name.startsWith('Photo ') && !primaryItem.name.startsWith('Video ')) {
      itemName = primaryItem.name;
    } else if (primaryItem.metadata?.description) {
      itemName = primaryItem.metadata.description;
    } else if (primaryItem.metadata?.extractedText) {
      itemName = primaryItem.metadata.extractedText.substring(0, 50).trim();
    }

    const categoryHint = (rawBody.subcategory_id as string) || (rawBody.category_id as string) || undefined;

    return {
      itemName,
      imageBase64,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
      userId: typeof rawBody.userId === 'string' ? rawBody.userId : undefined,
      analysisId: typeof rawBody.analysisId === 'string' ? rawBody.analysisId : `analysis_${Date.now()}`,
      categoryHint: categoryHint !== 'general' ? categoryHint : undefined,
      condition: typeof rawBody.condition === 'string' ? rawBody.condition : 'good',
      originalImageUrls: originalImageUrls.length > 0 ? originalImageUrls : undefined,
      scannedBarcodes: scannedBarcodes.length > 0 ? scannedBarcodes : undefined,
    };
  }

  // ==========================================================================
  // HANDLE STANDARD FORMAT
  // ==========================================================================
  const { itemName, imageBase64, userId, analysisId, categoryHint, condition, originalImageUrls } = rawBody;

  return {
    itemName: typeof itemName === 'string' ? itemName.trim() : '',
    imageBase64: typeof imageBase64 === 'string' ? imageBase64 : undefined,
    userId: typeof userId === 'string' ? userId : undefined,
    analysisId: typeof analysisId === 'string' ? analysisId : `analysis_${Date.now()}`,
    categoryHint: typeof categoryHint === 'string' ? categoryHint : undefined,
    condition: typeof condition === 'string' ? condition : 'good',
    originalImageUrls: Array.isArray(originalImageUrls) ? originalImageUrls.filter((u): u is string => typeof u === 'string' && !u.startsWith('blob:')) : undefined,
    // Standard format doesn't send barcodes — only DualScanner multi-modal does
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  let analysisId = '';

  try {
    // 1. Validate request
    const request = validateRequest(req.body);
    analysisId = request.analysisId!;

    const hasImage = !!request.imageBase64;
    const hasItemName = request.itemName.length > 0;

    if (!hasImage && !hasItemName) {
      throw new Error('Either an image or item name is required');
    }

    console.log(`\n🔥 === HYDRA v9.0 ANALYSIS START ===`);
    console.log(`📦 Item: "${request.itemName || '(will identify from image)'}"`);
    console.log(`🆔 ID: ${analysisId}`);
    console.log(`🖼️ Images: ${hasImage ? 1 + (request.additionalImages?.length || 0) : 0}`);
    if (request.scannedBarcodes?.length) {
      console.log(`📊 Scanner barcodes: ${request.scannedBarcodes.join(', ')}`);
    }

    // 2. Build images array
    const images: string[] = [];
    if (request.imageBase64) images.push(request.imageBase64);
    if (request.additionalImages) images.push(...request.additionalImages.slice(0, 3));

    // ========================================================================
    // 3. Build additionalContext from scanner barcodes
    // FIXED v9.0.1: This was MISSING in the original v9.0 file.
    // The device scanner reads perfect 12/13-digit barcodes via react-zxing.
    // We pass them as "UPC: <digits>" so fetchers (upcitemdb → barcode spider
    // cascade, kroger) can use the REAL barcode instead of AI-truncated ones.
    // ========================================================================
    let additionalContext: string | undefined;
    if (request.scannedBarcodes && request.scannedBarcodes.length > 0) {
      // Pass first barcode as primary UPC context
      // Format: "UPC: 053538155504" — matches extractBarcodeFromContext() in upcitemdb.ts
      additionalContext = `UPC: ${request.scannedBarcodes[0]}`;
      console.log(`🔗 Barcode context for fetchers: "${additionalContext}"`);
    }

    // 4. Get dynamic weights from self-heal (non-blocking, cached)
    const dynamicWeights = await getDynamicWeights().catch(() => null);

    // 5. Run the evidence-based pipeline
    const pipelineResult = await runPipeline(images, request.itemName, {
      categoryHint: request.categoryHint,
      condition: request.condition,
      additionalContext,  // ← v9.0.1: Scanner barcodes now reach fetchers
      analysisId,
      hasImage,
      dynamicWeights: dynamicWeights || undefined,
    });

    // 6. Format response (using existing formatter for backward compatibility)
    const processingTime = Date.now() - startTime;

    const blendedPrice = {
      finalPrice: pipelineResult.finalPrice,
      method: pipelineResult.priceMethod,
      confidence: pipelineResult.confidence,
      range: pipelineResult.priceRange,
      sources: pipelineResult.marketSources.map((s: any) => ({
        source: s.source,
        value: s.priceAnalysis?.median || 0,
        weight: s.hasAuthorityData ? 1.5 : 1.0,
      })),
      authorityVerified: !!pipelineResult.authorityData,
    };

    // Build consensus-compatible object for formatter
    const consensusCompat = {
      itemName: pipelineResult.itemName,
      decision: pipelineResult.decision,
      estimatedValue: pipelineResult.finalPrice,
      confidence: pipelineResult.confidence,
      analysisQuality: pipelineResult.analysisQuality,
      reasoning: pipelineResult.stages.reason.consensus.reasoning,
      votes: pipelineResult.allVotes,
    };

    const response = formatAnalysisResponse(
      analysisId,
      consensusCompat,
      pipelineResult.category,
      blendedPrice,
      pipelineResult.authorityData,
      processingTime
    );

    const responseWithExtras = {
      ...response,
      imageUrls: request.originalImageUrls || [],
      thumbnailUrl: request.originalImageUrls?.[0] || null,
      ebayMarketData: pipelineResult.ebayData,
      marketSources: pipelineResult.marketSources,
      // v9.0: Pipeline timing data
      pipelineVersion: '9.0',
      pipelineTiming: pipelineResult.timing,
      _debug: {
        ebayListings: pipelineResult.ebayData?.totalListings || 0,
        ebayMedian: pipelineResult.ebayData?.priceAnalysis?.median || null,
        marketSourceCount: pipelineResult.marketSources.length,
        primaryAuthority: pipelineResult.authorityData?.source || null,
        barcodeSource: request.scannedBarcodes?.length ? 'scanner' : 'ai_vision',
        scannedBarcodes: request.scannedBarcodes || [],
        stages: {
          identify: `${pipelineResult.timing.identify}ms`,
          fetch: `${pipelineResult.timing.fetch}ms`,
          reason: `${pipelineResult.timing.reason}ms`,
          validate: `${pipelineResult.timing.validate}ms`,
        },
        dynamicWeightsActive: !!dynamicWeights,
      },
    };

    // 7. Save to Supabase (non-blocking)
    if (isSupabaseAvailable()) {
      saveAnalysisAsync(
        analysisId,
        consensusCompat,
        pipelineResult.category,
        request.userId,
        pipelineResult.allVotes,
        pipelineResult.authorityData,
        processingTime,
        request.originalImageUrls
      );
    }

    console.log(`\n  ✅ Complete in ${processingTime}ms\n`);

    return res.status(200).json(formatAPIResponse(responseWithExtras));

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    return res.status(500).json(formatErrorResponse(error, analysisId));
  }
}