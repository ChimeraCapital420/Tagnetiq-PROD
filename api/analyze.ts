// ============================================================
// FILE:  api/analyze.ts
// ============================================================
// HYDRA v9.9 — RH-027 Low-consensus disagreement recording
// RH-032 — Luxury brand detection + authentication prompt
//
// CHANGELOG:
// v9.4: FIX — require() → ESM import
// v9.5: SECURITY — Input sanitization + injection detection
// v9.6: SECURITY — Rate limiting (10 req/60s per IP)
// v9.7: CI ENGINE PHASE 3 — Pattern lookup before AI pipeline
// v9.8: CI ENGINE — High-consensus confirmation signal (bidirectional)
// v9.8.1: imageHash wired into recordConfirmation()
// v9.9: RH-027 — Low-consensus disagreement recording wired.
//   recordDisagreement() fires when confidence < 0.65.
//   Fills the CI Engine gap: corrections + confirmations + disagreements.
//   The three signals together give the aggregator a complete picture.
// v9.9.1: RH-032 — Luxury brand detection wired.
//   detectLuxuryBrand() checks itemName against 50+ brand router entries.
//   Returns luxuryAuthentication block in response when luxury brand detected.
//   Frontend checks luxuryAuthentication.isLuxury → shows Authenticate button.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

import { runPipeline } from '../src/lib/hydra/pipeline/index.js';
import { getDynamicWeights } from '../src/lib/hydra/self-heal/index.js';
import {
  formatAnalysisResponse,
  formatAPIResponse,
  formatErrorResponse,
  isSupabaseAvailable,
} from '../src/lib/hydra/index.js';
import { saveAnalysisAwaited } from '../src/lib/hydra/storage/supabase.js';
import { evaluateScan, logNexusDecision } from '../src/lib/oracle/nexus/index.js';
import type { NexusDecision, ScanContext, UserContext } from '../src/lib/oracle/nexus/index.js';
import { captureFromScan } from '../src/lib/oracle/eyes/index.js';
import {
  sanitizeItemName,
  sanitizeCategoryHint,
  sanitizeCondition,
  sanitizeAdditionalContext,
  detectInjectionAttempt,
} from './_lib/sanitize.js';
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';
import { lookupPatterns, recordConfirmation, recordDisagreement } from '../src/lib/hydra/knowledge/index.js';
import type { CollectiveKnowledgeBlock } from '../src/lib/hydra/knowledge/types.js';
// RH-032: Luxury brand detection from affiliate engine brand router
import { detectLuxuryBrand } from '../src/lib/affiliate/affiliate-engine.js';

// =============================================================================
// CONFIG
// =============================================================================

export const config = {
  maxDuration: 60,
};

// =============================================================================
// RH-032: LUXURY AUTHENTICATION BLOCK BUILDER
// Returns null for non-luxury items — zero impact on non-luxury scans
// =============================================================================

