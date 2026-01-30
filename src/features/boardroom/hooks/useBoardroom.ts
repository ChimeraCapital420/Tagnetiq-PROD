// FILE: src/features/boardroom/hooks/useBoardroom.ts
// Main hook for boardroom data loading and access control

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { 
  BoardMember, 
  Meeting, 
  DashboardStats, 
  Briefing,
  BoardroomData,
  UseBoardroomReturn 
} from '../types';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants';

interface UseBoardroomOptions {
  autoLoad?: boolean;
}

export function useBoardroom(options: UseBoardroomOptions = {}): UseBoardroomReturn & {
  briefing: Briefing | null;
  setBriefing: React.Dispatch<React.SetStateAction<Briefing | null>>;
  setMeetings: React.Dispatch<React.SetStateAction<Meeting[]>>;
} {
  const { autoLoad = true } = options;
  
  // State
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
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
        headers: { 'Authorization': `Bearer ${session.access_token}` }
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

    } catch (err) {
      console.error('Boardroom load error:', err);
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.loadFailed);
      setHasAccess(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get member by slug helper
  const getMemberBySlug = useCallback((slug: string): BoardMember | undefined => {
    return members.find(m => m.slug === slug);
  }, [members]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadBoardroom();
    }
  }, [autoLoad, loadBoardroom]);

  return {
    // State
    hasAccess,
    members,
    meetings,
    stats,
    isLoading,
    error,
    briefing,
    
    // Setters for child hooks
    setBriefing,
    setMeetings,
    
    // Actions
    refresh: loadBoardroom,
    getMemberBySlug,
  };
}

export default useBoardroom;