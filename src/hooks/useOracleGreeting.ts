// FILE: src/hooks/useOracleGreeting.ts
// Oracle Greeting Hook — Mobile-First Session Greeting
//
// ═══════════════════════════════════════════════════════════════════════
// This hook runs on every dashboard mount and computes:
//   1. Who the user is (persona)
//   2. What time it is (device clock)
//   3. What they might need (session intent)
//   4. A personalized greeting (Oracle-voiced)
//   5. Contextual service suggestions
//
// ZERO server calls. Everything computed from cached profile + device.
// The greeting shows once per session (sessionStorage guard).
//
// USAGE:
//   const { greeting, analysis, visible, dismiss } = useOracleGreeting();
// ═══════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  analyzeUser,
  buildGreeting,
  type OracleGreeting,
  type PersonaAnalysis,
  type GreetingProfile,
} from '@/lib/oracle/greeting';

// =============================================================================
// TYPES
// =============================================================================

export interface UseOracleGreetingReturn {
  /** The computed greeting (null if not ready) */
  greeting: OracleGreeting | null;
  /** Full persona analysis */
  analysis: PersonaAnalysis | null;
  /** Whether the greeting banner should be visible */
  visible: boolean;
  /** Dismiss the greeting (auto-fades or user-tapped) */
  dismiss: () => void;
  /** User's display name used in greeting */
  displayName: string;
}

// Session key — prevents re-showing on route changes within same session
const SESSION_KEY = 'oracle_greeting_shown';
// How long the greeting is visible before auto-dismissing (ms)
const AUTO_DISMISS_MS = 12_000;

// =============================================================================
// HOOK
// =============================================================================

export function useOracleGreeting(): UseOracleGreetingReturn {
  const { user, profile } = useAuth();
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Extract display name ────────────────────────────────
  const displayName = useMemo(() => {
    if (!profile) return 'friend';
    return (
      profile.screen_name
      || profile.full_name?.split(' ')[0]
      || user?.email?.split('@')[0]
      || 'friend'
    );
  }, [profile, user]);

  // ── Build the GreetingProfile from AuthContext cached data ─
  const greetingProfile: GreetingProfile | null = useMemo(() => {
    if (!profile) return null;

    return {
      screen_name: profile.screen_name,
      full_name: profile.full_name,
      interests: profile.interests || [],
      total_scans: profile.total_scans || 0,
      successful_finds: profile.successful_finds || 0,
      subscription_tier: profile.subscription_tier,
      onboarding_complete: profile.onboarding_complete,
      last_active_at: profile.last_active_at || profile.updated_at,
      streak_count: profile.streak_count || 0,
      vault_stats: profile.vault_stats || {},
      sales_logged: profile.sales_logged || 0,
      conversations_count: profile.conversations_count || 0,
      settings: profile.settings || {},
    };
  }, [profile]);

  // ── Run persona analysis (pure, sync, <1ms) ────────────
  const analysis = useMemo(() => {
    if (!greetingProfile) return null;
    return analyzeUser(greetingProfile);
  }, [greetingProfile]);

  // ── Build greeting (pure, sync, <1ms) ──────────────────
  const greeting = useMemo(() => {
    if (!analysis) return null;
    return buildGreeting(displayName, analysis);
  }, [analysis, displayName]);

  // ── Dismiss handler ─────────────────────────────────────
  const dismiss = useCallback(() => {
    setVisible(false);
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  // ── Show greeting once per session ──────────────────────
  useEffect(() => {
    if (!greeting || !profile?.onboarding_complete) return;

    // Check session guard — don't re-show on route changes
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) return;

    // Mark as shown for this session
    sessionStorage.setItem(SESSION_KEY, Date.now().toString());

    // Small delay so the dashboard renders first, then greeting slides in
    const showDelay = setTimeout(() => {
      setVisible(true);

      // Auto-dismiss after 12 seconds
      dismissTimer.current = setTimeout(() => {
        setVisible(false);
      }, AUTO_DISMISS_MS);
    }, 800);

    return () => {
      clearTimeout(showDelay);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [greeting, profile?.onboarding_complete]);

  return {
    greeting,
    analysis,
    visible,
    dismiss,
    displayName,
  };
}

export default useOracleGreeting;