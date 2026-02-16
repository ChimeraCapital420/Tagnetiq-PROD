// FILE: src/components/oracle/hooks/useFeedback.ts
// Thumbs up/down feedback hook for Oracle responses
// Sends to /api/oracle/feedback → trust calibration + gamification

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface FeedbackState {
  [key: number]: 'up' | 'down' | null;
}

export function useFeedback(conversationId: string | null) {
  const [ratings, setRatings] = useState<FeedbackState>({});
  const [sending, setSending] = useState(false);

  const submitFeedback = useCallback(async (
    messageIndex: number,
    rating: 'up' | 'down',
    messageContent?: string,
    reason?: string,
  ) => {
    // Toggle off if already rated the same
    if (ratings[messageIndex] === rating) {
      setRatings(prev => ({ ...prev, [messageIndex]: null }));
      return;
    }

    setRatings(prev => ({ ...prev, [messageIndex]: rating }));
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/oracle/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          messageIndex,
          rating,
          reason,
          messageContent: messageContent?.substring(0, 300),
        }),
      });

      if (res.ok) {
        if (rating === 'up') {
          toast.success('Thanks! This helps Dash learn.', { duration: 2000 });
        } else {
          toast('Got it — Dash will calibrate.', { duration: 2000 });
        }
      }
    } catch {
      // Silent fail — feedback is non-critical
    } finally {
      setSending(false);
    }
  }, [conversationId, ratings]);

  return {
    ratings,
    sending,
    submitFeedback,
  };
}
