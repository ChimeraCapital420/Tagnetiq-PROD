// FILE: src/hooks/useTrustLevel.ts
// ═══════════════════════════════════════════════════════════════════════
// Trust Level Hook
// ═══════════════════════════════════════════════════════════════════════
//
// Combines profile data from AuthContext with behavioral signals
// to produce the final trust level for this session.
//
// ZERO server calls. ZERO side effects. Derived entirely from
// AuthContext.profile + session-scoped behavioral signals.
//
// USAGE:
//   const { trustLevel, trustLevelName, isEstate } = useTrustLevel();
//
// Called once in AppProvider — result exposed via AppContext so every
// component can read trust level without re-running the calculation.
// ═══════════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { calculateTrustLevel, type TrustResult, type TrustLevel } from '@/lib/oracle/trust/trust-level';
import { useBehavioralSignals } from './useBehavioralSignals';

export function useTrustLevel(): TrustResult {
  const { profile } = useAuth();
  const { shouldDemote } = useBehavioralSignals();

  const result = useMemo(() => {
    return calculateTrustLevel(profile as any, shouldDemote);
  }, [
    profile?.scan_count,
    profile?.total_listings,
    profile?.total_sessions,
    profile?.autonomy_opted_in,
    profile?.estate_mode,
    profile?.trust_level,
    (profile as any)?.favorite_categories,
    shouldDemote,
  ]);

  return result;
}