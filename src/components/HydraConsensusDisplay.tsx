// FILE: src/components/HydraConsensusDisplay.tsx
// v10.4 — CRASH-PROOF + DUAL EXPORT FIX + CONFIDENCE FIX
// FIX v10.4: finalConfidence arrives as 0-100 integer from hydra-engine, not 0-1.
//   Display was doing 77 * 100 = 7700%. Now normalizes: if > 1, divide by 100.
// FIX: Both named AND default export (AnalysisResult.tsx uses named import)
// FIX: Guards all .map() calls with optional chaining
// FIX: Handles both votes and allVotes field names
// FIX: Accepts any consensus shape (defensive against SSE vs standard response)
// FIX: Returns minimal display if zero votes instead of crashing

import React from 'react';

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
}

interface HydraConsensusDisplayProps {
  consensus: any; // Intentionally any — defensive against shape changes
}

// =============================================================================
// NORMALIZE VOTES — extracts votes from any consensus shape
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
// COMPONENT
// =============================================================================

const HydraConsensusDisplay: React.FC<HydraConsensusDisplayProps> = ({
  consensus,
}) => {
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

  return (
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

      {/* Vote bars */}
      <div className="space-y-2">
        {sortedVotes.map((vote, index) => {
          const barWidth =
            maxWeight > 0 ? (vote.weight / maxWeight) * 100 : 0;

          return (
            <div key={`${vote.providerName}-${index}`} className="space-y-1">
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
            </div>
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
  );
};

// =============================================================================
// DUAL EXPORT — AnalysisResult.tsx uses named import, others may use default
// =============================================================================
export { HydraConsensusDisplay };
export default HydraConsensusDisplay;