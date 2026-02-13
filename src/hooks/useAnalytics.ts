// FILE: src/hooks/useAnalytics.ts
// Client-side analytics hook
//
// Usage:
//   const { trackEvent, trackFeature, trackScan } = useAnalytics();
//   trackEvent('scan_complete', 'scan', { category: 'coins', durationMs: 2400 });
//   trackFeature('ghost_mode');
//   trackScan({ category: 'watches', success: true, durationMs: 3100 });
//
// All events are batched and sent every 5 seconds to minimize API calls.
// On unmount or page hide, remaining events are flushed.

import { useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface PendingEvent {
  event: string;
  category: string;
  properties?: Record<string, any>;
  platform?: string;
}

const BATCH_INTERVAL_MS = 5000;

// Detect platform
function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios_web';
  if (/android/.test(ua)) return 'android_web';
  if (/mobile/.test(ua)) return 'mobile_web';
  return 'desktop_web';
}

export function useAnalytics() {
  const { user } = useAuth();
  const queue = useRef<PendingEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    if (queue.current.length === 0 || !user) return;

    const events = [...queue.current];
    queue.current = [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch('/api/admin/kpis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'track', events }),
      });
    } catch {
      // Re-queue on failure (max 50 to prevent memory leak)
      queue.current = [...events, ...queue.current].slice(0, 50);
    }
  }, [user]);

  // Batch timer
  useEffect(() => {
    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    // Flush on page hide (mobile tab switch, close)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flush(); // Flush remaining on unmount
    };
  }, [flush]);

  const trackEvent = useCallback((event: string, category: string, properties?: Record<string, any>) => {
    queue.current.push({
      event,
      category,
      properties,
      platform: detectPlatform(),
    });
  }, []);

  const trackFeature = useCallback((feature: string) => {
    trackEvent('feature_used', 'feature', { feature });
  }, [trackEvent]);

  const trackScan = useCallback((props: {
    category?: string; durationMs?: number; success: boolean;
    providersUsed?: number; confidence?: number;
  }) => {
    trackEvent(props.success ? 'scan_complete' : 'scan_error', 'scan', props);
  }, [trackEvent]);

  const trackOracleChat = useCallback((props: {
    hasVoice?: boolean; responseTimeMs?: number; provider?: string;
  }) => {
    trackEvent('oracle_chat', 'oracle', props);
  }, [trackEvent]);

  const trackVaultAction = useCallback((action: string, props?: {
    vaultType?: string; category?: string;
  }) => {
    trackEvent(`vault_${action}`, 'vault', props);
  }, [trackEvent]);

  const trackOnboarding = useCallback((step: string, tourId?: string) => {
    trackEvent(`onboard_${step}`, 'onboarding', { step, tourId });
  }, [trackEvent]);

  const trackShare = useCallback((action: 'prompt_shown' | 'completed' | 'dismissed', props?: {
    trigger?: string; platform?: string;
  }) => {
    trackEvent(`share_${action}`, 'share', props);
  }, [trackEvent]);

  return {
    trackEvent,
    trackFeature,
    trackScan,
    trackOracleChat,
    trackVaultAction,
    trackOnboarding,
    trackShare,
  };
}