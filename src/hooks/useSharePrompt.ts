// FILE: src/hooks/useSharePrompt.ts
// Share Prompt Hook — Oracle naturally suggests sharing
//
// Sprint E: Integrates with the share prompt engine.
// Call after scans, Oracle chats, vault milestones, etc.
//
// Usage:
//   const { checkSharePrompt, sharePrompt, dismissPrompt, handleShare } = useSharePrompt();
//
//   // After a scan completes:
//   await checkSharePrompt('great_scan', { category: 'coins', value: 2400 });
//
//   // In your UI:
//   {sharePrompt && (
//     <SharePromptBanner
//       message={sharePrompt.message}
//       onShare={() => handleShare('twitter')}
//       onDismiss={dismissPrompt}
//     />
//   )}

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/useAnalytics';

type ShareTrigger =
  | 'great_scan'
  | 'flip_success'
  | 'milestone'
  | 'oracle_exchange'
  | 'rare_find'
  | 'first_scan'
  | 'vault_milestone'
  | 'streak';

interface SharePromptState {
  message: string;
  promptId: string;
  trigger: ShareTrigger;
}

export function useSharePrompt() {
  const { user } = useAuth();
  const { trackShare } = useAnalytics();
  const [sharePrompt, setSharePrompt] = useState<SharePromptState | null>(null);

  /**
   * Check if a share prompt should be shown.
   * Call this after significant events (scan, Oracle chat, sale, etc.)
   */
  const checkSharePrompt = useCallback(async (
    trigger: ShareTrigger,
    context: Record<string, any> = {}
  ) => {
    if (!user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/oracle/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'share_prompt',
          trigger,
          context,
        }),
      });

      const data = await res.json();

      if (data.prompt) {
        setSharePrompt({
          message: data.prompt.message,
          promptId: data.prompt.promptId,
          trigger,
        });
        trackShare('prompt_shown', { trigger });
      }
    } catch {
      // Never fail the parent operation for a share prompt
    }
  }, [user, trackShare]);

  /**
   * User chose to share. Opens native share or copies link.
   */
  const handleShare = useCallback(async (platform?: string) => {
    if (!sharePrompt || !user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Track the share
      await fetch('/api/oracle/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'share_response',
          promptId: sharePrompt.promptId,
          shared: true,
          platform: platform || 'native',
        }),
      });

      trackShare('completed', { trigger: sharePrompt.trigger, platform });

      // Use native share API on mobile, fallback to clipboard
      const shareData = {
        title: 'Check out TagnetIQ',
        text: 'My Oracle just identified something incredible. Try it yourself.',
        url: window.location.origin,
      };

      if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        // The parent component can show a toast for "Link copied!"
      }

      setSharePrompt(null);
      return true;
    } catch {
      return false;
    }
  }, [sharePrompt, user, trackShare]);

  /**
   * User dismissed the prompt.
   */
  const dismissPrompt = useCallback(async () => {
    if (!sharePrompt || !user) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch('/api/oracle/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'share_response',
          promptId: sharePrompt.promptId,
          shared: false,
        }),
      });

      trackShare('dismissed', { trigger: sharePrompt.trigger });
    } catch {
      // Silent fail
    }

    setSharePrompt(null);
  }, [sharePrompt, user, trackShare]);

  return {
    checkSharePrompt,
    sharePrompt,
    handleShare,
    dismissPrompt,
  };
}