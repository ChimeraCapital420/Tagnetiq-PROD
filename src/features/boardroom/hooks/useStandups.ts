// FILE: src/features/boardroom/hooks/useStandups.ts
// Standup Hook — Sprint 5 standup data frontend
//
// Sprint 7: Fetches today's standups, history, and can trigger
// generation for individual members or the whole board.
// Standup endpoint: /api/boardroom/standup

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { API_ENDPOINTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import type { StandupEntry, StandupDay, UseStandupsReturn } from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(ERROR_MESSAGES.notAuthenticated);
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function useStandups(): UseStandupsReturn {
  const [entries, setEntries] = useState<StandupEntry[]>([]);
  const [history, setHistory] = useState<StandupDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch today's standups ────────────────────────────
  const fetchToday = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_ENDPOINTS.standup}?action=today`, { headers });

      if (!res.ok) {
        throw new Error(ERROR_MESSAGES.standupFailed);
      }

      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.standupFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Fetch standup history ─────────────────────────────
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_ENDPOINTS.standup}?action=history&limit=7`, { headers });

      if (!res.ok) {
        throw new Error(ERROR_MESSAGES.standupFailed);
      }

      const data = await res.json();

      // Group entries by date into StandupDay[]
      const dayMap = new Map<string, StandupEntry[]>();
      (data.entries || []).forEach((entry: StandupEntry) => {
        const date = entry.entry_date || entry.created_at.split('T')[0];
        if (!dayMap.has(date)) dayMap.set(date, []);
        dayMap.get(date)!.push(entry);
      });

      const days: StandupDay[] = Array.from(dayMap.entries())
        .map(([date, dayEntries]) => ({
          date,
          entries: dayEntries,
          hasBlockers: dayEntries.some(e => e.blockers && e.blockers.length > 0),
          totalWins: dayEntries.reduce((sum, e) => sum + (e.wins?.length || 0), 0),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setHistory(days);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.standupFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Trigger standup generation ────────────────────────
  const triggerGeneration = useCallback(async (memberSlug?: string) => {
    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = { action: 'generate' };
      if (memberSlug) body.member_slug = memberSlug;

      const res = await fetch(API_ENDPOINTS.standup, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(ERROR_MESSAGES.standupFailed);
      }

      toast.success(SUCCESS_MESSAGES.standupGenerated);
      // Refresh after generation
      await fetchToday();
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.standupFailed;
      toast.error(msg);
    }
  }, [fetchToday]);

  return {
    entries,
    history,
    isLoading,
    error,
    fetchToday,
    fetchHistory,
    triggerGeneration,
  };
}