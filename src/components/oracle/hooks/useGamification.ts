// FILE: src/components/oracle/hooks/useGamification.ts
// Gamification state — points, level, badges, streaks
// Fetches from /api/oracle/gamification on mount and after point events

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Badge } from '@/lib/oracle/gamification/index';

interface LevelInfo {
  level: number;
  title: string;
  nextThreshold: number;
  progress: number;
}

interface GamificationState {
  totalPoints: number;
  level: LevelInfo;
  badges: Badge[];
  streak: { current: number; longest: number };
  stats: {
    totalScans: number;
    totalSales: number;
    totalProfit: number;
    totalListings: number;
    lessonsCompleted: number;
    feedbackGiven: number;
  };
  loading: boolean;
}

const DEFAULT_STATE: GamificationState = {
  totalPoints: 0,
  level: { level: 1, title: 'Newcomer', nextThreshold: 100, progress: 0 },
  badges: [],
  streak: { current: 0, longest: 0 },
  stats: {
    totalScans: 0, totalSales: 0, totalProfit: 0,
    totalListings: 0, lessonsCompleted: 0, feedbackGiven: 0,
  },
  loading: true,
};

export function useGamification() {
  const [state, setState] = useState<GamificationState>(DEFAULT_STATE);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/oracle/gamification?action=stats', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setState({
          totalPoints: data.totalPoints || 0,
          level: data.level || DEFAULT_STATE.level,
          badges: data.badges || [],
          streak: data.streak || DEFAULT_STATE.streak,
          stats: data.stats || DEFAULT_STATE.stats,
          loading: false,
        });
      }
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Clear new badge notification
  const dismissNewBadges = useCallback(() => {
    setNewBadges([]);
  }, []);

  return {
    ...state,
    newBadges,
    dismissNewBadges,
    refresh: fetchStats,
  };
}
