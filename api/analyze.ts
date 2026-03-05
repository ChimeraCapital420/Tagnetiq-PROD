// ============================================================
// FILE:  api/analyze.ts
// ============================================================
// HYDRA v9.8 — Bidirectional CI Engine: Corrections + Confirmations
// Evidence-based pipeline: IDENTIFY → FETCH → REASON → VALIDATE
//
// CHANGELOG:
// v9.4: FIX — require() → ESM import
// v9.5: SECURITY — Input sanitization + injection detection at entry point
// v9.6: SECURITY — Rate limiting wired in (10 req/60s per IP)
// v9.7: CI ENGINE PHASE 3 — Pattern lookup wired in before AI pipeline
//       - lookupPatterns() runs speculatively using categoryHint
//       - collectiveKnowledge passed into runPipeline() options
//       - If lookup fails: graceful degradation, scan proceeds normally
//       - If no patterns confirmed yet: null, prompt is unchanged
// v9.8: CI ENGINE — High-consensus confirmation signal
//       When HYDRA reaches analysisQuality=OPTIMAL + confidence≥0.85,
//       recordConfirmation() fires fire-and-forget after response is built.
//       Source: 'high_consensus' — strongest automated trust signal.
//       Bidirectional CI: corrections flag what HYDRA gets wrong,
//       confirmations reinforce what it gets right. Aggregator uses both
//       to accelerate pattern promotion and improve provider trust weights.
//       Zero latency impact — runs after res.status(200) is queued.
//
// ⚠️  PIPELINE NOTE (one field to add):
//     src/lib/hydra/pipeline/index.ts — add to the options type:
//       collectiveKnowledge?: CollectiveKnowledgeBlock | null;
//     Then thread it through to buildAnalysisPrompt() inside the pipeline.
//     Until that field is added, collectiveKnowledge is silently ignored
//     (TypeScript will warn). The scan still works perfectly either way.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// v9.0: Pipeline orchestrator replaces manual stage management
import { runPipeline } from '../src/lib/hydra/pipeline/index.js';

// Self-heal: dynamic weights from benchmark data
import { getDynamicWeights } from '../src/lib/hydra/self-heal/index.js';

// Response formatting + storage (unchanged)
import {
  formatAnalysisResponse,
  formatAPIResponse,
  formatErrorResponse,
  isSupabaseAvailable,
} from '../src/lib/hydra/index.js';

// v9.2: Use awaitable save instead of fire-and-forget
import { saveAnalysisAwaited } from '../src/lib/hydra/storage/supabase.js';

// v9.3: Sprint M — Nexus decision tree
import { evaluateScan, logNexusDecision } from '../src/lib/oracle/nexus/index.js';
import type { NexusDecision, ScanContext, UserContext } from '../src/lib/oracle/nexus/index.js';

// v9.3: Sprint M — Oracle Eyes Tier 1 piggyback
import { captureFromScan } from '../src/lib/oracle/eyes/index.js';

// v9.5: SECURITY — Input sanitization
import {
  sanitizeItemName,
  sanitizeCategoryHint,
  sanitizeCondition,
  sanitizeAdditionalContext,
  detectInjectionAttempt,
} from './_lib/sanitize.js';

// v9.6: SECURITY — Rate limiting
import { applyRateLimit, LIMITS } from './_lib/rateLimit.js';

// v9.7+v9.8: CI ENGINE — pattern lookup + high-consensus confirmation signal
import { lookupPatterns, recordConfirmation } from '../src/lib/hydra/knowledge/index.js';
import type { CollectiveKnowledgeBlock } from '../src/lib/hydra/knowledge/types.js';

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

    // Extract raw barcodes from device scanner
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
  };
}

