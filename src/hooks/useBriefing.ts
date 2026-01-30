// FILE: src/features/boardroom/hooks/useBriefing.ts
// Hook for briefing generation and management

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Briefing, UseBriefingReturn } from '../types';
import { API_ENDPOINTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

interface UseBriefingOptions {
  initialBriefing?: Briefing | null;
  onBriefingGenerated?: (briefing: Briefing) => void;
}

export function useBriefing(options: UseBriefingOptions = {}): UseBriefingReturn {
  const { initialBriefing = null, onBriefingGenerated } = options;

  // State
  const [briefing, setBriefing] = useState<Briefing | null>(initialBriefing);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get auth session helper
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error(ERROR_MESSAGES.notAuthenticated);
    }
    return session;
  };

  // Generate a new briefing
  const generateBriefing = useCallback(async (
    type: Briefing['briefing_type'] = 'morning'
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.briefing, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || ERROR_MESSAGES.briefingGenerateFailed);
      }

      // Ensure sections is always an array
      const normalizedBriefing: Briefing = {
        ...data,
        sections: data.sections || [],
        action_items: data.action_items || [],
      };

      setBriefing(normalizedBriefing);
      onBriefingGenerated?.(normalizedBriefing);
      toast.success(SUCCESS_MESSAGES.briefingGenerated);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.briefingGenerateFailed;
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onBriefingGenerated]);

  // Fetch the most recent briefing
  const fetchBriefing = useCallback(async (): Promise<void> => {
    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.briefing, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      const data = await response.json();
      
      if (data.id) {
        // Ensure sections is always an array
        const normalizedBriefing: Briefing = {
          ...data,
          sections: data.sections || [],
          action_items: data.action_items || [],
        };
        setBriefing(normalizedBriefing);
      }
    } catch (err) {
      console.error('Failed to fetch briefing:', err);
    }
  }, []);

  // Mark briefing as read
  const markAsRead = useCallback(async (): Promise<void> => {
    if (!briefing || briefing.read_at) return;

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.briefing, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: briefing.id,
          read_at: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setBriefing(prev => prev ? { ...prev, read_at: new Date().toISOString() } : null);
      }
    } catch (err) {
      console.error('Failed to mark briefing as read:', err);
    }
  }, [briefing]);

  // Sync with external briefing state (for parent component control)
  const syncBriefing = useCallback((newBriefing: Briefing | null) => {
    if (newBriefing) {
      setBriefing({
        ...newBriefing,
        sections: newBriefing.sections || [],
        action_items: newBriefing.action_items || [],
      });
    } else {
      setBriefing(null);
    }
  }, []);

  return {
    // State
    briefing,
    isLoading,
    error,
    
    // Actions
    generateBriefing,
    fetchBriefing,
    markAsRead,
    
    // For external sync
    _syncBriefing: syncBriefing,
  } as UseBriefingReturn & { _syncBriefing: (b: Briefing | null) => void };
}

export default useBriefing;