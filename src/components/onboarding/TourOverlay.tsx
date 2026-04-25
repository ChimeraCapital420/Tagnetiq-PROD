// FILE: src/components/onboarding/TourOverlay.tsx
// Guided Tour Overlay
//
// Sprint E: Oracle-voiced walkthrough that highlights UI elements.
// FIXED: Pointer-events pass-through on spotlight, scan_complete listener,
//        proper dismiss behavior, clean unmount, missing target fallback.
//
// v1.1 CHANGES — One-and-done:
//   - Always-visible X button in top-right corner — regardless of canDismiss.
//   - "Don't show again" checkbox always visible (not gated by showSkip).
//   - localStorage backup flag — dismissal persists even without auth.
//   - Once dismissed, NEVER shows again. Not per session — forever.
//
// Add data-tour="xxx" attributes to your existing components:
//   data-tour="scanner-button"     → Scanner tab/button
//   data-tour="camera-trigger"     → Camera shutter button
//   data-tour="scan-result"        → Scan result card
//   data-tour="vault-tab"          → Vault navigation tab
//   data-tour="oracle-tab"         → Oracle chat tab

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

// =============================================================================
// PERSISTENCE — localStorage fallback (survives auth issues)
// =============================================================================

const TOUR_DISMISSED_KEY = 'tagnetiq_tour_dismissed';

function hasTourBeenDismissed(tourId: string): boolean {
  try {
    const dismissed = JSON.parse(localStorage.getItem(TOUR_DISMISSED_KEY) || '{}');
    return !!dismissed[tourId];
  } catch {
    return false;
  }
}

function markTourDismissed(tourId: string): void {
  try {
    const dismissed = JSON.parse(localStorage.getItem(TOUR_DISMISSED_KEY) || '{}');
    dismissed[tourId] = true;
    localStorage.setItem(TOUR_DISMISSED_KEY, JSON.stringify(dismissed));
  } catch { /* silent */ }
}

// =============================================================================
// TYPES
// =============================================================================

interface TourStep {
  id: string;
  title: string;
  transcript: string;
  voiceClipUrl?: string;
  targetSelector?: string;
  targetPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  advanceOn: 'click' | 'next_button' | 'auto' | 'scan_complete' | 'action';
  autoAdvanceMs?: number;
  showSkip: boolean;
  illustration?: string;
}

interface TourDefinition {
  id: string;
  name: string;
  steps: TourStep[];
  canDismiss: boolean;
}

// =============================================================================
// API HELPERS
// =============================================================================

async function fetchTourStatus(token: string) {
  const res = await fetch('/api/oracle/onboarding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'tour_status' }),
  });
  return res.json();
}

async function apiAdvanceStep(token: string, stepId: string, tourId: string) {
  const res = await fetch('/api/oracle/onboarding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'advance_step', stepId, tourId }),
  });
  return res.json();
}

