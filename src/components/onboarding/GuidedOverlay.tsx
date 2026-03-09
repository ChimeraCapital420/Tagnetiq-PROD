// FILE: src/components/onboarding/GuidedOverlay.tsx
// ═══════════════════════════════════════════════════════════════════════
// Guided Overlay — Spotlight System for Trust Level 1 Users
// ═══════════════════════════════════════════════════════════════════════
//
// v1.0: Spotlight + Oracle bottom sheet + voice guidance
//
// v1.1 CHANGES — Hardening Sprint #8:
//   - Wrapped default export with ErrorBoundary (fallback: null).
//     A render error in GuidedOverlay silently removes the overlay
//     rather than crashing the page the user is on.
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
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only show for Trust Level 1
  if (trustLevel > 1) return null;

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

  useEffect(() => {
    if (trustLevel > 1) return;

    const step = getNextGuidanceStep(location.pathname, 'route_enter');
    if (step) {
      const timer = setTimeout(() => showStep(step, isEstateTrust ?? false), 800);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, trustLevel]);

  useEffect(() => {
    const handleScanComplete = () => {
      if (trustLevel > 1) return;
      const step = getNextGuidanceStep(location.pathname, 'scan_complete');
      if (step) setTimeout(() => showStep(step, isEstateTrust ?? false), 600);
    };

    window.addEventListener('tagnetiq:scan-complete', handleScanComplete);
    return () => window.removeEventListener('tagnetiq:scan-complete', handleScanComplete);
  }, [location.pathname, trustLevel, showStep, isEstateTrust]);

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
            </div>

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
// A crash in GuidedOverlay disappears silently instead of crashing the page.
// =============================================================================

const GuidedOverlay: React.FC = () => (
  <ErrorBoundary fallback={null}>
    <GuidedOverlayInner />
  </ErrorBoundary>
);

export default GuidedOverlay;