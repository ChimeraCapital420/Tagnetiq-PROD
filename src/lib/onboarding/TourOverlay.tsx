// FILE: src/components/onboarding/TourOverlay.tsx
// Tour Overlay — v2.0
//
// Sprint E → F: Event-driven tour manager with Oracle personality.
//
// FIXED from v1:
//   ✅ Pointer-events pass-through on spotlight (SVG cutout approach)
//   ✅ scan_complete listener works correctly (event-driven, not auto-advance)
//   ✅ Proper dismiss/cleanup — no blocking overlay after tour ends
//   ✅ Missing target fallback — centers card if element not found
//   ✅ RAF-based spotlight tracking — handles scroll, resize, layout shifts
//   ✅ Mobile-first card positioning — never clips off screen
//
// NEW in v2:
//   ✅ Choice steps — user picks their first task (multiple choice UI)
//   ✅ {{screenName}} interpolation in transcripts
//   ✅ Event-driven tour chaining — listens for scanner-opened, scan-complete
//   ✅ Tour manager — handles multiple sequential tours, not just one
//   ✅ onAction callback — communicates user choices back to App.tsx
//
// EVENTS LISTENED:
//   tagnetiq:scanner-opened       → triggers first_scan tour
//   tagnetiq:first-scan-complete  → triggers first_results tour
//
// EVENTS DISPATCHED:
//   tagnetiq:tour-action          → { action, navigateTo, triggersTour }
//   tagnetiq:tour-complete        → { tourId }

import React, { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES (mirrored from tour.ts for frontend — avoids server import)
// =============================================================================

interface TourChoice {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: 'open_scanner' | 'navigate' | 'next_step';
  navigateTo?: string;
  triggersTour?: string;
}

interface TourStep {
  id: string;
  title: string;
  transcript: string;
  voiceClipUrl?: string;
  targetSelector?: string;
  targetPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  advanceOn: 'click' | 'next_button' | 'auto' | 'scan_complete' | 'action' | 'choice';
  autoAdvanceMs?: number;
  showSkip: boolean;
  illustration?: string;
  choices?: TourChoice[];
}

interface TourDefinition {
  id: string;
  name: string;
  steps: TourStep[];
  canDismiss: boolean;
  triggeredBy?: string;
  triggerEvent?: string;
}

// =============================================================================
// API HELPERS
// =============================================================================

async function fetchTourStatus(token: string): Promise<any> {
  try {
    const res = await fetch('/api/oracle/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: 'tour_status' }),
    });
    return res.json();
  } catch {
    return {};
  }
}

async function apiAdvanceStep(token: string, stepId: string, tourId: string): Promise<void> {
  fetch('/api/oracle/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'advance_step', stepId, tourId }),
  }).catch(() => {});
}

async function apiDismissTour(token: string, tourId: string): Promise<void> {
  fetch('/api/oracle/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'dismiss_tour', tourId }),
  }).catch(() => {});
}

// =============================================================================
// HELPERS
// =============================================================================

/** Replace {{screenName}} in transcript */
function interpolate(text: string, screenName: string): string {
  return text.replace(/\{\{screenName\}\}/g, screenName || 'friend');
}

/** Clamp a value between min and max */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// =============================================================================
// COMPONENT
// =============================================================================

interface TourOverlayProps {
  /** User's display name for Oracle greeting */
  screenName?: string;
  /** Supabase auth token */
  authToken?: string;
  /** Called when any tour completes */
  onTourComplete?: (tourId: string) => void;
  /** Called when user picks a choice action (open_scanner, navigate, etc.) */
  onAction?: (action: string, payload?: { navigateTo?: string; triggersTour?: string }) => void;
  /** Force show a specific tour (ignores server status) */
  forceTourId?: string;
}

