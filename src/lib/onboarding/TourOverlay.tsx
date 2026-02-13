// FILE: src/components/onboarding/TourOverlay.tsx
// Guided Tour Overlay
//
// Sprint E: Oracle-voiced walkthrough that highlights UI elements.
//
// Add data-tour="xxx" attributes to your existing components:
//   data-tour="scanner-button"     → Scanner tab/button
//   data-tour="camera-trigger"     → Camera shutter button
//   data-tour="scan-result"        → Scan result card
//   data-tour="vault-tab"          → Vault navigation tab
//   data-tour="oracle-tab"         → Oracle chat tab
//   data-tour="voice-settings"     → Voice selection area
//   data-tour="share-button"       → Share button (wherever it is)
//   data-tour="oracle-preferences" → Oracle prefs section
//   data-tour="privacy-settings"   → Privacy settings section
//   data-tour="notification-settings" → Notifications section
//   data-tour="autonomy-settings"  → Autonomy controls
//   data-tour="vault-type-settings" → Vault type selector
//
// Usage:
//   import TourOverlay from '@/components/onboarding/TourOverlay';
//
//   function App() {
//     return (
//       <>
//         <YourApp />
//         <TourOverlay />
//       </>
//     );
//   }

import React, { useState, useEffect, useCallback, useRef } from 'react';

// =============================================================================
// TYPES (mirrored from tour.ts for frontend use)
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
  /** Force show the tour (ignores server status) */
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
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentStep = tour?.steps[currentStepIndex] ?? null;
  const isLastStep = tour ? currentStepIndex === tour.steps.length - 1 : false;
  const progress = tour ? ((currentStepIndex + 1) / tour.steps.length) * 100 : 0;

  // ── Load tour status ──────────────────────────────────
  useEffect(() => {
    if (forceShow) {
      // For manual trigger (e.g., from settings)
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
  }, [authToken, forceShow]);

  // ── Update spotlight when step changes ────────────────
  useEffect(() => {
    if (!currentStep?.targetSelector) {
      setSpotlightRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setSpotlightRect(null);
    }
  }, [currentStep]);

  // ── Play voice clip ───────────────────────────────────
  useEffect(() => {
    if (currentStep?.voiceClipUrl) {
      audioRef.current = new Audio(currentStep.voiceClipUrl);
      audioRef.current.play().catch(() => {});
    }
    return () => {
      audioRef.current?.pause();
    };
  }, [currentStep]);

  // ── Auto-advance ──────────────────────────────────────
  useEffect(() => {
    if (currentStep?.advanceOn === 'auto' && currentStep.autoAdvanceMs) {
      const timer = setTimeout(handleNext, currentStep.autoAdvanceMs);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  // ── Handlers ──────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!tour || !currentStep) return;

    // Notify server
    if (authToken) {
      apiAdvanceStep(authToken, currentStep.id, tour.id).catch(() => {});
    }

    if (isLastStep) {
      setVisible(false);
      onComplete?.();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [tour, currentStep, isLastStep, authToken, onComplete]);

  const handleDismiss = useCallback(async () => {
    if (authToken && tour) {
      apiDismissTour(authToken, tour.id).catch(() => {});
    }
    setVisible(false);
    onComplete?.();
  }, [authToken, tour, onComplete]);

  const handleSkip = useCallback(() => {
    if (dontShowAgain) {
      handleDismiss();
    } else {
      handleDismiss();
    }
  }, [dontShowAgain, handleDismiss]);

  // ── Don't render if not visible ───────────────────────
  if (!visible || !currentStep) return null;

  // ── Spotlight mask SVG ────────────────────────────────
  const padding = currentStep.spotlightPadding ?? 8;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 transition-opacity duration-300" />

      {/* Spotlight cutout */}
      {spotlightRect && (
        <div
          className="absolute border-2 border-cyan-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] transition-all duration-300"
          style={{
            top: spotlightRect.top - padding,
            left: spotlightRect.left - padding,
            width: spotlightRect.width + padding * 2,
            height: spotlightRect.height + padding * 2,
          }}
        />
      )}

      {/* Step card */}
      <div
        className={`absolute z-10 max-w-sm w-[90vw] bg-gray-900 border border-gray-700 rounded-2xl p-5 shadow-2xl transition-all duration-300 ${
          spotlightRect
            ? currentStep.targetPosition === 'top'
              ? 'bottom-auto'
              : 'top-auto'
            : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
        }`}
        style={
          spotlightRect
            ? {
                top: currentStep.targetPosition === 'bottom'
                  ? spotlightRect.bottom + padding + 16
                  : undefined,
                bottom: currentStep.targetPosition === 'top'
                  ? window.innerHeight - spotlightRect.top + padding + 16
                  : undefined,
                left: Math.max(16, Math.min(
                  spotlightRect.left,
                  window.innerWidth - 360
                )),
              }
            : undefined
        }
      >
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full mb-4">
          <div
            className="h-1 bg-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <h3 className="text-white font-semibold text-lg mb-2">
          {currentStep.title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          {currentStep.transcript}
        </p>

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

          <button
            onClick={handleNext}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isLastStep ? "Let's go!" : 'Next'}
          </button>
        </div>

        {/* Don't show again */}
        {currentStep.showSkip && tour?.canDismiss && (
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-gray-500 text-xs">Don't show this again</span>
          </label>
        )}
      </div>
    </div>
  );
};

export default TourOverlay;