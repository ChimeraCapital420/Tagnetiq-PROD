// FILE: src/components/oracle/OracleGreeting.tsx
// Oracle Greeting Banner — The "Hello Billy" Moment
//
// ═══════════════════════════════════════════════════════════════════════
// This is the AOL "You've Got Mail" moment for TagnetIQ.
// Except it's better — because it's personal, contextual, and smart.
//
// MOBILE-FIRST DESIGN:
//   - Slides up from bottom on mobile (thumb-friendly dismiss)
//   - Compact: 2-3 lines max, no scrolling needed
//   - Service chips are tappable, swipeable on overflow
//   - Auto-dismisses after 12s (respects power users)
//   - Tap anywhere to dismiss (natural gesture)
//
// RENDERING:
//   - Background gradient shifts by time of day
//   - Morning: warm amber → Afternoon: sky blue → Evening: purple → Night: deep navy
//   - Service suggestion chips are scrollable horizontal row
//   - Streak badge pulses gently if active
//
// PHILOSOPHY:
//   "The best greeting is one you look forward to."
//   Not a modal. Not a blocker. A warm welcome that helps.
// ═══════════════════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useOracleGreeting } from '@/hooks/useOracleGreeting';
import type { ServiceSuggestion, TimeOfDay } from '@/lib/oracle/greeting';

// =============================================================================
// THEME BY TIME OF DAY
// =============================================================================

const TIME_THEMES: Record<TimeOfDay, {
  gradient: string;
  text: string;
  chipBg: string;
  chipText: string;
  border: string;
}> = {
  morning: {
    gradient: 'from-amber-950/90 via-orange-950/80 to-yellow-950/70',
    text: 'text-amber-100',
    chipBg: 'bg-amber-900/60',
    chipText: 'text-amber-200',
    border: 'border-amber-800/40',
  },
  afternoon: {
    gradient: 'from-sky-950/90 via-blue-950/80 to-cyan-950/70',
    text: 'text-sky-100',
    chipBg: 'bg-sky-900/60',
    chipText: 'text-sky-200',
    border: 'border-sky-800/40',
  },
  evening: {
    gradient: 'from-purple-950/90 via-violet-950/80 to-indigo-950/70',
    text: 'text-purple-100',
    chipBg: 'bg-purple-900/60',
    chipText: 'text-purple-200',
    border: 'border-purple-800/40',
  },
  night: {
    gradient: 'from-slate-950/95 via-zinc-950/90 to-gray-950/85',
    text: 'text-slate-200',
    chipBg: 'bg-slate-800/60',
    chipText: 'text-slate-300',
    border: 'border-slate-700/40',
  },
};

// =============================================================================
// SERVICE CHIP
// =============================================================================

interface ServiceChipProps {
  service: ServiceSuggestion;
  theme: typeof TIME_THEMES.morning;
  onAction: (service: ServiceSuggestion) => void;
}

const ServiceChip: React.FC<ServiceChipProps> = ({ service, theme, onAction }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onAction(service);
    }}
    className={`
      flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5
      ${theme.chipBg} ${theme.chipText}
      rounded-full text-xs font-medium
      active:scale-95 transition-transform duration-100
      border ${theme.border}
    `}
  >
    <span>{service.icon}</span>
    <span>{service.label}</span>
  </button>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const OracleGreeting: React.FC = () => {
  const navigate = useNavigate();
  const { greeting, analysis, visible, dismiss } = useOracleGreeting();

  // ── Handle service chip actions ─────────────────────────
  const handleServiceAction = useCallback((service: ServiceSuggestion) => {
    dismiss(); // Close greeting first

    switch (service.action) {
      case 'navigate':
        if (service.navigateTo) navigate(service.navigateTo);
        break;
      case 'oracle_chat':
        // Navigate to oracle with a pre-loaded prompt
        if (service.oraclePrompt) {
          // Store prompt for Oracle page to pick up
          sessionStorage.setItem('oracle_preload_prompt', service.oraclePrompt);
        }
        navigate('/oracle');
        break;
      case 'external':
        if (service.externalUrl) {
          window.open(service.externalUrl, '_blank', 'noopener');
        }
        break;
    }
  }, [dismiss, navigate]);

  // ── Don't render if not visible or no greeting ──────────
  if (!visible || !greeting || !analysis) return null;

  const theme = TIME_THEMES[greeting.timeOfDay];
  const suggestions = analysis.suggestedServices;

  return (
    <div
      onClick={dismiss}
      className={`
        fixed bottom-16 left-0 right-0 z-40
        mx-2 sm:mx-4 md:mx-auto md:max-w-lg
        rounded-2xl overflow-hidden
        bg-gradient-to-br ${theme.gradient}
        backdrop-blur-xl shadow-2xl
        border ${theme.border}
        animate-in slide-in-from-bottom-4 fade-in duration-500
        ${!visible ? 'animate-out slide-out-to-bottom-4 fade-out duration-300' : ''}
        cursor-pointer
      `}
      role="status"
      aria-live="polite"
      aria-label="Oracle greeting"
    >
      {/* Content */}
      <div className="p-4 pr-10">
        {/* Salutation */}
        <div className={`flex items-center gap-2 ${theme.text}`}>
          <span className="text-lg">{greeting.icon}</span>
          <p className="text-base font-semibold leading-tight">
            {greeting.salutation}
          </p>
        </div>

        {/* Follow-up */}
        <p className={`mt-1 text-sm ${theme.text} opacity-80 leading-snug`}>
          {greeting.followUp}
        </p>

        {/* Streak / Nudge */}
        {greeting.nudge && (
          <p className={`mt-1.5 text-xs ${theme.text} opacity-60`}>
            {greeting.nudge}
          </p>
        )}

        {/* Service Suggestions — horizontal scroll on mobile */}
        {suggestions.length > 0 && (
          <div
            className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            onClick={(e) => e.stopPropagation()}
          >
            {suggestions.map((service) => (
              <ServiceChip
                key={service.id}
                service={service}
                theme={theme}
                onAction={handleServiceAction}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dismiss X */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className={`
          absolute top-3 right-3
          ${theme.text} opacity-40 hover:opacity-80
          transition-opacity
        `}
        aria-label="Dismiss greeting"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default OracleGreeting;