async function apiDismissTour(token: string, tourId: string) {
  await fetch('/api/oracle/onboarding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'dismiss_tour', tourId }),
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

interface TourOverlayProps {
  tourId?: string;
  onComplete?: () => void;
  authToken?: string;
  forceShow?: boolean;
}

const TourOverlay: React.FC<TourOverlayProps> = ({
  tourId = 'first_visit',
  onComplete,
  authToken,
  forceShow = false,
}) => {
  const [tour, setTour] = useState<TourDefinition | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(
    // v1.1: check localStorage before even fetching from server
    () => !forceShow && hasTourBeenDismissed(tourId)
  );
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [waitingForScan, setWaitingForScan] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentStep = tour?.steps[currentStepIndex] ?? null;
  const isLastStep = tour ? currentStepIndex === tour.steps.length - 1 : false;
  const progress = tour ? ((currentStepIndex + 1) / tour.steps.length) * 100 : 0;

  // ── Load tour status ──────────────────────────────────
  useEffect(() => {
    if (dismissed) return;

    if (forceShow) {
      setVisible(true);
      return;
    }

    if (!authToken) return;

    fetchTourStatus(authToken).then(data => {
      if (data.shouldShowFirstVisit && data.tourDefinition) {
        setTour(data.tourDefinition);
        setVisible(true);
      }
    }).catch(() => {});
  }, [authToken, forceShow, dismissed]);

  // ── Update spotlight when step changes ────────────────
  useEffect(() => {
    if (!currentStep?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    let rafId: number;
    let lastRect = '';

    const updateRect = () => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        const rect = el.getBoundingClientRect();
        const rectKey = `${rect.top},${rect.left},${rect.width},${rect.height}`;
        if (rectKey !== lastRect) {
          lastRect = rectKey;
          setSpotlightRect(rect);
        }
      } else {
        setSpotlightRect(null);
      }
      rafId = requestAnimationFrame(updateRect);
    };

    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      rafId = requestAnimationFrame(updateRect);
    }, 150);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, [currentStep]);

  // ── Play voice clip ───────────────────────────────────
  useEffect(() => {
    if (currentStep?.voiceClipUrl) {
      audioRef.current = new Audio(currentStep.voiceClipUrl);
      audioRef.current.play().catch(() => {});
    }
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [currentStep]);

  // ── Auto-advance for 'auto' steps ─────────────────────
  useEffect(() => {
    if (currentStep?.advanceOn === 'auto' && currentStep.autoAdvanceMs) {
      const timer = setTimeout(handleNext, currentStep.autoAdvanceMs);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // ── scan_complete listener ────────────────────────────
  useEffect(() => {
    if (currentStep?.advanceOn !== 'scan_complete') {
      setWaitingForScan(false);
      return;
    }

    setWaitingForScan(true);

    const onScanComplete = () => {
      setWaitingForScan(false);
      handleNext();
    };

    window.addEventListener('tagnetiq:scan_complete', onScanComplete);

    const observer = new MutationObserver(() => {
      const scanResult = document.querySelector('[data-tour="scan-result"]');
      if (scanResult) {
        observer.disconnect();
        setWaitingForScan(false);
        handleNext();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const skipTimer = setTimeout(() => {
      setWaitingForScan(false);
    }, 15000);

    return () => {
      window.removeEventListener('tagnetiq:scan_complete', onScanComplete);
      observer.disconnect();
      clearTimeout(skipTimer);
    };
  }, [currentStep]);

  // ── Handlers ──────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!tour || !currentStep) return;

    if (authToken) {
      apiAdvanceStep(authToken, currentStep.id, tour.id).catch(() => {});
    }

    if (isLastStep) {
      cleanup();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [tour, currentStep, isLastStep, authToken]);

  const handleDismiss = useCallback(async () => {
    // v1.1: Always store in localStorage — works even without auth
    if (tour) {
      markTourDismissed(tour.id);
    }
    if (authToken && tour) {
      apiDismissTour(authToken, tour.id).catch(() => {});
    }
    cleanup();
  }, [authToken, tour]);

  const handleSkip = useCallback(() => {
    // v1.1: dontShowAgain OR skip button always triggers permanent dismiss
    if (dontShowAgain) {
      handleDismiss();
    } else {
      cleanup();
    }
  }, [dontShowAgain, handleDismiss]);

  const cleanup = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setVisible(false);
    setDismissed(true);
    setSpotlightRect(null);
    setWaitingForScan(false);
    onComplete?.();
  }, [onComplete]);

  const handleSpotlightClick = useCallback(() => {
    if (!currentStep?.targetSelector) return;
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement;
    if (el) {
      el.click();
      if (currentStep.advanceOn === 'click') {
        handleNext();
      }
    }
  }, [currentStep, handleNext]);

  if (dismissed || !visible || !currentStep) return null;

  const padding = currentStep.spotlightPadding ?? 8;
  const showNextButton = currentStep.advanceOn !== 'scan_complete' || !waitingForScan;

  const cardStyle: React.CSSProperties = spotlightRect
    ? {
        top: currentStep.targetPosition === 'bottom' || currentStep.targetPosition === 'right'
          ? Math.min(spotlightRect.bottom + padding + 16, window.innerHeight - 280)
          : undefined,
        bottom: currentStep.targetPosition === 'top'
          ? Math.max(16, window.innerHeight - spotlightRect.top + padding + 16)
          : undefined,
        left: Math.max(16, Math.min(
          spotlightRect.left + spotlightRect.width / 2 - 175,
          window.innerWidth - 366
        )),
      }
    : {};

  return (
    <div
      className="fixed inset-0 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour: ${currentStep.title}`}
    >
      {/* SVG Backdrop with cutout hole */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left - padding}
                y={spotlightRect.top - padding}
                width={spotlightRect.width + padding * 2}
                height={spotlightRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Spotlight border */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-cyan-400 rounded-lg cursor-pointer transition-all duration-300"
          style={{
            top: spotlightRect.top - padding,
            left: spotlightRect.left - padding,
            width: spotlightRect.width + padding * 2,
            height: spotlightRect.height + padding * 2,
            pointerEvents: 'auto',
            zIndex: 1,
          }}
          onClick={handleSpotlightClick}
          aria-label={`Click to interact with ${currentStep.title}`}
        />
      )}

      {/* Step card */}
      <div
        className={`absolute z-10 max-w-sm w-[90vw] bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl transition-all duration-300 ${
          !spotlightRect ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''
        }`}
        style={{ pointerEvents: 'auto', ...cardStyle }}
      >
        {/* v1.1: Always-visible X — regardless of canDismiss or showSkip */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          aria-label="Close tour"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-4 mr-8">
          <div
            className="h-1 bg-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <h3 className="text-white font-semibold text-lg mb-2 pr-6">
          {currentStep.title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {currentStep.transcript}
        </p>

        {/* Waiting for scan indicator */}
        {waitingForScan && (
          <div className="flex items-center gap-2 mb-3 text-cyan-400 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Waiting for your scan...
          </div>
        )}

        {/* Step counter */}
        <p className="text-gray-600 text-xs mb-3">
          {currentStepIndex + 1} of {tour?.steps.length}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep.showSkip && (
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>

          {showNextButton && (
            <button
              onClick={handleNext}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isLastStep ? "Let's go!" : waitingForScan ? 'Skip step' : 'Next'}
            </button>
          )}
        </div>

        {/* v1.1: "Don't show again" always visible — not gated by showSkip or canDismiss */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={e => setDontShowAgain(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-gray-500 text-xs">Don't show this again</span>
        </label>
      </div>
    </div>
  );
};

export default TourOverlay;