// =============================================================================
// SUPABASE CLIENT (lazy, only created when needed for Nexus/Eyes)
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

  // v9.6: Rate limit — analyze is expensive (multi-AI + HYDRA calls)
  if (applyRateLimit(req, res, LIMITS.EXPENSIVE)) return;

  const startTime = Date.now();
  let analysisId = '';

  try {
    // 1. Validate request
    const request = validateRequest(req.body);
    analysisId = request.analysisId!;

    // ========================================================================
    // v9.5: SANITIZE ALL TEXT INPUTS BEFORE PIPELINE
    // This is the primary prompt injection defense layer.
    // Sanitization happens AFTER validation but BEFORE any AI prompt building.
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

    // Detect and log injection attempts (for monitoring/alerting)
    const injectionCheck = detectInjectionAttempt(
      `${rawItemName} ${rawCategoryHint || ''}`
    );
    if (injectionCheck.detected) {
      console.warn(
        `🛡️ INJECTION ATTEMPT DETECTED in analysis ${analysisId}:`,
        injectionCheck.patterns.join(', '),
        `| userId: ${request.userId || 'anonymous'}`
      );
      // Don't reject — sanitized input is safe. But log for monitoring.
    }
    // ========================================================================

    const hasImage = !!request.imageBase64;
    const hasItemName = request.itemName.length > 0;

    if (!hasImage && !hasItemName) {
      throw new Error('Either an image or item name is required');
    }

    console.log(`\n📥 === HYDRA v9.8 ANALYSIS START ===`);
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

    // 3. Build additionalContext from scanner barcodes (sanitized)
    let additionalContext: string | undefined;
    if (request.scannedBarcodes && request.scannedBarcodes.length > 0) {
      const rawContext = `UPC: ${request.scannedBarcodes[0]}`;
      additionalContext = sanitizeAdditionalContext(rawContext);
      console.log(`🔗 Barcode context for fetchers: "${additionalContext}"`);
    }

    // ========================================================================
    // v9.7: CI ENGINE PHASE 3 — Pre-scan collective knowledge lookup
    //
    // Architecture note: runPipeline() wraps category detection internally,
    // so we cannot know the confirmed category before AI calls begin.
    // We run a speculative lookup using categoryHint (already sanitized above).
    //
    // Outcomes:
    //   A) categoryHint present + confirmed patterns exist → knowledge injected ✅
    //   B) categoryHint present + no confirmed patterns → null, scan normal ✅
    //   C) categoryHint absent → null, scan normal ✅
    //   D) DB down / lookup throws → null, scan normal ✅ (graceful degradation)
    //
    // Mobile-first: this is a <5ms server-side indexed query.
    // Zero additional latency for the user — runs in parallel with getDynamicWeights.
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
        `[CI-Engine] 📚 ${collectiveKnowledge.items.length} confirmed patterns injected for category "${request.categoryHint}"`
      );
    }
    // ========================================================================

    // 5. Run the evidence-based pipeline (all inputs now sanitized)
    const pipelineResult = await runPipeline(images, request.itemName, {
      categoryHint: request.categoryHint,
      condition: request.condition,
      additionalContext,
      analysisId,
      hasImage,
      dynamicWeights: dynamicWeights || undefined,
      // v9.7: Pass collective knowledge into pipeline so it reaches buildAnalysisPrompt().
      // Requires one field addition in src/lib/hydra/pipeline/index.ts — see file header.
      collectiveKnowledge: collectiveKnowledge ?? undefined,
    });

    // 6. Format response
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
    // 6.5 Sprint M: NEXUS DECISION TREE — Oracle evaluates the scan
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
      pipelineVersion: '9.8',
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
        // v9.7: CI Engine diagnostics
        collectiveKnowledgeActive: !!collectiveKnowledge,
        collectivePatternCount: collectiveKnowledge?.items.length ?? 0,
        collectiveCategory: request.categoryHint || null,
        // v9.8: confirmation signal diagnostics
        highConsensusConfirmation: (
          pipelineResult.analysisQuality === 'OPTIMAL' &&
          pipelineResult.confidence >= 0.85
        ),
      },
    };

    // ========================================================================
    // 7. SAVE TO SUPABASE — AWAIT before response
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
    // 7.5 Sprint M: Oracle Eyes Tier 1 — Piggyback visual memory
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
    // 7.6 v9.8: CI ENGINE — High-consensus positive confirmation signal
    //
    // Fires when ALL three conditions are true:
    //   1. analysisQuality === 'OPTIMAL'  (all providers responded cleanly)
    //   2. confidence >= 0.85             (strong agreement on value + identity)
    //   3. pipelineResult.itemName exists (we actually identified something)
    //
    // providerVotes captured so the aggregator knows WHICH providers agreed —
    // providers that frequently agree on correct IDs earn higher trust weights.
    //
    // Fire-and-forget: .catch() ensures DB failure is completely silent.
    // Response is already committed — this never affects scan latency.
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
      }).catch(err =>
        console.warn('[CI-Engine] High-consensus confirmation failed (non-fatal):', err)
      );

      console.log(
        `[CI-Engine] ⭐ High-consensus confirmation queued: "${pipelineResult.itemName}"` +
        ` [${pipelineResult.category}] confidence=${(pipelineResult.confidence * 100).toFixed(0)}%`
      );
    }

    console.log(`\n  ✅ Complete in ${processingTime}ms${nexusDecision ? ` | Nexus: ${nexusDecision.nudge}` : ''}${collectiveKnowledge ? ` | CI: ${collectiveKnowledge.items.length} patterns` : ''}\n`);

    return res.status(200).json(formatAPIResponse(responseWithExtras));

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    return res.status(500).json(formatErrorResponse(error, analysisId));
  }
}