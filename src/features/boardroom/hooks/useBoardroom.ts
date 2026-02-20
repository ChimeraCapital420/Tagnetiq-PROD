// FILE: src/features/boardroom/hooks/useBoardroom.ts
// Main hook for boardroom data loading and access control
//
// Sprint 7: Now parses execution dashboard data (Sprint 6) from the
//           API response and exposes it alongside members/meetings/stats.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  BoardMember,
  Meeting,
  DashboardStats,
  Briefing,
  BoardroomData,
  ExecutionDashboard,
  UseBoardroomReturn,
} from '../types';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants';

interface UseBoardroomOptions {
  autoLoad?: boolean;
}

export function useBoardroom(options: UseBoardroomOptions = {}): UseBoardroomReturn & {
  briefing: Briefing | null;
  setBriefing: React.Dispatch<React.SetStateAction<Briefing | null>>;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
  execution: ExecutionDashboard | null;
} {
  const { autoLoad = true } = options;

  // State
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [execution, setExecution] = useState<ExecutionDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load boardroom data
  const loadBoardroom = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.boardroom, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.status === 403) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.loadFailed);
      }

      const data: BoardroomData = await response.json();

      setHasAccess(true);
      setMembers(data.members || []);
      setMeetings(data.meetings || []);
      setStats(data.stats || null);

      if (data.todays_briefing) {
        setBriefing(data.todays_briefing);
      }

      // Sprint 6: Execution dashboard data
      if (data.execution) {
        setExecution(data.execution);
      }

    } catch (err) {
      console.error('Boardroom load error:', err);
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadBoardroom();
    }
  }, [autoLoad, loadBoardroom]);

  // Lookup helper
  const getMemberBySlug = useCallback(
    (slug: string) => members.find(m => m.slug === slug),
    [members]
  );

  return {
    // State
    hasAccess,
    members,
    meetings,
    stats,
    briefing,
    execution,
    isLoading,
    error,

    // Setters (used by child hooks)
    setBriefing,
    setMeetings,

    // Actions
    refresh: loadBoardroom,
    getMemberBySlug,
  };
}