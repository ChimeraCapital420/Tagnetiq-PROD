// FILE: src/components/analysis/hooks/useAnalysisData.ts
// Safely extracts and normalizes the raw analysis result into typed data.
// Cannot crash on any malformed response.
//
// v10.1 CHANGES:
//   - Extracts ebayMarketData from response (was ignored — user never saw eBay prices)
//   - Extracts marketSources for display
//   - Post-processes valuation_factors: fixes misleading "X% decision agreement"
//     using actual consensus data from hydraConsensus

import { useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { safeString, safeNumber, safeArray } from '../utils/safe-helpers.js';
import { mapConditionToEnum } from '../utils/condition-mapper.js';
import type { NormalizedAnalysis, HistoryContext } from '../types.js';
import type { MarketplaceItem } from '@/components/marketplace/platforms/types';

export function useAnalysisData(): {
  raw: any | null;
  data: NormalizedAnalysis | null;
  history: HistoryContext;
  ebayData: any | null;
  marketSources: any[];
} {
  const {
    lastAnalysisResult,
    currentAnalysisIndex,
    analysisHistory,
  } = useAppContext();

  const isViewingHistory = currentAnalysisIndex !== null;
  const historyItem = isViewingHistory && currentAnalysisIndex !== null && analysisHistory
    ? analysisHistory[currentAnalysisIndex]
    : null;

  // ── Extract eBay market data (top-level field from analyze.ts response) ──
  const ebayData = useMemo(() => {
    if (!lastAnalysisResult) return null;
    return lastAnalysisResult.ebayMarketData || null;
  }, [lastAnalysisResult]);

  // ── Extract market sources ──
  const marketSources = useMemo(() => {
    if (!lastAnalysisResult) return [];
    return safeArray<any>(lastAnalysisResult.marketSources);
  }, [lastAnalysisResult]);

  const data = useMemo<NormalizedAnalysis | null>(() => {
    if (!lastAnalysisResult) return null;

    const r = lastAnalysisResult;

    const id = safeString(r.id);
    const itemName = safeString(r.itemName) || 'Unknown Item';
    const estimatedValue = safeNumber(r.estimatedValue);
    const confidenceScore = safeNumber(r.confidenceScore);
    const summaryReasoning = safeString(r.summary_reasoning);
    const rawFactors = safeArray<string>(r.valuation_factors);
    const imageUrl = safeString(r.imageUrl);
    const imageUrls = safeArray<string>(r.imageUrls);
    const category = safeString(r.category) || 'general';
    const condition = safeString(r.condition) || 'good';

    const hydraConsensus = r.hydraConsensus ?? null;
    const authorityData = r.authorityData ?? null;
    const ghostData = r.ghostData ?? null;
    const nexusData = r.nexus ?? null;

    // ── Fix misleading "X% decision agreement" in valuation factors ──
    // The AI generates these as text factors but calculates them wrong.
    // We replace with actual agreement from the consensus data.
    const valuationFactors = fixAgreementFactors(rawFactors, hydraConsensus);

    // Normalize confidence (some responses return 0-100, some 0-1)
    const confidenceNormalized = confidenceScore > 1 ? confidenceScore / 100 : confidenceScore;

    // Unified image array
    const allImageUrls = imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []);

    // Confidence badge color
    const confidenceColor = confidenceScore > 85
      ? 'bg-green-500'
      : confidenceScore > 65
        ? 'bg-yellow-500'
        : 'bg-red-500';

    // Build marketplace item for ListOnMarketplaceButton
    const marketplaceItem: MarketplaceItem = {
      id: id || `temp_${Date.now()}`,
      challenge_id: id || undefined,
      item_name: itemName,
      asking_price: estimatedValue,
      estimated_value: estimatedValue,
      primary_photo_url: allImageUrls[0] || '',
      additional_photos: allImageUrls.slice(1),
      is_verified: !!authorityData,
      confidence_score: confidenceNormalized,
      title: itemName,
      name: itemName,
      price: estimatedValue,
      estimatedValue,
      description: summaryReasoning || `${itemName} - AI analyzed collectible`,
      category,
      imageUrl: allImageUrls[0] || '',
      image_url: allImageUrls[0] || '',
      imageUrls: allImageUrls,
      images: allImageUrls,
      confidenceScore: confidenceNormalized,
      confidence: confidenceNormalized,
      valuation_factors: valuationFactors,
      tags: r.tags || [],
      condition: mapConditionToEnum(condition),
      authoritySource: authorityData?.source || '',
      authorityData: authorityData || undefined,
      numista_url: authorityData?.source === 'numista' && authorityData?.itemDetails?.url
        ? authorityData.itemDetails.url
        : undefined,
      brand: r.brand || undefined,
      model: r.model || undefined,
      year: r.year || undefined,
      ghostData: ghostData || null,
      is_ghost: !!ghostData,
    };

    return {
      id,
      itemName,
      estimatedValue,
      confidenceScore,
      confidenceNormalized,
      summaryReasoning,
      valuationFactors,
      allImageUrls,
      category,
      condition,
      hydraConsensus,
      authorityData,
      ghostData,
      nexusData,
      confidenceColor,
      marketplaceItem,
    };
  }, [lastAnalysisResult]);

  return {
    raw: lastAnalysisResult,
    data,
    history: { isViewingHistory, historyItem },
    ebayData,
    marketSources,
  };
}

// =============================================================================
// FIX: Replace misleading AI-generated agreement factors with real data
// =============================================================================

function fixAgreementFactors(
  factors: string[],
  consensus: any | null,
): string[] {
  if (!factors || factors.length === 0) return factors;

  // Calculate actual agreement from consensus votes if available
  let actualAgreement: number | null = null;

  if (consensus && typeof consensus === 'object') {
    const votes = consensus.votes || consensus.allVotes;
    if (Array.isArray(votes) && votes.length > 0) {
      // Count how many votes have the same decision as the consensus
      const consensusDecision = consensus.decision || 'BUY';
      const matching = votes.filter((v: any) =>
        (v.decision || '').toUpperCase() === consensusDecision.toUpperCase()
      ).length;
      actualAgreement = Math.round((matching / votes.length) * 100);
    }
  }

  return factors.map(factor => {
    // Fix "X% decision agreement" — the AI gets this wrong
    const agreementMatch = factor.match(/(\d+)%\s*(decision\s+)?agreement/i);
    if (agreementMatch) {
      if (actualAgreement !== null) {
        return `${actualAgreement}% decision agreement`;
      }
      // If we can't calculate, remove the misleading factor entirely
      return null;
    }
    return factor;
  }).filter((f): f is string => f !== null);
}