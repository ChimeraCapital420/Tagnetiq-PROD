// FILE: src/components/oracle/OracleNarrator.tsx
// ═══════════════════════════════════════════════════════════════════════
// Oracle Narrator — "Partner at the Store" Experience (v5)
// ═══════════════════════════════════════════════════════════════════════
//
// FIXED v5: Double-speak on page navigation. Refs reset on remount but
// lastAnalysisResult persists in AppContext. Now uses sessionStorage to
// track which analysisId has been narrated, surviving component remounts.
//
// Voice cascade: ElevenLabs → Browser TTS → Silent
// Only LLM comments get voice. Templates stay silent.
//
// Display timing: scales with word count (200 wpm + 3s buffer)
//   Templates: 6s min | LLM: 12s min | Max: 25s
//
// Real AppContext scan stages:
//   preparing → identifying → ai_consensus → market_data → finalizing → complete
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTts } from '@/hooks/useTts';
import { renderTemplate } from '@/lib/oracle/narrator/templates';
import { detectDiscrepancies } from '@/lib/oracle/narrator/discrepancy-detector';
import type { NarratorContext } from '@/lib/oracle/narrator/templates';
import type { VoteInput, ConsensusInput } from '@/lib/oracle/narrator/discrepancy-detector';
import type { EnergyLevel } from '@/components/oracle/types';

// =============================================================================
// TYPES
// =============================================================================

