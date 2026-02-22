// FILE: src/components/oracle/OracleNarrator.tsx
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — "Partner at the Store" Experience
// ═══════════════════════════════════════════════════════════════════════
// Floating pill/bubble that appears during and after scans with
// Oracle commentary. Creates the feeling of having a knowledgeable
// friend looking over your shoulder.
//
// Architecture:
//   - Reads scanProgress from AppContext (SSE events already land here)
//   - On 'identifying' stage: shows template-driven comment ($0)
//   - On analysis complete (!isAnalyzing + lastAnalysisResult):
//     runs discrepancy detector (client-side)
//     - Clean result → template comment ($0)
//     - Interesting result → CAN fire narrate API (~$0.001)
//       but template fallback always works
//   - Tappable → saves comment to sessionStorage for Oracle conversation
//   - Auto-dismisses after 8 seconds if not tapped
//
// Real AppContext scan stages (from SSE events):
//   preparing → identifying → ai_consensus → market_data → finalizing → complete
//
// Mobile-first:
//   - Thumb-zone positioned (bottom of screen)
//   - Doesn't block camera or scan button
//   - Slide-up entrance, fade-out exit
//   - Min touch target 44px
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { renderTemplate } from '@/lib/oracle/narrator/templates';
import { detectDiscrepancies } from '@/lib/oracle/narrator/discrepancy-detector';
import type { NarratorContext } from '@/lib/oracle/narrator/templates';
import type { VoteInput, ConsensusInput } from '@/lib/oracle/narrator/discrepancy-detector';

// =============================================================================
// TYPES
// =============================================================================

