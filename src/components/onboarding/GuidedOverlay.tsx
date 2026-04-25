// FILE: src/components/onboarding/GuidedOverlay.tsx
// ═══════════════════════════════════════════════════════════════════════
// Guided Overlay — Spotlight System for Trust Level 1 Users
// ═══════════════════════════════════════════════════════════════════════
//
// v1.0: Spotlight + Oracle bottom sheet + voice guidance
//
// v1.1 CHANGES — Hardening Sprint #8:
//   - Wrapped default export with ErrorBoundary (fallback: null).
//
// v1.2 CHANGES — One-and-done:
//   - User can now permanently dismiss the overlay with "Got it".
//   - Dismissal stored in localStorage (survives browser restarts).
//   - Once dismissed, NEVER shows again — no more re-appearing every session.
//   - Individual step dismissals (markStepShown) still work as before.
//   - Zero changes to spotlight, voice, or guidance logic.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useOracleVoice } from '@/hooks/useOracleVoice';
import {
  getNextGuidanceStep,
  markStepShown,
  type GuidanceStep,
} from '@/lib/oracle/trust/guidance-config';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';

// =============================================================================
// PERSISTENCE HELPERS — v1.2
// =============================================================================

const DISMISSED_KEY = 'tagnetiq_guided_overlay_dismissed';

function hasUserDismissedOverlay(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function permanentlyDismissOverlay(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch { /* silent */ }
}

// =============================================================================
// SPOTLIGHT POSITION
// =============================================================================

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getElementRect(selector: string): SpotlightRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

// =============================================================================
// INNER COMPONENT
// =============================================================================

const GuidedOverlayInner: React.FC = () => {
  const location = useLocation();
  const { trustLevel, isEstateTrust } = useAppContext();
  const voice = useOracleVoice();

  const [activeStep, setActiveStep] = useState<GuidanceStep | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [visible, setVisible] = useState(false);
  // v1.2: track permanent dismissal in component state too
  const [permanentlyDismissed, setPermanentlyDismissed] = useState(
    () => hasUserDismissedOverlay()
  );
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only show for Trust Level 1, and only if not permanently dismissed
  if (trustLevel > 1) return null;
  if (permanentlyDismissed) return null;

  const showStep = useCallback((step: GuidanceStep, isEstate: boolean) => {
    markStepShown(step.id);

    const rect = step.spotlightTarget
      ? getElementRect(step.spotlightTarget)
      : null;

    setSpotlightRect(rect);
    setActiveStep(step);
    setVisible(true);

    const message = isEstate && step.estateMessage
      ? step.estateMessage
      : step.message;

    setTimeout(() => voice.speak(message), 400);

    if (step.completedBy === 'timer' && step.autoAdvanceMs) {
      autoAdvanceRef.current = setTimeout(dismissStep, step.autoAdvanceMs);
    }
  }, [voice]);

  const dismissStep = useCallback(() => {
    setVisible(false);
    voice.stop();
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setTimeout(() => setActiveStep(null), 300);
  }, [voice]);

  // v1.2: Permanent dismiss — stores in localStorage, never shows again
  const handleGotIt = useCallback(() => {
    permanentlyDismissOverlay();
    setPermanentlyDismissed(true);
    dismissStep();
  }, [dismissStep]);

  useEffect(() => {
    if (trustLevel > 1 || permanentlyDismissed) return;

    const step = getNextGuidanceStep(location.pathname, 'route_enter');
    if (step) {
      const timer = setTimeout(() => showStep(step, isEstateTrust ?? false), 800);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, trustLevel, permanentlyDismissed]);

  useEffect(() => {
    const handleScanComplete = () => {
      if (trustLevel > 1 || permanentlyDismissed) return;
      const step = getNextGuidanceStep(location.pathname, 'scan_complete');
      if (step) setTimeout(() => showStep(step, isEstateTrust ?? false), 600);
    };

    window.addEventListener('tagnetiq:scan-complete', handleScanComplete);
    return () => window.removeEventListener('tagnetiq:scan-complete', handleScanComplete);
  }, [location.pathname, trustLevel, showStep, isEstateTrust, permanentlyDismissed]);

  useEffect(() => {
    if (!activeStep || activeStep.completedBy !== 'tap_target') return;
    if (!activeStep.spotlightTarget) return;

    const el = document.querySelector(activeStep.spotlightTarget);
    if (!el) return;

    const handleTap = () => dismissStep();
    el.addEventListener('click', handleTap);
    el.addEventListener('touchstart', handleTap);
    return () => {
      el.removeEventListener('click', handleTap);
      el.removeEventListener('touchstart', handleTap);
    };
  }, [activeStep, dismissStep]);

  if (!activeStep || !visible) return null;

  const message = isEstateTrust && activeStep.estateMessage
    ? activeStep.estateMessage
    : activeStep.message;

  return (
    <>
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 z-[60] pointer-events-none"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      />

      {/* Spotlight ring */}
      {spotlightRect && (
        <div
          className="fixed z-[61] pointer-events-none"
          style={{
            top: spotlightRect.top - 8,
            left: spotlightRect.left - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderRadius: 12,
            boxShadow: '0 0 0 4px hsl(var(--primary)), 0 0 0 9999px rgba(0,0,0,0.55)',
            animation: 'pulse 1.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Oracle message sheet */}
      <div
        className={cn(
          'fixed bottom-[calc(52px+env(safe-area-inset-bottom,0px))] left-0 right-0 z-[62]',
          'bg-background border-t border-border/50 rounded-t-2xl shadow-2xl',
          'transform transition-transform duration-300',
          visible ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="px-4 pb-5 pt-2">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="h-4 w-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {message}
              </p>

              {/* v1.2: "Got it" button — permanently hides the overlay */}
              <button
                onClick={handleGotIt}
                className="mt-2.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Got it — don't show again
              </button>
            </div>

            {/* X dismisses just this step, not permanently */}
            <button
              onClick={dismissStep}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"
              aria-label="Dismiss guidance"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
};

// =============================================================================
// EXPORTED COMPONENT — wrapped with ErrorBoundary (#8)
// =============================================================================

const GuidedOverlay: React.FC = () => (
  <ErrorBoundary fallback={null}>
    <GuidedOverlayInner />
  </ErrorBoundary>
);

export default GuidedOverlay;