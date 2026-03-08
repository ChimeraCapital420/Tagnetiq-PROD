// FILE: src/lib/oracle/trust/behavioral-signals.ts
// ═══════════════════════════════════════════════════════════════════════
// Behavioral Signal Detectors — Pure Functions
// ═══════════════════════════════════════════════════════════════════════
//
// No React. No side effects. Takes raw signal data, returns analysis.
// These are called by useBehavioralSignals.ts which owns the DOM events.
//
// SIGNALS TRACKED:
//   avg_screen_pause  — user staring at a screen without acting
//                       >30s average suggests confusion
//   back_button_rate  — how often they undo navigation
//                       >0.3 (30%) suggests they keep going wrong places
//
// DEMOTION THRESHOLD:
//   Either signal alone triggers demotion. This is conservative — it's
//   better to give a confused Pro extra hand-holding for one session than
//   to overwhelm an Explorer trying to act like a Pro.
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export interface RawSignals {
  /** Total pause duration in ms since session start */
  totalPauseMs: number;
  /** Number of pause events recorded */
  pauseCount: number;
  /** Number of back navigation events (popstate / back button taps) */
  backCount: number;
  /** Total navigation events (forward + back) */
  navCount: number;
}

export interface SignalAnalysis {
  /** Average pause duration in seconds */
  avgPauseSeconds: number;
  /** Back button rate (0–1) */
  backButtonRate: number;
  /** True when either threshold is breached */
  shouldDemote: boolean;
  /** Human-readable reason for demotion (for debug/logging only) */
  demotionReason: string | null;
}

// =============================================================================
// THRESHOLDS
// =============================================================================

const PAUSE_THRESHOLD_SECONDS = 30;
const BACK_RATE_THRESHOLD = 0.3;

// Minimum data points before we trust the signal
const MIN_PAUSE_EVENTS = 3;
const MIN_NAV_EVENTS = 5;

// =============================================================================
// ANALYSIS
// =============================================================================

export function analyzeSignals(raw: RawSignals): SignalAnalysis {
  const avgPauseSeconds = raw.pauseCount >= MIN_PAUSE_EVENTS
    ? raw.totalPauseMs / raw.pauseCount / 1000
    : 0;

  const backButtonRate = raw.navCount >= MIN_NAV_EVENTS
    ? raw.backCount / raw.navCount
    : 0;

  const longPause = avgPauseSeconds > PAUSE_THRESHOLD_SECONDS;
  const highBackRate = backButtonRate > BACK_RATE_THRESHOLD;

  let demotionReason: string | null = null;
  if (longPause && highBackRate) {
    demotionReason = `avg pause ${avgPauseSeconds.toFixed(0)}s + back rate ${(backButtonRate * 100).toFixed(0)}%`;
  } else if (longPause) {
    demotionReason = `avg pause ${avgPauseSeconds.toFixed(0)}s (threshold: ${PAUSE_THRESHOLD_SECONDS}s)`;
  } else if (highBackRate) {
    demotionReason = `back rate ${(backButtonRate * 100).toFixed(0)}% (threshold: ${BACK_RATE_THRESHOLD * 100}%)`;
  }

  return {
    avgPauseSeconds,
    backButtonRate,
    shouldDemote: longPause || highBackRate,
    demotionReason,
  };
}

/**
 * Record a pause event. Call when user stops interacting.
 * Returns updated raw signals.
 */
export function recordPause(
  raw: RawSignals,
  durationMs: number,
): RawSignals {
  return {
    ...raw,
    totalPauseMs: raw.totalPauseMs + durationMs,
    pauseCount: raw.pauseCount + 1,
  };
}

/**
 * Record a navigation event.
 * @param isBack - true for back button / popstate, false for forward nav
 */
export function recordNavigation(
  raw: RawSignals,
  isBack: boolean,
): RawSignals {
  return {
    ...raw,
    backCount: isBack ? raw.backCount + 1 : raw.backCount,
    navCount: raw.navCount + 1,
  };
}

export function emptySignals(): RawSignals {
  return {
    totalPauseMs: 0,
    pauseCount: 0,
    backCount: 0,
    navCount: 0,
  };
}