interface NarratorState {
  visible: boolean;
  comment: string;
  isLLM: boolean; // Whether this comment came from the LLM (vs template)
  dismissing: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const AUTO_DISMISS_MS = 8000;
const LLM_NARRATE_TIMEOUT_MS = 4000;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract consensus + votes from the analysis result in a shape
 * the discrepancy detector can use.
 */
function extractVotesForDetector(result: any): {
  consensus: ConsensusInput;
  votes: VoteInput[];
} {
  const hc = result?.hydraConsensus || {};
  const rawVotes: any[] =
    hc.votes || hc.allVotes || hc.hydraVotes || [];

  const consensus: ConsensusInput = {
    estimatedValue:
      result?.estimatedValue || hc?.estimatedValue || 0,
    decision:
      result?.decision || hc?.consensus?.decision || hc?.decision || 'SELL',
    confidence:
      hc?.confidence || hc?.consensus?.confidence || result?.confidenceScore || 0.75,
    itemName:
      result?.itemName || hc?.consensus?.itemName || 'Unknown Item',
  };

  const votes: VoteInput[] = rawVotes
    .filter((v: any) => v && typeof v === 'object')
    .map((v: any) => ({
      providerName: v.providerName || v.provider_id || 'Unknown',
      estimatedValue: v.estimatedValue || v.estimated_value || 0,
      decision: v.decision || 'SELL',
      confidence: v.confidence || v.confidence_score || 0.5,
      success: v.success ?? true,
      weight: v.weight ?? 1,
    }));

  return { consensus, votes };
}

/**
 * Write narrator comment to sessionStorage so Oracle chat can pick it up.
 */
function writeNarratorComment(comment: string, itemName: string) {
  try {
    sessionStorage.setItem(
      'oracle_narrator_comment',
      JSON.stringify({
        comment,
        itemName,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // silent — sessionStorage may not be available
  }
}

/**
 * Detect current persona from sessionStorage or default.
 */
function detectPersona(): 'default' | 'estate' | 'flipper' | 'collector' {
  try {
    const cached = sessionStorage.getItem('oracle_persona');
    if (
      cached === 'estate' ||
      cached === 'flipper' ||
      cached === 'collector'
    ) {
      return cached;
    }
  } catch {
    // silent
  }
  return 'default';
}

/**
 * Try to extract an item name from scanProgress.
 * During scanning, we may not have a name yet — fall back gracefully.
 */
function getItemNameFromProgress(scanProgress: any): string | null {
  // Some SSE events include model results with item names
  if (scanProgress?.itemName) return scanProgress.itemName;
  if (scanProgress?.detectedItem) return scanProgress.detectedItem;

  // Check if any model status has reported an item name
  const models = scanProgress?.models || scanProgress?.providers || [];
  if (Array.isArray(models)) {
    for (const m of models) {
      if (m?.itemName) return m.itemName;
      if (m?.estimate?.itemName) return m.estimate.itemName;
    }
  }

  return null;
}

/**
 * Try to extract category from scanProgress.
 */
function getCategoryFromProgress(scanProgress: any): string {
  return (
    scanProgress?.category ||
    scanProgress?.detectedCategory ||
    'general'
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

const OracleNarrator: React.FC = () => {
  const { scanProgress, lastAnalysisResult, isAnalyzing } = useAppContext();
  const [narrator, setNarrator] = useState<NarratorState>({
    visible: false,
    comment: '',
    isLLM: false,
    dismissing: false,
  });

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fire guards (prevent multiple triggers per scan) ──
  // These refs reset when a new scan starts (isAnalyzing flips true).
  const hasShownIdentifying = useRef(false);
  const hasShownComplete = useRef(false);
  const narrateCallInFlight = useRef(false);

  const persona = useMemo(() => detectPersona(), []);

  // ── Show comment helper ──
  const showComment = useCallback((comment: string, isLLM = false) => {
    if (!comment) return;

    // Clear any existing dismiss timer
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    setNarrator({
      visible: true,
      comment,
      isLLM,
      dismissing: false,
    });

    // Auto-dismiss after 8 seconds
    dismissTimer.current = setTimeout(() => {
      setNarrator((prev) => ({ ...prev, dismissing: true }));
      // Actually hide after CSS animation completes
      setTimeout(() => {
        setNarrator((prev) => ({ ...prev, visible: false, dismissing: false }));
      }, 300);
    }, AUTO_DISMISS_MS);
  }, []);

  // ── Dismiss handler ──
  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNarrator((prev) => ({ ...prev, dismissing: true }));
    setTimeout(() => {
      setNarrator((prev) => ({ ...prev, visible: false, dismissing: false }));
    }, 300);
  }, []);

  // ── Tap handler → save to sessionStorage for Oracle chat ──
  const handleTap = useCallback(() => {
    const itemName =
      lastAnalysisResult?.itemName ||
      getItemNameFromProgress(scanProgress) ||
      'Unknown Item';

    if (narrator.comment) {
      writeNarratorComment(narrator.comment, itemName);
    }
    dismiss();
  }, [narrator.comment, lastAnalysisResult?.itemName, scanProgress, dismiss]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 1: Reset all guards when a new scan starts
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isAnalyzing) {
      hasShownIdentifying.current = false;
      hasShownComplete.current = false;
      narrateCallInFlight.current = false;
      // Hide any existing narrator bubble when new scan begins
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setNarrator((prev) =>
        prev.visible ? { ...prev, visible: false, dismissing: false } : prev,
      );
    }
  }, [isAnalyzing]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 2: First comment during scan (template only, $0)
  //
  // Fires once when stage transitions to 'identifying' or 'ai_consensus'.
  // Uses template engine — zero LLM cost, instant.
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Only fire during active analysis
    if (!isAnalyzing || !scanProgress) return;

    // Only fire once per scan
    if (hasShownIdentifying.current) return;

    // Fire when AIs are actively working
    // 'identifying' = primary vision AIs started
    // 'ai_consensus' = text AIs running (we definitely have category by now)
    const activeStages = ['identifying', 'ai_consensus'];
    if (!activeStages.includes(scanProgress.stage)) return;

    // Mark as shown FIRST to prevent re-fires
    hasShownIdentifying.current = true;

    const itemName = getItemNameFromProgress(scanProgress) || 'this item';
    const category = getCategoryFromProgress(scanProgress);

    const context: NarratorContext = {
      eventType: 'item_identified',
      itemName,
      category,
      persona,
    };

    const comment = renderTemplate(context);
    showComment(comment);
  }, [scanProgress?.stage, isAnalyzing, persona, showComment]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 3: Post-analysis commentary (template + optional LLM)
  //
  // Fires once when analysis completes.
  // Runs client-side discrepancy detection to decide if LLM is worth it.
  // Template shows immediately. LLM upgrades the comment if interesting.
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Wait for analysis to fully complete
    if (isAnalyzing) return;
    if (!lastAnalysisResult) return;

    // Only fire once per scan
    if (hasShownComplete.current) return;

    // Mark as shown FIRST — before any async work
    hasShownComplete.current = true;

    const { consensus, votes } = extractVotesForDetector(lastAnalysisResult);
    const report = detectDiscrepancies(consensus, votes);

    const context: NarratorContext = {
      eventType: report.suggestedEventType,
      itemName: lastAnalysisResult.itemName || 'this item',
      category: lastAnalysisResult.category || 'general',
      voteCount: votes.length,
      consensusValue: consensus.estimatedValue,
      ...report.narratorContext,
      persona,
    };

    // Always show template immediately ($0)
    const templateComment = renderTemplate(context);
    showComment(templateComment, false);

    // If interesting AND we have enough votes, try LLM upgrade in background
    if (report.isInteresting && votes.length >= 3 && !narrateCallInFlight.current) {
      narrateCallInFlight.current = true;

      fetchNarration(
        lastAnalysisResult,
        report.narratorPromptHint || '',
        persona,
      )
        .then((llmComment) => {
          if (llmComment) {
            // Upgrade the template comment with LLM response
            showComment(llmComment, true);
          }
        })
        .catch(() => {
          // Template already showing — no action needed
        })
        .finally(() => {
          narrateCallInFlight.current = false;
        });
    }
  }, [lastAnalysisResult, isAnalyzing, persona, showComment]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 4: Cleanup timers on unmount
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // ── Don't render when hidden ──
  if (!narrator.visible) return null;

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 z-40 transition-all duration-300 ease-out ${
        narrator.dismissing
          ? 'opacity-0 translate-y-4'
          : 'opacity-100 translate-y-0'
      }`}
      style={{ pointerEvents: narrator.dismissing ? 'none' : 'auto' }}
    >
      <button
        onClick={handleTap}
        className="w-full flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0a0a0f]/95 backdrop-blur-md px-4 py-3 shadow-lg shadow-black/30 active:bg-white/5 transition-colors min-h-[44px]"
        aria-label="Oracle commentary — tap to continue conversation"
      >
        {/* Oracle avatar */}
        <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">
          🔮
        </span>

        {/* Comment text */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm text-white/85 leading-relaxed">
            {narrator.comment}
          </p>
          <p className="text-[10px] text-white/30 mt-1">
            {narrator.isLLM
              ? 'Oracle • Tap to discuss'
              : 'Tap to discuss with Oracle'}
          </p>
        </div>

        {/* Dismiss X */}
        <span
          className="text-white/30 text-xs mt-1 flex-shrink-0 p-1"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          role="button"
          aria-label="Dismiss"
        >
          ✕
        </span>
      </button>
    </div>
  );
};

// =============================================================================
// LLM NARRATION FETCH (only for interesting scans, ~$0.001 per call)
// =============================================================================

async function fetchNarration(
  result: any,
  discrepancyHint: string,
  persona: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_NARRATE_TIMEOUT_MS);

    const hc = result?.hydraConsensus || {};
    const rawVotes: any[] = hc.votes || hc.allVotes || hc.hydraVotes || [];

    const response = await fetch('/api/oracle/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: result.itemName || 'Unknown Item',
        category: result.category || 'general',
        consensusValue: result.estimatedValue || 0,
        votes: rawVotes.slice(0, 5).map((v: any) => ({
          provider: v.providerName || v.provider_id || 'Unknown',
          value: v.estimatedValue || v.estimated_value || 0,
          decision: v.decision || 'SELL',
        })),
        discrepancies: discrepancyHint,
        persona,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    return data.commentary || null;
  } catch {
    return null; // Template fallback already showing
  }
}

export default OracleNarrator;