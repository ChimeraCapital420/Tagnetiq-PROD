// FILE: src/components/oracle/hooks/useOracleExtras.ts
// Sprint N gap-closers: learning, introductions, content creation
// These call separate API endpoints and inject results into the chat
// Designed to work alongside useOracleChat without modifying it

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ChatMessage, LearningStep, ContentResult } from '../types';

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

interface UseOracleExtrasParams {
  /** Append a message to the chat */
  appendMessage: (msg: ChatMessage) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
}

/**
 * Extended Oracle capabilities: learning paths, introductions, content creation.
 * Call these from OraclePage alongside useOracleChat.
 */
export function useOracleExtras({ appendMessage, setLoading }: UseOracleExtrasParams) {

  // ── Learning paths ─────────────────────────────────────
  const sendLearn = useCallback(async (
    topic: string,
    options?: {
      mode?: string;
      currentStep?: number;
      totalSteps?: number;
      userAnswer?: string;
    },
  ): Promise<string | null> => {
    setLoading(true);

    // Add user message
    appendMessage({
      role: 'user',
      content: options?.userAnswer || `Teach me about ${topic}`,
      timestamp: Date.now(),
    });

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/learn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic,
          mode: options?.mode || 'general',
          currentStep: options?.currentStep || 1,
          totalSteps: options?.totalSteps || 5,
          userAnswer: options?.userAnswer,
        }),
      });

      if (!res.ok) throw new Error('Learning request failed');

      const data = await res.json();
      const step = data.step as LearningStep;

      // Add Oracle response with learning card
      appendMessage({
        role: 'assistant',
        content: step.content,
        timestamp: Date.now(),
        attachments: [{ type: 'learning', step }],
      });

      return step.content;
    } catch (err) {
      console.error('Oracle learn error:', err);
      toast.error('Learning session failed. Try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [appendMessage, setLoading]);

  // ── Introductions ──────────────────────────────────────
  const findMatches = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/introductions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'find_matches' }),
      });

      if (!res.ok) throw new Error('Match search failed');

      const data = await res.json();

      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0]; // Best match
        appendMessage({
          role: 'assistant',
          content: `I found someone who shares your interests! ${match.matchReason}. Want me to see if they're open to connecting?`,
          timestamp: Date.now(),
          attachments: [{
            type: 'introduction',
            data: {
              matchId: match.matchId,
              sharedInterests: match.sharedInterests,
              matchDescription: match.matchReason,
              status: 'pending',
            },
          }],
        });
      } else {
        appendMessage({
          role: 'assistant',
          content: 'No strong collector matches found yet. Keep scanning and chatting — the more I learn about your interests, the better matches I can find.',
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      console.error('Oracle matchmaking error:', err);
      toast.error('Match search failed.');
    } finally {
      setLoading(false);
    }
  }, [appendMessage, setLoading]);

  const initiateIntroduction = useCallback(async (
    matchId: string,
    sharedInterests: string[],
    matchReason: string,
  ): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/oracle/introductions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'initiate',
          matchId,
          sharedInterests,
          matchReason,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        appendMessage({
          role: 'assistant',
          content: data.message || 'Introduction sent! Their Oracle will ask them if they\'re open to connecting.',
          timestamp: Date.now(),
        });
      }
    } catch {
      toast.error('Failed to send introduction.');
    }
  }, [appendMessage]);

  const respondToIntroduction = useCallback(async (
    introId: string,
    accepted: boolean,
  ): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/oracle/introductions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'respond',
          introId,
          accepted,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        appendMessage({
          role: 'assistant',
          content: data.message,
          timestamp: Date.now(),
        });
      }
    } catch {
      toast.error('Failed to respond to introduction.');
    }
  }, [appendMessage]);

  // ── Content creation (shortcuts) ──────────────────────
  const createListing = useCallback(async (
    itemName: string,
    platform = 'ebay',
    instructions?: string,
  ): Promise<ContentResult | null> => {
    setLoading(true);

    appendMessage({
      role: 'user',
      content: `List "${itemName}" on ${platform}${instructions ? ` — ${instructions}` : ''}`,
      timestamp: Date.now(),
    });

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'listing',
          itemName,
          platform,
          instructions,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          appendMessage({
            role: 'assistant',
            content: `Listing generation requires ${err.requiredTier || 'Pro'} tier. Want to learn about upgrading?`,
            timestamp: Date.now(),
          });
          return null;
        }
        throw new Error('Listing failed');
      }

      const data = await res.json();

      appendMessage({
        role: 'assistant',
        content: `Here's your ${platform} listing — check it out:`,
        timestamp: Date.now(),
        contentData: data,
        attachments: data.listing ? [{ type: 'listing', data: data.listing }] : undefined,
      });

      return data;
    } catch (err) {
      console.error('Oracle listing error:', err);
      toast.error('Listing generation failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [appendMessage, setLoading]);

  const createVideo = useCallback(async (
    itemName: string,
    style: 'showcase' | 'unboxing' | 'flip_story' | 'market_update' = 'showcase',
    platform: 'tiktok' | 'instagram' | 'youtube' = 'tiktok',
  ): Promise<ContentResult | null> => {
    setLoading(true);

    appendMessage({
      role: 'user',
      content: `Create a ${style} video for "${itemName}" on ${platform}`,
      timestamp: Date.now(),
    });

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'video',
          itemName,
          style,
          videoParams: { platform },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
          appendMessage({
            role: 'assistant',
            content: `Video creation requires Elite tier. ${err.message || ''}`,
            timestamp: Date.now(),
          });
          return null;
        }
        throw new Error('Video failed');
      }

      const data = await res.json();

      appendMessage({
        role: 'assistant',
        content: 'Script generated! Review it and I can send it to video production:',
        timestamp: Date.now(),
        contentData: data,
        attachments: data.videoUrl
          ? [{ type: 'video', url: data.videoUrl, status: data.videoStatus || 'ready' }]
          : undefined,
      });

      return data;
    } catch (err) {
      console.error('Oracle video error:', err);
      toast.error('Video creation failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [appendMessage, setLoading]);

  return {
    // Learning
    sendLearn,

    // Introductions
    findMatches,
    initiateIntroduction,
    respondToIntroduction,

    // Content
    createListing,
    createVideo,
  };
}
