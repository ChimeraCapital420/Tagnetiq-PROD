// FILE: src/lib/oracle/narrator/discrepancy-detector.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — Discrepancy Detector
// ═══════════════════════════════════════════════════════════════════════
// Pure function: takes consensus + votes, returns DiscrepancyReport.
// 100% client-side. Zero cost. Sub-millisecond.
//
// The device decides IF Oracle should speak beyond templates:
//   - isInteresting: false → narrator uses template only ($0)
//   - isInteresting: true  → narrator CAN fire lightweight LLM call
//     but template fallback always works
//
// Checks:
//   - Price spread > 40%
//   - Low confidence (< 50%)
//   - Provider disagreement on BUY/SELL
//   - Authority data mismatch
//   - Single outlier skewing consensus
// ═══════════════════════════════════════════════════════════════════════

import type { NarratorEventType } from './templates.js';

// =============================================================================
// TYPES
// =============================================================================

export interface Discrepancy {
  type: 'price_spread' | 'low_confidence' | 'decision_split' | 'authority_mismatch' | 'outlier';
  severity: 'low' | 'medium' | 'high';
  description: string;
  providers?: string[];
  values?: number[];
}

export interface DiscrepancyReport {
  isInteresting: boolean;
  discrepancies: Discrepancy[];
  suggestedEventType: NarratorEventType;
  /** Extra context for the narrator template interpolation */
  narratorContext: {
    outlierProvider?: string;
    outlierValue?: number;
    highProvider?: string;
    highValue?: number;
    lowProvider?: string;
    lowValue?: number;
  };
  /** If isInteresting, this hint can be sent to the narrate API */
  narratorPromptHint?: string;
}

export interface VoteInput {
  providerName: string;
  estimatedValue: number;
  decision: string;
  confidence: number;
  success?: boolean;
  weight?: number;
}

export interface ConsensusInput {
  estimatedValue: number;
  decision: string;
  confidence: number;
  itemName?: string;
}

// =============================================================================
// THRESHOLDS (tunable)
// =============================================================================

const PRICE_SPREAD_THRESHOLD = 0.4;     // 40% spread between highest and lowest
const LOW_CONFIDENCE_THRESHOLD = 0.5;    // Below 50% = noteworthy
const OUTLIER_THRESHOLD = 0.5;           // 50% deviation from consensus = outlier
const DECISION_AGREEMENT_MIN = 0.6;      // Below 60% = split decision

// =============================================================================
// DETECTOR
// =============================================================================

/**
 * Analyze consensus + votes for interesting patterns.
 *
 * @param consensus - Consensus object (estimatedValue, decision, confidence)
 * @param votes     - Array of individual provider votes
 * @returns DiscrepancyReport with interesting flag and details
 */
export function detectDiscrepancies(
  consensus: ConsensusInput,
  votes: VoteInput[],
): DiscrepancyReport {
  const discrepancies: Discrepancy[] = [];
  const narratorContext: DiscrepancyReport['narratorContext'] = {};

  // Filter to successful votes with values
  const activeVotes = votes.filter(v =>
    (v.success !== false) && typeof v.estimatedValue === 'number' && v.estimatedValue > 0
  );

  if (activeVotes.length < 2) {
    return {
      isInteresting: false,
      discrepancies: [],
      suggestedEventType: 'analysis_complete_clean',
      narratorContext: {},
    };
  }

  // ── Check 1: Price spread ──────────────────────────────
  const values = activeVotes.map(v => v.estimatedValue).sort((a, b) => a - b);
  const lowest = values[0];
  const highest = values[values.length - 1];

  if (lowest > 0) {
    const spread = (highest - lowest) / lowest;
    if (spread > PRICE_SPREAD_THRESHOLD) {
      const highVote = activeVotes.find(v => v.estimatedValue === highest);
      const lowVote = activeVotes.find(v => v.estimatedValue === lowest);

      discrepancies.push({
        type: 'price_spread',
        severity: spread > 1.0 ? 'high' : 'medium',
        description: `Price spread of ${Math.round(spread * 100)}%: $${lowest.toFixed(2)} to $${highest.toFixed(2)}`,
        providers: [lowVote?.providerName || 'unknown', highVote?.providerName || 'unknown'],
        values: [lowest, highest],
      });

      narratorContext.highProvider = highVote?.providerName;
      narratorContext.highValue = highest;
      narratorContext.lowProvider = lowVote?.providerName;
      narratorContext.lowValue = lowest;
    }
  }

  // ── Check 2: Low confidence ────────────────────────────
  const normalizedConfidence = (consensus.confidence > 1)
    ? consensus.confidence / 100
    : consensus.confidence;

  if (normalizedConfidence < LOW_CONFIDENCE_THRESHOLD) {
    discrepancies.push({
      type: 'low_confidence',
      severity: normalizedConfidence < 0.3 ? 'high' : 'medium',
      description: `Overall confidence is low: ${Math.round(normalizedConfidence * 100)}%`,
    });
  }

  // ── Check 3: Decision disagreement ─────────────────────
  const buyVotes = activeVotes.filter(v => (v.decision || '').toUpperCase() === 'BUY');
  const sellVotes = activeVotes.filter(v => (v.decision || '').toUpperCase() !== 'BUY');
  const majority = Math.max(buyVotes.length, sellVotes.length);
  const agreement = majority / activeVotes.length;

  if (agreement < DECISION_AGREEMENT_MIN) {
    discrepancies.push({
      type: 'decision_split',
      severity: 'medium',
      description: `Decision split: ${buyVotes.length} say BUY, ${sellVotes.length} say SELL/HOLD`,
      providers: activeVotes.map(v => v.providerName),
    });
  }

  // ── Check 4: Single outlier ────────────────────────────
  if (activeVotes.length >= 3 && consensus.estimatedValue > 0) {
    for (const vote of activeVotes) {
      const deviation = Math.abs(vote.estimatedValue - consensus.estimatedValue) / consensus.estimatedValue;
      if (deviation > OUTLIER_THRESHOLD) {
        discrepancies.push({
          type: 'outlier',
          severity: deviation > 1.0 ? 'high' : 'medium',
          description: `${vote.providerName} is an outlier at $${vote.estimatedValue.toFixed(2)} (consensus: $${consensus.estimatedValue.toFixed(2)})`,
          providers: [vote.providerName],
          values: [vote.estimatedValue, consensus.estimatedValue],
        });

        // Set the first outlier for narrator context
        if (!narratorContext.outlierProvider) {
          narratorContext.outlierProvider = vote.providerName;
          narratorContext.outlierValue = vote.estimatedValue;
        }
      }
    }
  }

  // ── Build report ───────────────────────────────────────
  const isInteresting = discrepancies.length > 0;

  // Build prompt hint for narrate API (only if interesting)
  let narratorPromptHint: string | undefined;
  if (isInteresting) {
    const hints = discrepancies.map(d => d.description);
    narratorPromptHint = hints.join('. ');
  }

  return {
    isInteresting,
    discrepancies,
    suggestedEventType: isInteresting ? 'analysis_complete_interesting' : 'analysis_complete_clean',
    narratorContext,
    narratorPromptHint,
  };
}