function buildLuxuryAuthBlock(itemName: string) {
  if (!itemName) return null;
  const brandConfig = detectLuxuryBrand(itemName);
  if (!brandConfig) return null;

  const nfcInstructions: Record<string, string> = {
    'Louis Vuitton':       'Hold phone flat against interior lining near the serial tab. Move slowly until vibration.',
    'Christian Dior':      'Hold phone against interior near the label or lining.',
    'Gucci':               'Look for a small black fabric loop inside the bag. Hold phone directly to that loop.',
    'Prada':               'Check the interior brand label area — NFC integrated into label.',
    'Moncler':             'Check the logo patch on chest or arm, and the interior label.',
    'Salvatore Ferragamo': 'Remove insole if possible — chip is embedded in the heel area.',
    'Fendi':               'Hold phone against interior lining, scanning slowly across the full interior.',
    'Saint Laurent':       'Check interior of bags near side seam or interior label.',
    'Balenciaga':          'Scan near interior label and seam areas.',
    'Burberry':            'Check interior label and near the main seams.',
    'Bottega Veneta':      'Hold phone flat against interior lining and move slowly.',
    'Miu Miu':             'Check interior label area — NFC integrated into label.',
  };

  return {
    isLuxury:               true,
    brandName:              brandConfig.displayName,
    category:               brandConfig.category,
    priceRange:             brandConfig.priceRange,
    authenticationRequired: true,
    nfcCapable:             brandConfig.hasNFC,
    nfcSince:               brandConfig.nfcSince || null,
    authPrompt:             `This appears to be ${brandConfig.displayName}. Tap "Authenticate" to verify authenticity before buying.`,
    authUrgency:            brandConfig.priceRange === 'ultra_luxury' ? 'high' : 'medium',
    resalePlatforms:        brandConfig.resalePlatforms,
    nfcGuidance: brandConfig.hasNFC ? {
      hasChip:          true,
      chipSince:        brandConfig.nfcSince,
      scanInstruction:  nfcInstructions[brandConfig.displayName] || 'Hold phone flat against interior lining and move slowly.',
      doubleTestApplies: true,
      doubleTestExplain: 'Scan twice — if chip ID is identical both times, it is likely a counterfeit clone chip.',
    } : {
      hasChip:        false,
      alternateCheck: 'Use visual authentication — check stitching, hardware stamps, and date code format.',
    },
  };
}

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

    let imageBase64: string | undefined;
    if (primaryItem.data) {
      imageBase64 = primaryItem.data.includes('base64,')
        ? primaryItem.data.split('base64,')[1]
        : primaryItem.data;
    }

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
    originalImageUrls: Array.isArray(originalImageUrls)
      ? originalImageUrls.filter((u): u is string => typeof u === 'string' && !u.startsWith('blob:'))
      : undefined,
  };
}

// =============================================================================
// SUPABASE CLIENT (lazy)
// =============================================================================

