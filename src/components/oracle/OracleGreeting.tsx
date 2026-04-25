// FILE: src/components/oracle/OracleGreeting.tsx
// Oracle Greeting Banner — The "Hello Billy" Moment
//
// ═══════════════════════════════════════════════════════════════════════
// v2.2: Suppress greeting until user has scanned at least once
//   The intro onboarding already teaches users how to scan.
//   The daily greeting should only appear from scan #2 onward.
//   This eliminates the "two greetings" redundancy William noticed.
//
//   Implementation: reads scan_count from localStorage (set by analyze.ts
//   response handler). Falls back gracefully if not available.
//   Zero backend calls — purely client-side check.
//
// v2.1: Prominent "Turn off daily greeting" control
//   - Full divider separates content from control row
//   - Checkbox is w-4 h-4, label is text-sm font-medium full opacity
//   - Text: "Turn off daily greeting" (clearer than "Don't show again")
//   - Settings shortcut on right side → navigates to /settings
//   - checkboxBg gives control row visual weight
//
// PHILOSOPHY: "The best greeting is one you look forward to."
// Not a modal. Not a blocker. A warm welcome that helps.
// But never something that gets in the way of a power user.
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Settings } from 'lucide-react';
import { useOracleGreeting } from '@/hooks/useOracleGreeting';
import type { ServiceSuggestion, TimeOfDay } from '@/lib/oracle/greeting';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get user's completed scan count from localStorage.
 * The scan result handler should call incrementScanCount() after
 * each successful scan so this stays current client-side.
 * Returns 0 if never scanned (new user).
 */
function getLocalScanCount(): number {
  try {
    return parseInt(localStorage.getItem('tagnetiq_scan_count') || '0', 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Call this in your scan result handler after a successful scan.
 * Import and call: incrementScanCount() whenever analyze.ts returns success.
 */
export function incrementScanCount(): void {
  try {
    const current = getLocalScanCount();
    localStorage.setItem('tagnetiq_scan_count', String(current + 1));
  } catch {
    // silent fail — localStorage may be blocked
  }
}

// =============================================================================
// THEME BY TIME OF DAY
// =============================================================================

const TIME_THEMES: Record<TimeOfDay, {
  gradient: string;
  text: string;
  chipBg: string;
  chipText: string;
  border: string;
  divider: string;
  checkboxBg: string;
}> = {
  morning: {
    gradient: 'from-amber-950/90 via-orange-950/80 to-yellow-950/70',
    text: 'text-amber-100',
    chipBg: 'bg-amber-900/60',
    chipText: 'text-amber-200',
    border: 'border-amber-800/40',
    divider: 'border-amber-800/30',
    checkboxBg: 'bg-amber-900/30',
  },
  afternoon: {
    gradient: 'from-sky-950/90 via-blue-950/80 to-cyan-950/70',
    text: 'text-sky-100',
    chipBg: 'bg-sky-900/60',
    chipText: 'text-sky-200',
    border: 'border-sky-800/40',
    divider: 'border-sky-800/30',
    checkboxBg: 'bg-sky-900/30',
  },
  evening: {
    gradient: 'from-purple-950/90 via-violet-950/80 to-indigo-950/70',
    text: 'text-purple-100',
    chipBg: 'bg-purple-900/60',
    chipText: 'text-purple-200',
    border: 'border-purple-800/40',
    divider: 'border-purple-800/30',
    checkboxBg: 'bg-purple-900/30',
  },
  night: {
    gradient: 'from-slate-950/95 via-zinc-950/90 to-gray-950/85',
    text: 'text-slate-200',
    chipBg: 'bg-slate-800/60',
    chipText: 'text-slate-300',
    border: 'border-slate-700/40',
    divider: 'border-slate-700/30',
    checkboxBg: 'bg-slate-800/30',
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
    onClick={(e) => { e.stopPropagation(); onAction(service); }}
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
  const { greeting, analysis, visible, dismiss, dismissPermanently } = useOracleGreeting();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  // v2.2: suppress until user has scanned at least once
  const [hasScanHistory, setHasScanHistory] = useState(false);

  useEffect(() => {
    // Check on mount — if user has scanned before, allow greeting to show
    const count = getLocalScanCount();
    setHasScanHistory(count > 0);
  }, []);

  const handleDismiss = useCallback(() => {
    if (dontShowAgain) {
      dismissPermanently();
    } else {
      dismiss();
    }
  }, [dontShowAgain, dismiss, dismissPermanently]);

  const handleServiceAction = useCallback((service: ServiceSuggestion) => {
    handleDismiss();
    switch (service.action) {
      case 'navigate':
        if (service.navigateTo) navigate(service.navigateTo);
        break;
      case 'oracle_chat':
        if (service.oraclePrompt) {
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
  }, [handleDismiss, navigate]);

  // v2.2: Don't show on first visit — intro onboarding already covers that.
  // Show daily greeting only from scan #2 onward.
  if (!visible || !greeting || !analysis || !hasScanHistory) return null;

  const theme = TIME_THEMES[greeting.timeOfDay];
  const suggestions = analysis.suggestedServices;

  return (
    <div
      onClick={handleDismiss}
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
      {/* ── Main greeting content ─────────────────────────── */}
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

        {/* Service Suggestions */}
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

      {/* ── Divider — visual break before control row ──────── */}
      <div className={`border-t ${theme.divider} mx-4`} />

      {/* ── Control row — v2.1: prominent, full opacity ─────── */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between ${theme.checkboxBg}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Checkbox — large, clearly labeled, full opacity */}
        <label
          htmlFor="oracle-dont-show"
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <input
            id="oracle-dont-show"
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-4 h-4 rounded accent-white cursor-pointer flex-shrink-0"
          />
          <span className={`text-sm font-medium ${theme.text}`}>
            Turn off daily greeting
          </span>
        </label>

        {/* Settings shortcut */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
            navigate('/settings');
          }}
          className={`
            flex items-center gap-1 text-xs ${theme.text}
            opacity-50 hover:opacity-90 transition-opacity active:scale-95
          `}
          aria-label="Open settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {/* ── Dismiss X ──────────────────────────────────────── */}
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
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