const TourOverlay: React.FC<TourOverlayProps> = ({
  screenName = 'friend',
  authToken,
  onTourComplete,
  onAction,
  forceTourId,
}) => {
  // ── State ─────────────────────────────────────────────
  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Track which tours have been shown this session (prevents double-show)
  const shownToursRef = useRef<Set<string>>(new Set());
  // Track which tours the server says are available
  const availableToursRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const step = tour?.steps[stepIndex] ?? null;
  const isLastStep = tour ? stepIndex === tour.steps.length - 1 : false;
  const progress = tour ? ((stepIndex + 1) / tour.steps.length) * 100 : 0;

  // ── Load initial tour status from server ──────────────
  useEffect(() => {
    mountedRef.current = true;

    if (forceTourId) {
      // Manually triggered tour (e.g., from settings "replay tour")
      fetchTourData(forceTourId);
      return;
    }

    if (!authToken) return;

    fetchTourStatus(authToken).then(data => {
      if (!mountedRef.current) return;

      // Build available set from server
      if (data.shouldShowFirstVisit) {
        availableToursRef.current.add('welcome_intro');
      }
      // Check other tours
      if (data.availableTours) {
        for (const t of data.availableTours) {
          if (t.status === 'available') availableToursRef.current.add(t.id);
        }
      }

      // Auto-start welcome_intro if available
      if (availableToursRef.current.has('welcome_intro') && !shownToursRef.current.has('welcome_intro')) {
        fetchTourData('welcome_intro');
      }
    }).catch(() => {});

    return () => { mountedRef.current = false; };
  }, [authToken, forceTourId]);

  // ── Fetch tour definition and show it ─────────────────
  const fetchTourData = useCallback((tourId: string) => {
    // Dynamic import of TOURS would be ideal but for now we
    // fetch from the API or use a local copy sent with tour_status
    if (authToken) {
      fetch('/api/oracle/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action: 'start_tour', tourId }),
      })
        .then(r => r.json())
        .then(data => {
          if (!mountedRef.current) return;
          if (data.tour) {
            shownToursRef.current.add(tourId);
            setTour(data.tour);
            setStepIndex(0);
            setDismissed(false);
            setDontShowAgain(false);
            setVisible(true);
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  // ── Listen for tour-triggering events ─────────────────
  useEffect(() => {
    const handleScannerOpened = () => {
      if (!shownToursRef.current.has('first_scan') && availableToursRef.current.has('first_scan')) {
        // Small delay to let scanner DOM render
        setTimeout(() => fetchTourData('first_scan'), 600);
      }
    };

    const handleScanComplete = () => {
      if (!shownToursRef.current.has('first_results') && availableToursRef.current.has('first_results')) {
        // Delay to let results card animate in
        setTimeout(() => fetchTourData('first_results'), 800);
      }
    };

    window.addEventListener('tagnetiq:scanner-opened', handleScannerOpened);
    window.addEventListener('tagnetiq:first-scan-complete', handleScanComplete);

    return () => {
      window.removeEventListener('tagnetiq:scanner-opened', handleScannerOpened);
      window.removeEventListener('tagnetiq:first-scan-complete', handleScanComplete);
    };
  }, [fetchTourData]);

  // ── RAF spotlight tracking ────────────────────────────
  // Continuously tracks target element position to handle scroll/resize
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);

    if (!step?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    let lastKey = '';

    const track = () => {
      const el = document.querySelector(step.targetSelector!);
      if (el) {
        const rect = el.getBoundingClientRect();
        const key = `${rect.top|0},${rect.left|0},${rect.width|0},${rect.height|0}`;
        if (key !== lastKey) {
          lastKey = key;
          setSpotlightRect(rect);
        }
      } else {
        if (lastKey !== 'none') {
          lastKey = 'none';
          setSpotlightRect(null);
        }
      }
      rafRef.current = requestAnimationFrame(track);
    };

    // Small delay for DOM to settle after step change
    const timer = setTimeout(() => {
      // Scroll target into view first
      const el = document.querySelector(step.targetSelector!);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      track();
    }, 150);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [step]);

  // ── Voice playback ────────────────────────────────────
  useEffect(() => {
    if (step?.voiceClipUrl) {
      const audio = new Audio(step.voiceClipUrl);
      audio.play().catch(() => {});
      audioRef.current = audio;
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [step]);

  // ── Auto-advance (for 'auto' steps) ──────────────────
  useEffect(() => {
    if (step?.advanceOn === 'auto' && step.autoAdvanceMs) {
      const timer = setTimeout(() => handleNext(), step.autoAdvanceMs);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ── Handlers ──────────────────────────────────────────

  const handleNext = useCallback(() => {
    if (!tour || !step) return;

    // Persist to server (non-blocking)
    if (authToken) apiAdvanceStep(authToken, step.id, tour.id);

    if (isLastStep) {
      // Tour complete — make chained follow-up tours available
      const FOLLOW_UPS: Record<string, string[]> = {
        welcome_intro: ['first_scan', 'control_panel'],
        first_scan: ['first_results'],
      };
      const nextTours = FOLLOW_UPS[tour.id] || [];
      for (const nextId of nextTours) {
        availableToursRef.current.add(nextId);
      }

      setVisible(false);
      setTour(null);
      onTourComplete?.(tour.id);
      window.dispatchEvent(new CustomEvent('tagnetiq:tour-complete', { detail: { tourId: tour.id } }));
    } else {
      setStepIndex(prev => prev + 1);
    }
  }, [tour, step, isLastStep, authToken, onTourComplete]);

  const handleDismiss = useCallback(() => {
    if (!tour) return;
    if (authToken) apiDismissTour(authToken, tour.id);
    setVisible(false);
    setDismissed(true);
    setTour(null);
    onTourComplete?.(tour.id);
  }, [tour, authToken, onTourComplete]);

  const handleSkip = useCallback(() => {
    if (dontShowAgain) {
      handleDismiss();
    } else {
      // Skip just this tour but don't permanently dismiss
      setVisible(false);
      setTour(null);
    }
  }, [dontShowAgain, handleDismiss]);

  const handleChoice = useCallback((choice: TourChoice) => {
    if (!tour || !step) return;

    // Persist step completion
    if (authToken) apiAdvanceStep(authToken, step.id, tour.id);

    // End this tour
    setVisible(false);
    setTour(null);

    // Mark the triggered tour as available for this session
    if (choice.triggersTour) {
      availableToursRef.current.add(choice.triggersTour);
    }

    // Execute the choice action
    onAction?.(choice.action, {
      navigateTo: choice.navigateTo,
      triggersTour: choice.triggersTour,
    });

    // Dispatch event for external listeners
    window.dispatchEvent(new CustomEvent('tagnetiq:tour-action', {
      detail: { action: choice.action, ...choice },
    }));

    onTourComplete?.(tour.id);
  }, [tour, step, authToken, onAction, onTourComplete]);

  const handleSpotlightClick = useCallback(() => {
    if (!step?.targetSelector) return;
    const el = document.querySelector(step.targetSelector) as HTMLElement;
    if (el) {
      el.click();
      if (step.advanceOn === 'click') handleNext();
    }
  }, [step, handleNext]);

  // ── Don't render if not visible ───────────────────────
  if (!visible || !step || dismissed) return null;

  // ── Layout calculations ───────────────────────────────
  const pad = step.spotlightPadding ?? 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const cardW = Math.min(350, vw - 32);  // Mobile-first: 16px margin each side

  // Card position: avoid clipping off-screen
  let cardStyle: React.CSSProperties = {};

  if (spotlightRect && step.targetPosition !== 'center') {
    const pos = step.targetPosition || 'bottom';
    const elCenterX = spotlightRect.left + spotlightRect.width / 2;
    const cardLeft = clamp(elCenterX - cardW / 2, 16, vw - cardW - 16);

    if (pos === 'bottom' || pos === 'left' || pos === 'right') {
      const top = spotlightRect.bottom + pad + 12;
      // If not enough room below, flip to above
      if (top + 260 > vh) {
        cardStyle = { bottom: vh - spotlightRect.top + pad + 12, left: cardLeft };
      } else {
        cardStyle = { top, left: cardLeft };
      }
    } else {
      // top
      const bottom = vh - spotlightRect.top + pad + 12;
      if (bottom + 260 > vh) {
        cardStyle = { top: spotlightRect.bottom + pad + 12, left: cardLeft };
      } else {
        cardStyle = { bottom, left: cardLeft };
      }
    }
  } else {
    // Center the card
    cardStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour: ${step.title}`}
    >
      {/* ── SVG Backdrop with cutout ─────────────────────
          The SVG creates a dark overlay with a transparent rectangular
          "window" over the spotlight target. The fill-rule="evenodd"
          makes the inner rect transparent. pointer-events="none" on
          the cutout lets clicks pass through to the actual element. */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White = visible (dark overlay) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black = transparent hole */}
            {spotlightRect && (
              <rect
                x={spotlightRect.left - pad}
                y={spotlightRect.top - pad}
                width={spotlightRect.width + pad * 2}
                height={spotlightRect.height + pad * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark overlay with hole */}
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* ── Spotlight border ring ────────────────────────
          Visual indicator around the highlighted element.
          pointer-events: auto so clicking it triggers the element. */}
      {spotlightRect && (
        <div
          className="absolute rounded-lg border-2 border-cyan-400/80 transition-all duration-200 cursor-pointer"
          style={{
            top: spotlightRect.top - pad,
            left: spotlightRect.left - pad,
            width: spotlightRect.width + pad * 2,
            height: spotlightRect.height + pad * 2,
            pointerEvents: 'auto',
            boxShadow: '0 0 20px rgba(34,211,238,0.15)',
          }}
          onClick={handleSpotlightClick}
          aria-label="Highlighted element — tap to interact"
        />
      )}

      {/* ── Step Card ────────────────────────────────────── */}
      <div
        className="absolute z-10 bg-gray-900/95 border border-gray-700/80 rounded-2xl p-5 shadow-2xl backdrop-blur-sm"
        style={{ ...cardStyle, width: cardW, maxHeight: vh - 32, overflowY: 'auto', pointerEvents: 'auto' }}
      >
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-4">
          <div
            className="h-1 bg-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Oracle avatar + title */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            O
          </div>
          <h3 className="text-white font-semibold text-base leading-tight">
            {step.title}
          </h3>
        </div>

        {/* Transcript */}
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {interpolate(step.transcript, screenName)}
        </p>

        {/* ── Choice Step ────────────────────────────────── */}
        {step.advanceOn === 'choice' && step.choices && (
          <div className="space-y-2 mb-4">
            {step.choices.map(choice => (
              <button
                key={choice.id}
                onClick={() => handleChoice(choice)}
                className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-700/60 bg-gray-800/50 hover:bg-gray-800 hover:border-cyan-500/40 transition-all text-left group"
              >
                <span className="text-xl mt-0.5 flex-shrink-0">{choice.icon}</span>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium group-hover:text-cyan-300 transition-colors">
                    {choice.label}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-snug">
                    {choice.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step counter */}
        <p className="text-gray-600 text-xs mb-3">
          {stepIndex + 1} of {tour?.steps.length}
        </p>

        {/* Actions row */}
        {step.advanceOn !== 'choice' && (
          <div className="flex items-center justify-between">
            <div>
              {step.showSkip && (
                <button
                  onClick={handleSkip}
                  className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
                >
                  Skip tour
                </button>
              )}
            </div>
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isLastStep ? "Let's go!" : 'Next'}
            </button>
          </div>
        )}

        {/* Skip row for choice steps */}
        {step.advanceOn === 'choice' && step.showSkip && (
          <div className="flex justify-start">
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Skip tour
            </button>
          </div>
        )}

        {/* Don't show again checkbox */}
        {step.showSkip && tour?.canDismiss && (
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <span className="text-gray-500 text-xs">Don't show this again</span>
          </label>
        )}
      </div>
    </div>
  );
};

export default TourOverlay;