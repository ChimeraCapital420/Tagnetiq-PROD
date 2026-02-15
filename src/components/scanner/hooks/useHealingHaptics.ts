// FILE: src/components/scanner/hooks/useHealingHaptics.ts
// Tier-aware haptic feedback synced to SSE analysis events
//
// Design philosophy: Less is more. Apple-style — you'd miss it if it were gone.
// The gaps between pulses are what make it feel premium.
// Total motor-on time: ~1-2 seconds across a 20-second analysis = 0.003% battery
//
// Tier structure:
//   Free:   Capture buzz + completion buzz (2 moments, already exists)
//   Pro:    Stage-aware — soft pulse per AI model + market data arrival
//   Oracle: Full healing rhythm — heartbeat synced to cymatics, confidence
//           intensifies the pattern, warm sustained reward on completion
//
// Mobile-first: All patterns use navigator.vibrate() — no timers, no loops.
// Fires on SSE events from useAnalysisSubmit, not on its own schedule.
// Zero battery impact beyond the vibration motor itself.

import { useCallback, useRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type HapticTier = 'free' | 'pro' | 'oracle';

export interface UseHealingHapticsOptions {
  /** User's current tier — controls which patterns are available */
  tier?: HapticTier;
  /** Globally disable haptics (e.g., user preference) */
  enabled?: boolean;
}

export interface UseHealingHapticsReturn {
  /** Fire haptic for photo/barcode capture */
  capture: () => void;
  /** Fire haptic for ghost mode capture */
  ghostCapture: () => void;
  /** Fire haptic when analysis starts submitting */
  analysisStart: () => void;
  /** Fire haptic when an AI model begins thinking */
  aiModelStart: (modelIndex: number) => void;
  /** Fire haptic when an AI model completes */
  aiModelComplete: (success: boolean) => void;
  /** Fire haptic when price estimate updates */
  priceUpdate: (confidence: number) => void;
  /** Fire haptic when a market API starts checking */
  marketApiStart: () => void;
  /** Fire haptic when a market API completes */
  marketApiComplete: (success: boolean) => void;
  /** Fire haptic for phase transitions (ai → market → finalizing) */
  phaseTransition: (phase: string) => void;
  /** Fire haptic for analysis complete — the reward moment */
  analysisComplete: (decision: string) => void;
  /** Fire haptic for analysis error */
  analysisError: () => void;
  /** Fire a heartbeat pulse (Oracle tier — synced to cymatics breathing) */
  heartbeat: (intensity: number) => void;
  /** Generic UI tap (button press, toggle, mode switch) */
  tap: () => void;
}

// =============================================================================
// VIBRATION PATTERNS
// Each number is milliseconds: [vibrate, pause, vibrate, pause, ...]
// Keep patterns SHORT — the gaps are what make it feel premium
// =============================================================================

const PATTERNS = {
  // ── FREE TIER ──────────────────────────────────────────
  // These two moments are all free users get
  capture: [50],                          // Clean single tap — camera shutter feel
  completionBasic: [40, 60, 80],          // Simple done signal

  // ── PRO TIER ──────────────────────────────────────────
  // Stage-aware — one pulse per AI model, market data awareness
  ghostCapture: [30, 40, 30, 40, 60],    // Quick double-tap + lingering buzz
  analysisStart: [20, 30, 20],            // Subtle "acknowledged" — not intrusive
  aiThinking: [15],                       // Barely-there tick — "I see a dot light up"
  aiComplete: [30, 20, 40],              // Gentle confirmation — model reported in
  aiFailed: [10, 20, 10, 20, 10],        // Quick stutter — something didn't work
  priceUpdate: [25, 40, 35],             // Slightly different rhythm — money pulse
  marketStart: [15],                      // Subtle tick — "checking another source"
  marketComplete: [20, 30, 25],          // Data arrived
  phaseAi: [30, 50, 20],                // AI consensus phase beginning
  phaseMarket: [20, 40, 30, 40, 20],    // Market data phase — wider rhythm
  phaseFinalizing: [40, 30, 40],         // Tightening up — almost done

  // ── ORACLE TIER ────────────────────────────────────────
  // Full healing rhythm — synced to cymatic breathing animation
  // These patterns feel "organic" — intentionally non-mechanical
  heartbeatLight: [20, 120, 30],         // Resting heartbeat — low confidence
  heartbeatMedium: [30, 80, 45],         // Building confidence — slightly stronger
  heartbeatStrong: [45, 60, 60],         // High confidence — warm and present
  heartbeatPeak: [60, 40, 80],           // Near-certain — deep resonance

  // Decision-specific completion rewards (Oracle only)
  completeBuy: [40, 30, 60, 30, 80, 50, 40],    // Rising crescendo — excitement
  completeSell: [50, 40, 70, 60, 50],             // Steady confidence — good call
  completeHold: [30, 50, 40, 80, 30],             // Contemplative pause — patience
  completePass: [25, 40, 25],                      // Quick acknowledgment — move on

  // ── UNIVERSAL ──────────────────────────────────────────
  tap: [10],                              // Micro-tap for any UI interaction
  error: [80, 40, 80, 40, 80],           // Unmistakable "something went wrong"
} as const;

// =============================================================================
// HELPERS
// =============================================================================

/** Check if vibration API is available (mobile devices) */
function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/** Check if user prefers reduced motion */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/** Fire a vibration pattern — the single exit point for all haptics */
function vibrate(pattern: readonly number[] | number[]): void {
  if (!canVibrate()) return;
  // Reduced motion: only fire for essential feedback (capture + complete)
  // The caller decides what's essential via the tier gating
  try {
    navigator.vibrate([...pattern]);
  } catch {
    // Vibrate can throw on some browsers — never crash for haptics
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useHealingHaptics(
  options: UseHealingHapticsOptions = {}
): UseHealingHapticsReturn {
  const { tier = 'free', enabled = true } = options;

  // Track reduced motion preference (check once, not every vibration)
  const reducedMotion = useRef<boolean | null>(null);
  const getReducedMotion = useCallback(() => {
    if (reducedMotion.current === null) {
      reducedMotion.current = prefersReducedMotion();
    }
    return reducedMotion.current;
  }, []);

  // Gate check: should this tier get this level of feedback?
  const isPro = tier === 'pro' || tier === 'oracle';
  const isOracle = tier === 'oracle';

  // ── FREE TIER: Capture + Completion only ────────────────

  const capture = useCallback(() => {
    if (!enabled) return;
    vibrate(PATTERNS.capture);
  }, [enabled]);

  const ghostCapture = useCallback(() => {
    if (!enabled) return;
    if (isPro) {
      vibrate(PATTERNS.ghostCapture);
    } else {
      vibrate(PATTERNS.capture);
    }
  }, [enabled, isPro]);

  // ── PRO TIER: Stage-aware pulses ────────────────────────

  const analysisStart = useCallback(() => {
    if (!enabled || !isPro) return;
    vibrate(PATTERNS.analysisStart);
  }, [enabled, isPro]);

  const aiModelStart = useCallback(
    (_modelIndex: number) => {
      if (!enabled || !isPro) return;
      vibrate(PATTERNS.aiThinking);
    },
    [enabled, isPro]
  );

  const aiModelComplete = useCallback(
    (success: boolean) => {
      if (!enabled || !isPro) return;
      vibrate(success ? PATTERNS.aiComplete : PATTERNS.aiFailed);
    },
    [enabled, isPro]
  );

  const priceUpdate = useCallback(
    (_confidence: number) => {
      if (!enabled || !isPro) return;
      // Only fire if confidence is meaningful (avoid spamming on every tiny update)
      vibrate(PATTERNS.priceUpdate);
    },
    [enabled, isPro]
  );

  const marketApiStart = useCallback(() => {
    if (!enabled || !isPro) return;
    vibrate(PATTERNS.marketStart);
  }, [enabled, isPro]);

  const marketApiComplete = useCallback(
    (success: boolean) => {
      if (!enabled || !isPro) return;
      if (success) {
        vibrate(PATTERNS.marketComplete);
      }
      // Silent on market failure — not important enough to buzz for
    },
    [enabled, isPro]
  );

  const phaseTransition = useCallback(
    (phase: string) => {
      if (!enabled || !isPro) return;
      switch (phase) {
        case 'ai':
        case 'ai_consensus':
          vibrate(PATTERNS.phaseAi);
          break;
        case 'market':
        case 'market_data':
          vibrate(PATTERNS.phaseMarket);
          break;
        case 'finalizing':
          vibrate(PATTERNS.phaseFinalizing);
          break;
      }
    },
    [enabled, isPro]
  );

  // ── ORACLE TIER: Healing rhythm + decision-aware completion ──

  const heartbeat = useCallback(
    (intensity: number) => {
      if (!enabled || !isOracle) return;
      if (getReducedMotion()) return; // Heartbeat is non-essential — skip if reduced motion

      // Map confidence (0-1) to heartbeat intensity
      if (intensity < 0.3) {
        vibrate(PATTERNS.heartbeatLight);
      } else if (intensity < 0.6) {
        vibrate(PATTERNS.heartbeatMedium);
      } else if (intensity < 0.85) {
        vibrate(PATTERNS.heartbeatStrong);
      } else {
        vibrate(PATTERNS.heartbeatPeak);
      }
    },
    [enabled, isOracle, getReducedMotion]
  );

  const analysisComplete = useCallback(
    (decision: string) => {
      if (!enabled) return;

      // Free tier: basic completion buzz
      if (!isPro) {
        vibrate(PATTERNS.completionBasic);
        return;
      }

      // Pro tier: same basic completion
      if (!isOracle) {
        vibrate(PATTERNS.completionBasic);
        return;
      }

      // Oracle tier: decision-specific reward patterns
      switch (decision?.toUpperCase()) {
        case 'BUY':
          vibrate(PATTERNS.completeBuy);
          break;
        case 'SELL':
          vibrate(PATTERNS.completeSell);
          break;
        case 'HOLD':
          vibrate(PATTERNS.completeHold);
          break;
        case 'PASS':
          vibrate(PATTERNS.completePass);
          break;
        default:
          vibrate(PATTERNS.completionBasic);
      }
    },
    [enabled, isPro, isOracle]
  );

  const analysisError = useCallback(() => {
    if (!enabled) return;
    // Error feedback is universal — all tiers should feel something went wrong
    vibrate(PATTERNS.error);
  }, [enabled]);

  const tap = useCallback(() => {
    if (!enabled || !isPro) return;
    if (getReducedMotion()) return;
    vibrate(PATTERNS.tap);
  }, [enabled, isPro, getReducedMotion]);

  return {
    capture,
    ghostCapture,
    analysisStart,
    aiModelStart,
    aiModelComplete,
    priceUpdate,
    marketApiStart,
    marketApiComplete,
    phaseTransition,
    analysisComplete,
    analysisError,
    heartbeat,
    tap,
  };
}

export default useHealingHaptics;