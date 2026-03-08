// FILE: src/hooks/useBehavioralSignals.ts
// ═══════════════════════════════════════════════════════════════════════
// Behavioral Signals Hook
// ═══════════════════════════════════════════════════════════════════════
//
// Observes how the user interacts with the app and detects signs of
// confusion that should temporarily demote their trust level.
//
// MOBILE-FIRST:
//   Uses requestAnimationFrame + visibility API, NOT setInterval.
//   setInterval wakes the CPU on a schedule — rAF only runs when the
//   browser is painting, which respects battery life on mobile.
//
// SESSION-SCOPED:
//   All signals reset on mount. A confused session doesn't follow the
//   user into their next session.
//
// SIGNALS:
//   - avg_screen_pause: user inactive >30s (no touch/click/scroll)
//   - back_button_rate: >30% of navigations are back button presses
//
// USAGE:
//   const { shouldDemote } = useBehavioralSignals();
//   // Pass shouldDemote into calculateTrustLevel()
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  analyzeSignals,
  recordPause,
  recordNavigation,
  emptySignals,
  type RawSignals,
  type SignalAnalysis,
} from '@/lib/oracle/trust/behavioral-signals';

// Re-analyze every N frames — not every frame (expensive)
const ANALYZE_EVERY_MS = 5000;

export function useBehavioralSignals() {
  const [analysis, setAnalysis] = useState<SignalAnalysis>({
    avgPauseSeconds: 0,
    backButtonRate: 0,
    shouldDemote: false,
    demotionReason: null,
  });

  const rawRef     = useRef<RawSignals>(emptySignals());
  const rafRef     = useRef<number | null>(null);
  const lastRafMs  = useRef<number>(0);

  // Interaction tracking
  const lastInteractionMs = useRef<number>(Date.now());
  const pauseStartMs      = useRef<number | null>(null);

  // ── Mark user as active ────────────────────────────────────────────
  const markActive = useCallback(() => {
    const now = Date.now();

    // If we had a pause in progress, record it
    if (pauseStartMs.current !== null) {
      const pauseDuration = now - pauseStartMs.current;
      if (pauseDuration > 2000) { // only record pauses > 2s
        rawRef.current = recordPause(rawRef.current, pauseDuration);
      }
      pauseStartMs.current = null;
    }

    lastInteractionMs.current = now;
  }, []);

  // ── rAF loop — checks for pause threshold ─────────────────────────
  const rafLoop = useCallback((timestamp: number) => {
    const now = Date.now();
    const sinceInteraction = now - lastInteractionMs.current;

    // Start tracking a pause if user has been idle > 2s
    if (sinceInteraction > 2000 && pauseStartMs.current === null) {
      pauseStartMs.current = lastInteractionMs.current;
    }

    // Re-analyze signals every ANALYZE_EVERY_MS
    if (now - lastRafMs.current > ANALYZE_EVERY_MS) {
      lastRafMs.current = now;

      // If still in a pause, snapshot it for analysis
      const snapshotRaw = pauseStartMs.current !== null
        ? recordPause(rawRef.current, now - pauseStartMs.current)
        : rawRef.current;

      const result = analyzeSignals(snapshotRaw);
      setAnalysis(result);

      if (result.demotionReason) {
        console.debug('[TrustEscalation] Behavioral demotion signal:', result.demotionReason);
      }
    }

    rafRef.current = requestAnimationFrame(rafLoop);
  }, []);

  // ── Popstate — back button ─────────────────────────────────────────
  const handlePopState = useCallback(() => {
    rawRef.current = recordNavigation(rawRef.current, true);
    markActive();
  }, [markActive]);

  // ── Forward navigation (pushState wrapper) ─────────────────────────
  // React Router calls history.pushState — we patch it once to count forwards.
  useEffect(() => {
    const originalPush = history.pushState.bind(history);
    history.pushState = (...args) => {
      rawRef.current = recordNavigation(rawRef.current, false);
      return originalPush(...args);
    };
    return () => {
      history.pushState = originalPush;
    };
  }, []);

  // ── Mount / unmount ────────────────────────────────────────────────
  useEffect(() => {
    // Interaction events — touch + mouse (covers mobile + desktop)
    const interactionEvents = ['touchstart', 'touchmove', 'click', 'scroll', 'keydown'];
    interactionEvents.forEach(e => window.addEventListener(e, markActive, { passive: true }));

    // Back button
    window.addEventListener('popstate', handlePopState);

    // Start rAF loop
    rafRef.current = requestAnimationFrame(rafLoop);

    return () => {
      interactionEvents.forEach(e => window.removeEventListener(e, markActive));
      window.removeEventListener('popstate', handlePopState);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [markActive, handlePopState, rafLoop]);

  return {
    shouldDemote: analysis.shouldDemote,
    avgPauseSeconds: analysis.avgPauseSeconds,
    backButtonRate: analysis.backButtonRate,
    demotionReason: analysis.demotionReason,
  };
}