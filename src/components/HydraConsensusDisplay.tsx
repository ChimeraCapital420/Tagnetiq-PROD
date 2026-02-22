// FILE: src/components/HydraConsensusDisplay.tsx
// v11.0 — TAPPABLE PROVIDER REPORT CARDS
// 
// WHAT'S NEW in v11.0:
//   - Vote bars are tappable → opens ProviderReportSheet (slide-up bottom sheet)
//   - extractVotes() now preserves rawResponse, itemName, category on each vote
//   - Subtle tap affordance (chevron icon) on each vote row
//   - Consensus context object built for ProviderReportSheet comparison
//   - Oracle context event written to sessionStorage when report opens (Step 2 bridge)
//
// PRESERVED from v10.4:
//   - CRASH-PROOF guards on all .map() calls
//   - Handles votes, allVotes, hydraVotes field names
//   - Confidence normalization (0-100 integer → 0-1 decimal)
//   - Dual export (named + default)
//   - Accepts any consensus shape (defensive against API changes)
//   - Minimal display on zero votes

import React, { useState, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import ProviderReportSheet from '@/components/analysis/ProviderReportSheet.js';
import type { ProviderVote, ConsensusContext } from '@/components/analysis/ProviderReportSheet.js';

// =============================================================================
// TYPES — Accepts any shape to prevent crashes from API changes
// =============================================================================

interface NormalizedVote {
  providerName: string;
  icon: string;
  color: string;
  success: boolean;
  weight: number;
  responseTime: number;
  estimatedValue: number;
  decision: string;
  confidence: number;
  // v11.0: Preserved for report cards
  itemName: string;
  category: string;
  rawResponse: any;
}

interface HydraConsensusDisplayProps {
  consensus: any; // Intentionally any — defensive against shape changes
  isAdmin?: boolean; // Pass through for admin flag button in report sheet
}

// =============================================================================
// NORMALIZE VOTES — extracts votes from any consensus shape
// v11.0: Now preserves rawResponse, itemName, category for report cards
// =============================================================================

function extractVotes(consensus: any): NormalizedVote[] {
  if (!consensus) return [];

  // Try multiple field locations
  const rawVotes: any[] =
    consensus.votes ||
    consensus.allVotes ||
    consensus.hydraVotes ||
    [];

  if (!Array.isArray(rawVotes)) return [];

  return rawVotes
    .filter((v: any) => v && typeof v === 'object')
    .map((v: any) => ({
      providerName: v.providerName || v.model || v.name || 'Unknown',
      icon: v.icon || '🤖',
      color: v.color || '#888888',
      success: v.success ?? true,
      weight: typeof v.weight === 'number' ? v.weight : 1,
      responseTime: typeof v.responseTime === 'number' ? v.responseTime : 0,
      estimatedValue:
        typeof v.estimatedValue === 'number'
          ? v.estimatedValue
          : v.rawResponse?.estimatedValue ?? 0,
      decision: v.decision || v.rawResponse?.decision || 'SELL',
      confidence:
        typeof v.confidence === 'number'
          ? v.confidence
          : v.rawResponse?.confidence ?? 0.5,
      // v11.0: Preserve these for ProviderReportSheet
      itemName: v.itemName || v.rawResponse?.itemName || '',
      category: v.category || v.rawResponse?.category || 'general',
      rawResponse: v.rawResponse || null,
    }));
}

// =============================================================================
// NORMALIZE CONFIDENCE — handles both 0-1 decimal and 0-100 integer formats
// hydra-engine.ts returns confidence as 0-100 integer (e.g. 77)
// This display expects 0-1 decimal for the (x * 100) calculation
// =============================================================================

function normalizeConfidence(raw: any): number {
  // Try finalConfidence first, then confidence, then fallback
  const value =
    typeof raw?.finalConfidence === 'number'
      ? raw.finalConfidence
      : typeof raw?.confidence === 'number'
        ? raw.confidence
        : 0.75;

  // If > 1, it's already a percentage (0-100) — convert to 0-1
  // If <= 1, it's already a decimal — use as-is
  return value > 1 ? value / 100 : value;
}

// =============================================================================
// BUILD CONSENSUS CONTEXT — for ProviderReportSheet comparison
// =============================================================================

function buildConsensusContext(consensus: any, votes: NormalizedVote[]): ConsensusContext {
  const consensusBlock = consensus?.consensus || consensus || {};
  
  // Extract consensus values from various shapes
  const estimatedValue =
    typeof consensusBlock.estimatedValue === 'number'
      ? consensusBlock.estimatedValue
      : typeof consensus?.estimatedValue === 'number'
        ? consensus.estimatedValue
        : 0;

  const decision = consensusBlock.decision || consensus?.decision || 'SELL';
  const confidence = normalizeConfidence(consensus);
  const itemName = consensusBlock.itemName || consensus?.itemName || votes[0]?.itemName || 'Unknown Item';

  return { estimatedValue, decision, confidence, itemName };
}

// =============================================================================
// COMPONENT
// =============================================================================

const HydraConsensusDisplay: React.FC<HydraConsensusDisplayProps> = ({
  consensus,
  isAdmin = false,
}) => {
  const [selectedVote, setSelectedVote] = useState<NormalizedVote | null>(null);

  // ── Close handler for report sheet ──
  const handleCloseSheet = useCallback(() => {
    setSelectedVote(null);
  }, []);

  // Guard: no consensus at all
  if (!consensus || typeof consensus !== 'object') {
    return null;
  }

  const votes = extractVotes(consensus);

  // Guard: no votes to display
  if (votes.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-gray-400">
        <p>No AI consensus data available</p>
      </div>
    );
  }

  const successfulVotes = votes.filter((v) => v.success);
  const maxWeight =
    successfulVotes.length > 0
      ? Math.max(...successfulVotes.map((v) => v.weight))
      : 1;
  const sortedVotes = [...votes].sort((a, b) => b.weight - a.weight);

  const totalSources = consensus.totalSources ?? votes.length;
  const method = consensus.consensusMethod || 'weighted_blend';

  // FIX v10.4: Normalize confidence to 0-1 range before displaying
  // hydra-engine returns 77 (integer), not 0.77 (decimal)
  const finalConfidence = normalizeConfidence(consensus);

  // v11.0: Build consensus context for report sheet comparison
  const consensusContext = buildConsensusContext(consensus, votes);

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            🐉 Hydra Consensus
            <span className="text-xs text-white/50 font-normal">
              {totalSources} sources
            </span>
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {method.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Tap hint — only show if there are successful votes with data */}
        {successfulVotes.length > 0 && (
          <p className="text-[10px] text-white/30 -mt-1">
            Tap any provider to see full report
          </p>
        )}

        {/* Vote bars */}
        <div className="space-y-2">
          {sortedVotes.map((vote, index) => {
            const barWidth =
              maxWeight > 0 ? (vote.weight / maxWeight) * 100 : 0;

            return (
              <button
                key={`${vote.providerName}-${index}`}
                className="w-full text-left space-y-1 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-white/5 active:bg-white/10 cursor-pointer min-h-[44px] flex flex-col justify-center"
                onClick={() => vote.success ? setSelectedVote(vote) : undefined}
                disabled={!vote.success}
                aria-label={`View ${vote.providerName} report: $${vote.estimatedValue.toFixed(2)} ${vote.decision}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span>{vote.icon}</span>
                    <span
                      className={
                        vote.success ? 'text-white/80' : 'text-white/30 line-through'
                      }
                    >
                      {vote.providerName}
                    </span>
                    {vote.responseTime > 0 && (
                      <span className="text-white/30">
                        {(vote.responseTime / 1000).toFixed(1)}s
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {vote.success && vote.estimatedValue > 0 && (
                      <span className="text-emerald-400 font-medium">
                        ${vote.estimatedValue.toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        vote.decision === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : vote.decision === 'HOLD'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {vote.decision}
                    </span>
                    {vote.success && (
                      <ChevronRight className="w-3 h-3 text-white/20" />
                    )}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: vote.success
                        ? vote.color
                        : 'rgba(255,255,255,0.1)',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Confidence footer */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-xs text-white/40">
            {successfulVotes.length} of {votes.length} models responded
          </span>
          <span className="text-xs text-white/50">
            Confidence: {(finalConfidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Provider Report Sheet — renders as portal overlay */}
      <ProviderReportSheet
        vote={selectedVote as ProviderVote}
        consensus={consensusContext}
        isOpen={selectedVote !== null}
        onClose={handleCloseSheet}
        isAdmin={isAdmin}
      />
    </>
  );
};

// =============================================================================
// DUAL EXPORT — AnalysisResult.tsx uses named import, others may use default
// =============================================================================
export { HydraConsensusDisplay };
export default HydraConsensusDisplay;