let _supabaseAdmin: any = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _supabaseAdmin;
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

  if (applyRateLimit(req, res, LIMITS.EXPENSIVE)) return;

  const startTime = Date.now();
  let analysisId = '';

  try {
    const request = validateRequest(req.body);
    analysisId = request.analysisId!;

    // ========================================================================
    // v9.5: SANITIZE ALL TEXT INPUTS
    // ========================================================================
    const rawItemName = request.itemName;
    const rawCategoryHint = request.categoryHint;

    request.itemName = sanitizeItemName(request.itemName);
    request.categoryHint = request.categoryHint
      ? sanitizeCategoryHint(request.categoryHint)
      : undefined;
    request.condition = request.condition
      ? sanitizeCondition(request.condition)
      : 'good';

    const injectionCheck = detectInjectionAttempt(
      `${rawItemName} ${rawCategoryHint || ''}`
    );
    if (injectionCheck.detected) {
      console.warn(
        `🛡️ INJECTION ATTEMPT DETECTED in analysis ${analysisId}:`,
        injectionCheck.patterns.join(', '),
        `| userId: ${request.userId || 'anonymous'}`
      );
    }
    // ========================================================================

    const hasImage = !!request.imageBase64;
    const hasItemName = request.itemName.length > 0;

    if (!hasImage && !hasItemName) {
      throw new Error('Either an image or item name is required');
    }

    console.log(`\n📥 === HYDRA v9.9.1 ANALYSIS START ===`);
    console.log(`📦 Item: "${request.itemName || '(will identify from image)'}"`);
    console.log(`🆔 ID: ${analysisId}`);
    console.log(`🖼️ Images: ${hasImage ? 1 + (request.additionalImages?.length || 0) : 0}`);
    if (request.scannedBarcodes?.length) {
      console.log(`📊 Scanner barcodes: ${request.scannedBarcodes.join(', ')}`);
    }

    const images: string[] = [];
    if (request.imageBase64) images.push(request.imageBase64);
    if (request.additionalImages) images.push(...request.additionalImages.slice(0, 3));

    let additionalContext: string | undefined;
    if (request.scannedBarcodes && request.scannedBarcodes.length > 0) {
      const rawContext = `UPC: ${request.scannedBarcodes[0]}`;
      additionalContext = sanitizeAdditionalContext(rawContext);
      console.log(`🔗 Barcode context: "${additionalContext}"`);
    }

    // ========================================================================
    // v9.7: CI ENGINE — Pre-scan collective knowledge lookup
    // ========================================================================
    const [dynamicWeights, collectiveKnowledge] = await Promise.all([
      getDynamicWeights().catch(() => null),
      request.categoryHint
        ? lookupPatterns(request.categoryHint).catch(err => {
            console.warn(`[CI-Engine] Pre-scan lookup failed (non-fatal): ${err.message}`);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (collectiveKnowledge) {
      console.log(
        `[CI-Engine] 📚 ${collectiveKnowledge.items.length} confirmed patterns injected for "${request.categoryHint}"`
      );
    }
    // ========================================================================

    const pipelineResult = await runPipeline(images, request.itemName, {
      categoryHint: request.categoryHint,
      condition: request.condition,
      additionalContext,
      analysisId,
      hasImage,
      dynamicWeights: dynamicWeights || undefined,
      collectiveKnowledge: collectiveKnowledge ?? undefined,
    });

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

    // ========================================================================
    // Sprint M: NEXUS DECISION TREE
    // ========================================================================
    let nexusDecision: NexusDecision | null = null;

    try {
      const supaAdmin = getSupabaseAdmin();

      const scanCtx: ScanContext = {
        itemName: pipelineResult.itemName,
        estimatedValue: pipelineResult.finalPrice,
        confidence: pipelineResult.confidence,
        category: pipelineResult.category,
        condition: request.condition,
        decision: pipelineResult.decision,
        authorityData: pipelineResult.authorityData,
        ebayData: pipelineResult.ebayData,
        marketSources: pipelineResult.marketSources,
        priceRange: pipelineResult.priceRange,
      };

      let userCtx: UserContext = {
        userId: request.userId || 'anonymous',
        vaultItemCount: 0,
        scanCount: 0,
        favoriteCategories: [],
        hasListedBefore: false,
        tier: 'free',
      };

      if (request.userId && supaAdmin) {
        const [vaultCount, scanCount, listingCheck] = await Promise.all([
          supaAdmin.from('vault_items').select('id', { count: 'exact', head: true }).eq('user_id', request.userId),
          supaAdmin.from('analysis_history').select('id', { count: 'exact', head: true }).eq('user_id', request.userId),
          supaAdmin.from('arena_listings').select('id').eq('seller_id', request.userId).limit(1),
        ]);

        userCtx = {
          userId: request.userId,
          vaultItemCount: vaultCount.count || 0,
          scanCount: scanCount.count || 0,
          favoriteCategories: [],
          hasListedBefore: (listingCheck.data?.length || 0) > 0,
          tier: 'free',
        };
      }

      nexusDecision = evaluateScan(scanCtx, userCtx);

      if (request.userId && supaAdmin) {
        logNexusDecision(supaAdmin, request.userId, analysisId, nexusDecision).then(() => {}, () => {});
      }
    } catch (nexusErr: any) {
      console.warn('Nexus decision failed (non-fatal):', nexusErr.message);
    }

    const responseWithExtras = {
      ...response,
      imageUrls: request.originalImageUrls || [],
      thumbnailUrl: request.originalImageUrls?.[0] || null,
      ebayMarketData: pipelineResult.ebayData,
      marketSources: pipelineResult.marketSources,
      pipelineVersion: '9.9.1',
      pipelineTiming: pipelineResult.timing,
      nexus: nexusDecision ? {
        nudge: nexusDecision.nudge,
        message: nexusDecision.message,
        marketDemand: nexusDecision.marketDemand,
        confidence: nexusDecision.confidence,
        actions: nexusDecision.actions,
        listingDraft: nexusDecision.listingDraft || null,
        followUp: nexusDecision.followUp || null,
      } : null,
      // RH-032: Luxury authentication block — null for non-luxury items
      luxuryAuthentication: buildLuxuryAuthBlock(pipelineResult.itemName),
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
        nexusNudge: nexusDecision?.nudge || null,
        injectionDetected: injectionCheck.detected,
        collectiveKnowledgeActive: !!collectiveKnowledge,
        collectivePatternCount: collectiveKnowledge?.items.length ?? 0,
        collectiveCategory: request.categoryHint || null,
        highConsensusConfirmation: (
          pipelineResult.analysisQuality === 'OPTIMAL' &&
          pipelineResult.confidence >= 0.85
        ),
        lowConsensusDisagreement: pipelineResult.confidence < 0.65,
        imageHashAvailable: !!(pipelineResult as any).imageHash,
        // RH-032
        luxuryBrandDetected: !!(buildLuxuryAuthBlock(pipelineResult.itemName)),
      },
    };

    // ========================================================================
    // SAVE TO SUPABASE
    // ========================================================================
    if (isSupabaseAvailable()) {
      const saveResult = await saveAnalysisAwaited(
        analysisId,
        consensusCompat,
        pipelineResult.category,
        request.userId,
        pipelineResult.allVotes,
        pipelineResult.authorityData,
        processingTime,
        request.originalImageUrls
      );
      if (!saveResult.success) {
        console.warn(`⚠️ Save incomplete: ${saveResult.error}`);
      }
    }

    // ========================================================================
    // Sprint M: Oracle Eyes Tier 1
    // ========================================================================
    if (request.userId && getSupabaseAdmin()) {
      captureFromScan(
        getSupabaseAdmin(),
        request.userId,
        analysisId,
        {
          itemName: pipelineResult.itemName,
          category: pipelineResult.category,
          allVotes: pipelineResult.allVotes,
          stages: pipelineResult.stages,
        },
        request.originalImageUrls?.[0] || null
      ).then(() => {}, () => {});
    }

    // ========================================================================
    // v9.8: CI ENGINE — High-consensus positive confirmation signal
    // ========================================================================
    if (
      pipelineResult.analysisQuality === 'OPTIMAL' &&
      pipelineResult.confidence >= 0.85 &&
      pipelineResult.itemName
    ) {
      recordConfirmation({
        itemName: pipelineResult.itemName,
        category: pipelineResult.category,
        estimatedValue: pipelineResult.finalPrice,
        confidence: pipelineResult.confidence,
        providerVotes: pipelineResult.allVotes ?? null,
        consensusAgreement: pipelineResult.confidence,
        confirmationSource: 'high_consensus',
        imageHash: (pipelineResult as any).imageHash ?? null,
      }).catch(err =>
        console.warn('[CI-Engine] High-consensus confirmation failed (non-fatal):', err)
      );

      console.log(
        `[CI-Engine] ⭐ High-consensus confirmation queued: "${pipelineResult.itemName}"` +
        ` [${pipelineResult.category}] confidence=${(pipelineResult.confidence * 100).toFixed(0)}%` +
        ((pipelineResult as any).imageHash ? ' | imageHash: ✓' : '')
      );
    }

    // ========================================================================
    // v9.9: CI ENGINE — Low-consensus disagreement signal (RH-027)
    // ========================================================================
    if (
      pipelineResult.confidence < 0.65 &&
      pipelineResult.itemName
    ) {
      recordDisagreement({
        itemName: pipelineResult.itemName,
        category: pipelineResult.category,
        estimatedValue: pipelineResult.finalPrice,
        confidence: pipelineResult.confidence,
        analysisQuality: pipelineResult.analysisQuality,
        providerVotes: pipelineResult.allVotes ?? null,
        imageHash: (pipelineResult as any).imageHash ?? null,
      }).catch(err =>
        console.warn('[CI-Engine] Disagreement record failed (non-fatal):', err)
      );

      console.log(
        `[CI-Engine] ⚡ Low-consensus disagreement queued: "${pipelineResult.itemName}"` +
        ` [${pipelineResult.category}] confidence=${(pipelineResult.confidence * 100).toFixed(0)}%`
      );
    }

    console.log(`\n  ✅ Complete in ${processingTime}ms${nexusDecision ? ` | Nexus: ${nexusDecision.nudge}` : ''}${collectiveKnowledge ? ` | CI: ${collectiveKnowledge.items.length} patterns` : ''}${responseWithExtras.luxuryAuthentication ? ` | 💎 Luxury: ${responseWithExtras.luxuryAuthentication.brandName}` : ''}\n`);

    return res.status(200).json(formatAPIResponse(responseWithExtras));

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    return res.status(500).json(formatErrorResponse(error, analysisId));
  }
}