interface NarratorState {
  visible: boolean;
  comment: string;
  isLLM: boolean;
  dismissing: boolean;
  speaking: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TEMPLATE_MIN_DISPLAY_MS = 6000;
const LLM_MIN_DISPLAY_MS = 12000;
const WORDS_PER_MINUTE = 200;
const READING_BUFFER_MS = 3000;
const MAX_DISPLAY_MS = 25000;
const LLM_NARRATE_TIMEOUT_MS = 4000;

/** SessionStorage key for tracking narrated results across remounts */
const NARRATED_KEY = 'oracle_narrator_last_narrated';

// =============================================================================
// HELPERS
// =============================================================================

function calculateDisplayTime(comment: string, isLLM: boolean): number {
  const wordCount = comment.split(/\s+/).filter(Boolean).length;
  const readTimeMs = (wordCount / WORDS_PER_MINUTE) * 60 * 1000;
  const minTime = isLLM ? LLM_MIN_DISPLAY_MS : TEMPLATE_MIN_DISPLAY_MS;
  return Math.min(Math.max(readTimeMs + READING_BUFFER_MS, minTime), MAX_DISPLAY_MS);
}

function pickNarratorEnergy(isLLM: boolean, consensusValue?: number): EnergyLevel {
  if (!isLLM) return 'neutral';
  if (consensusValue && consensusValue > 500) return 'excited';
  return 'curious';
}

/**
 * Generate a fingerprint for an analysis result.
 * Used to detect "already narrated this exact result" across remounts.
 */
function getResultFingerprint(result: any): string {
  if (!result) return '';
  // Combine item name + value + timestamp for uniqueness
  const name = result.itemName || '';
  const value = result.estimatedValue || 0;
  const id = result.analysisId || result.id || '';
  // If we have an analysisId, use it (most reliable)
  if (id) return `narrated-${id}`;
  // Fallback: name + value creates a reasonable fingerprint
  return `narrated-${name}-${value}`;
}

/**
 * Check if we already narrated this exact result (survives remounts).
 */
function hasAlreadyNarrated(fingerprint: string): boolean {
  if (!fingerprint) return false;
  try {
    return sessionStorage.getItem(NARRATED_KEY) === fingerprint;
  } catch {
    return false;
  }
}

/**
 * Mark this result as narrated (survives remounts).
 */
function markAsNarrated(fingerprint: string) {
  if (!fingerprint) return;
  try {
    sessionStorage.setItem(NARRATED_KEY, fingerprint);
  } catch { /* silent */ }
}

/**
 * Clear the narrated marker (called when new scan starts).
 */
function clearNarratedMarker() {
  try {
    sessionStorage.removeItem(NARRATED_KEY);
  } catch { /* silent */ }
}

function extractVotesForDetector(result: any): {
  consensus: ConsensusInput;
  votes: VoteInput[];
} {
  const hc = result?.hydraConsensus || {};
  const rawVotes: any[] = hc.votes || hc.allVotes || hc.hydraVotes || [];

  const consensus: ConsensusInput = {
    estimatedValue: result?.estimatedValue || hc?.estimatedValue || 0,
    decision: result?.decision || hc?.consensus?.decision || hc?.decision || 'SELL',
    confidence: hc?.confidence || hc?.consensus?.confidence || result?.confidenceScore || 0.75,
    itemName: result?.itemName || hc?.consensus?.itemName || 'Unknown Item',
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

function writeNarratorComment(comment: string, itemName: string) {
  try {
    sessionStorage.setItem(
      'oracle_narrator_comment',
      JSON.stringify({ comment, itemName, timestamp: Date.now() }),
    );
  } catch { /* silent */ }
}

function detectPersona(): 'default' | 'estate' | 'flipper' | 'collector' {
  try {
    const cached = sessionStorage.getItem('oracle_persona');
    if (cached === 'estate' || cached === 'flipper' || cached === 'collector') return cached;
  } catch { /* silent */ }
  return 'default';
}

function getItemNameFromProgress(scanProgress: any): string | null {
  if (scanProgress?.itemName) return scanProgress.itemName;
  if (scanProgress?.detectedItem) return scanProgress.detectedItem;
  const models = scanProgress?.models || scanProgress?.providers || [];
  if (Array.isArray(models)) {
    for (const m of models) {
      if (m?.itemName) return m.itemName;
      if (m?.estimate?.itemName) return m.estimate.itemName;
    }
  }
  return null;
}

function getCategoryFromProgress(scanProgress: any): string {
  return scanProgress?.category || scanProgress?.detectedCategory || 'general';
}

// =============================================================================
// COMPONENT
// =============================================================================

const OracleNarrator: React.FC = () => {
  const { scanProgress, lastAnalysisResult, isAnalyzing } = useAppContext();
  const { profile } = useAuth();
  const { speak, cancel: cancelSpeech, isSpeaking } = useTts();

  const [narrator, setNarrator] = useState<NarratorState>({
    visible: false,
    comment: '',
    isLLM: false,
    dismissing: false,
    speaking: false,
  });

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref guards (within same mount cycle)
  const hasShownIdentifying = useRef(false);
  const hasShownComplete = useRef(false);
  const narrateCallInFlight = useRef(false);

  const persona = useMemo(() => detectPersona(), []);

  // Voice settings from user profile
  const voiceEnabled = profile?.settings?.tts_enabled ?? false;
  const premiumVoiceId = profile?.settings?.premium_voice_id || null;
  const browserVoiceURI = profile?.settings?.tts_voice_uri || null;

  // Track speaking state
  useEffect(() => {
    setNarrator((prev) =>
      prev.speaking !== isSpeaking ? { ...prev, speaking: isSpeaking } : prev,
    );
  }, [isSpeaking]);

  const clearTimers = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (animationTimer.current) clearTimeout(animationTimer.current);
  }, []);

  const showComment = useCallback(
    (comment: string, isLLM = false, consensusValue?: number) => {
      if (!comment) return;
      clearTimers();

      setNarrator({ visible: true, comment, isLLM, dismissing: false, speaking: false });

      // Voice: only LLM comments, only if user enabled TTS
      if (isLLM && voiceEnabled) {
        const energy = pickNarratorEnergy(isLLM, consensusValue);
        speak(comment, browserVoiceURI, premiumVoiceId, energy);
      }

      const displayTime = calculateDisplayTime(comment, isLLM);
      dismissTimer.current = setTimeout(() => {
        setNarrator((prev) => ({ ...prev, dismissing: true }));
        animationTimer.current = setTimeout(() => {
          setNarrator((prev) => ({ ...prev, visible: false, dismissing: false }));
        }, 300);
      }, displayTime);
    },
    [clearTimers, voiceEnabled, premiumVoiceId, browserVoiceURI, speak],
  );

  const dismiss = useCallback(() => {
    clearTimers();
    cancelSpeech();
    setNarrator((prev) => ({ ...prev, dismissing: true }));
    animationTimer.current = setTimeout(() => {
      setNarrator((prev) => ({ ...prev, visible: false, dismissing: false }));
    }, 300);
  }, [clearTimers, cancelSpeech]);

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
  // EFFECT 1: Reset guards when NEW scan starts
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isAnalyzing) {
      hasShownIdentifying.current = false;
      hasShownComplete.current = false;
      narrateCallInFlight.current = false;
      clearNarratedMarker(); // Allow narration for new scan
      clearTimers();
      cancelSpeech();
      setNarrator((prev) =>
        prev.visible ? { ...prev, visible: false, dismissing: false } : prev,
      );
    }
  }, [isAnalyzing, clearTimers, cancelSpeech]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 2: Template comment during scan ($0, silent)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isAnalyzing || !scanProgress) return;
    if (hasShownIdentifying.current) return;

    const activeStages = ['identifying', 'ai_consensus'];
    if (!activeStages.includes(scanProgress.stage)) return;

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
  // EFFECT 3: Post-analysis commentary (template + optional LLM voice)
  //
  // Double-fire protection:
  //   - Ref guard: prevents re-fire within same mount
  //   - SessionStorage guard: prevents re-fire after remount/navigation
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isAnalyzing) return;
    if (!lastAnalysisResult) return;
    if (hasShownComplete.current) return;

    // ── SessionStorage guard: survives remount ──
    const fingerprint = getResultFingerprint(lastAnalysisResult);
    if (hasAlreadyNarrated(fingerprint)) {
      // Already narrated this result (user navigated away and came back)
      hasShownComplete.current = true; // Also set ref so we don't check again
      return;
    }

    // Mark both guards
    hasShownComplete.current = true;
    markAsNarrated(fingerprint);

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

    // Template first ($0, silent)
    const templateComment = renderTemplate(context);
    showComment(templateComment, false);

    // LLM upgrade for interesting scans
    if (report.isInteresting && votes.length >= 3 && !narrateCallInFlight.current) {
      narrateCallInFlight.current = true;

      fetchNarration(lastAnalysisResult, report.narratorPromptHint || '', persona)
        .then((llmComment) => {
          if (llmComment) {
            showComment(llmComment, true, consensus.estimatedValue);
          }
        })
        .catch(() => { /* template already showing */ })
        .finally(() => { narrateCallInFlight.current = false; });
    }
  }, [lastAnalysisResult, isAnalyzing, persona, showComment]);

  // ═══════════════════════════════════════════════════════════════════════
  // EFFECT 4: Cleanup
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    return () => {
      clearTimers();
      cancelSpeech();
    };
  }, [clearTimers, cancelSpeech]);

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
        {/* Oracle avatar — pulses when speaking */}
        <span
          className={`text-xl flex-shrink-0 mt-0.5 ${narrator.speaking ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        >
          🔮
        </span>

        {/* Comment text */}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm text-white/85 leading-relaxed">
            {narrator.comment}
          </p>
          <p className="text-[10px] text-white/30 mt-1.5 flex items-center gap-1.5">
            {narrator.speaking ? (
              <>
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-2 bg-emerald-400/80 rounded-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                  <span className="w-1 h-2.5 bg-emerald-400/80 rounded-full animate-[pulse_0.6s_ease-in-out_0.15s_infinite]" />
                  <span className="w-1 h-1.5 bg-emerald-400/80 rounded-full animate-[pulse_0.6s_ease-in-out_0.3s_infinite]" />
                </span>
                Oracle speaking&nbsp;&nbsp;•&nbsp;&nbsp;Tap to stop
              </>
            ) : narrator.isLLM ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                Oracle&nbsp;&nbsp;•&nbsp;&nbsp;Tap to discuss
              </>
            ) : (
              'Tap to discuss with Oracle'
            )}
          </p>
        </div>

        {/* Dismiss X */}
        <span
          className="text-white/30 hover:text-white/60 text-xs mt-1 flex-shrink-0 p-2 -mr-1"
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
// LLM NARRATION FETCH
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
    return null;
  }
}

export default OracleNarrator;