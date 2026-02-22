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
//   - On item_identified: shows template-driven comment ($0)
//   - On analysis_complete: runs discrepancy detector (client-side)
//     - Clean result → template comment ($0)
//     - Interesting result → CAN fire narrate API (~$0.001)
//       but template fallback always works
//   - Tappable → saves comment to sessionStorage for Oracle conversation
//   - Auto-dismisses after 8 seconds if not tapped
//
// Mobile-first:
//   - Thumb-zone positioned (bottom of screen)
//   - Doesn't block camera or scan button
//   - Slide-up entrance, fade-out exit
//   - Min touch target 44px
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { renderTemplate } from '@/lib/oracle/narrator/templates.js';
import { detectDiscrepancies } from '@/lib/oracle/narrator/discrepancy-detector.js';
import type { NarratorContext, NarratorEventType } from '@/lib/oracle/narrator/templates.js';
import type { VoteInput, ConsensusInput } from '@/lib/oracle/narrator/discrepancy-detector.js';

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
  const rawVotes: any[] = hc.votes || hc.allVotes || [];

  const consensus: ConsensusInput = {
    estimatedValue: result?.estimatedValue || hc?.estimatedValue || 0,
    decision: result?.decision || hc?.consensus?.decision || hc?.decision || 'SELL',
    confidence: hc?.confidence || hc?.consensus?.confidence || result?.confidenceScore || 0.75,
    itemName: result?.itemName || hc?.consensus?.itemName || 'Unknown Item',
  };

  const votes: VoteInput[] = rawVotes
    .filter((v: any) => v && typeof v === 'object')
    .map((v: any) => ({
      providerName: v.providerName || 'Unknown',
      estimatedValue: v.estimatedValue || 0,
      decision: v.decision || 'SELL',
      confidence: v.confidence || 0.5,
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
    sessionStorage.setItem('oracle_narrator_comment', JSON.stringify({
      comment,
      itemName,
      timestamp: Date.now(),
    }));
  } catch {
    // silent
  }
}

/**
 * Detect current persona from sessionStorage or default.
 */
function detectPersona(): 'default' | 'estate' | 'hustle' | 'collector' {
  try {
    const cached = sessionStorage.getItem('oracle_persona');
    if (cached === 'estate' || cached === 'hustle' || cached === 'collector') {
      return cached;
    }
  } catch {
    // silent
  }
  return 'default';
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
  const hasShownForScan = useRef<string>(''); // Track which scan we've narrated
  const hasShownComplete = useRef(false);

  const persona = useMemo(() => detectPersona(), []);

  // ── Show comment helper ──
  const showComment = useCallback((comment: string, isLLM = false) => {
    // Clear any existing timer
    if (dismissTimer.current) clearTimeout(dismissTimer.current);

    setNarrator({
      visible: true,
      comment,
      isLLM,
      dismissing: false,
    });

    // Auto-dismiss after 8 seconds
    dismissTimer.current = setTimeout(() => {
      setNarrator(prev => ({ ...prev, dismissing: true }));
      // Actually hide after animation
      setTimeout(() => {
        setNarrator(prev => ({ ...prev, visible: false, dismissing: false }));
      }, 300);
    }, AUTO_DISMISS_MS);
  }, []);

  // ── Dismiss handler ──
  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setNarrator(prev => ({ ...prev, dismissing: true }));
    setTimeout(() => {
      setNarrator(prev => ({ ...prev, visible: false, dismissing: false }));
    }, 300);
  }, []);

  // ── Tap handler → save to sessionStorage for Oracle chat ──
  const handleTap = useCallback(() => {
    if (narrator.comment && lastAnalysisResult?.itemName) {
      writeNarratorComment(narrator.comment, lastAnalysisResult.itemName);
    }
    dismiss();
  }, [narrator.comment, lastAnalysisResult?.itemName, dismiss]);

  // ── Stage 1: Item identified (during scan) ──
  useEffect(() => {
    if (!scanProgress || !isAnalyzing) return;

    // Show comment when category is first detected and we have an item name
    if (scanProgress.stage === 'ai_consensus' && scanProgress.category) {
      const scanKey = `${scanProgress.category}-${Date.now()}`;
      if (hasShownForScan.current === scanKey) return;

      // We don't have itemName during scan yet, use category
      const context: NarratorContext = {
        eventType: 'item_identified',
        itemName: scanProgress.category || 'this item',
        category: scanProgress.category || 'general',
        persona,
      };

      const comment = renderTemplate(context);
      showComment(comment);
      hasShownForScan.current = scanKey;
      hasShownComplete.current = false;
    }
  }, [scanProgress?.stage, scanProgress?.category, isAnalyzing, persona, showComment]);

  // ── Stage 2: Analysis complete ──
  useEffect(() => {
    if (!lastAnalysisResult || hasShownComplete.current) return;
    if (isAnalyzing) return; // Wait for analysis to fully complete

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

    // If interesting AND we have at least 3 votes, try LLM narration
    if (report.isInteresting && votes.length >= 3) {
      // Fire template immediately as fallback
      const templateComment = renderTemplate(context);
      showComment(templateComment, false);

      // Try LLM narration in background (with tight timeout)
      fetchNarration(lastAnalysisResult, report.narratorPromptHint || '', persona)
        .then(llmComment => {
          if (llmComment) {
            showComment(llmComment, true);
          }
        })
        .catch(() => {
          // Template already showing — no action needed
        });
    } else {
      // Clean result → template only ($0)
      const comment = renderTemplate(context);
      showComment(comment, false);
    }
  }, [lastAnalysisResult, isAnalyzing, persona, showComment]);

  // ── Cleanup timers ──
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // ── Reset when new scan starts ──
  useEffect(() => {
    if (isAnalyzing) {
      hasShownComplete.current = false;
      setNarrator(prev => ({ ...prev, visible: false }));
    }
  }, [isAnalyzing]);

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
            {narrator.isLLM ? 'Oracle • Tap to discuss' : 'Tap to discuss with Oracle'}
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

    const response = await fetch('/api/oracle/narrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: result.itemName || 'Unknown Item',
        category: result.category || 'general',
        consensusValue: result.estimatedValue || 0,
        votes: (result.hydraConsensus?.votes || []).slice(0, 5).map((v: any) => ({
          provider: v.providerName,
          value: v.estimatedValue,
          decision: v.decision,
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