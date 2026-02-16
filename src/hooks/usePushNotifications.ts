// FILE: src/hooks/usePushNotifications.ts
// Push notification subscription — registers device for Oracle/Argos alerts
// Mobile-first: checks support, requests permission, subscribes via service worker
// Sends subscription to backend for push delivery

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  loading: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: 'unsupported',
    subscribed: false,
    loading: false,
  });

  // ── Check support on mount ────────────────────────────
  useEffect(() => {
    const supported = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;

    if (!supported) return;

    setState(prev => ({
      ...prev,
      supported: true,
      permission: Notification.permission,
    }));

    // Check if already subscribed
    checkExistingSubscription();
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(prev => ({ ...prev, subscribed: !!sub }));
    } catch {
      // Silently fail — not critical
    }
  }, []);

  // ── Subscribe to push notifications ───────────────────
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.supported) return false;

    setState(prev => ({ ...prev, loading: true }));

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        setState(prev => ({ ...prev, loading: false }));
        return false;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Check for existing subscription
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        // VAPID public key should be in env
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.warn('[Push] No VAPID public key configured');
          setState(prev => ({ ...prev, loading: false }));
          return false;
        }

        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // Send subscription to backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setState(prev => ({ ...prev, loading: false }));
        return false;
      }

      const response = await fetch('/api/notifications/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          device: {
            type: detectDeviceType(),
            userAgent: navigator.userAgent,
          },
        }),
      });

      if (response.ok) {
        setState(prev => ({ ...prev, subscribed: true, loading: false }));
        return true;
      }

      setState(prev => ({ ...prev, loading: false }));
      return false;

    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      setState(prev => ({ ...prev, loading: false }));
      return false;
    }
  }, [state.supported]);

  // ── Unsubscribe ───────────────────────────────────────
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify backend
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/notifications/push-subscribe', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
            }),
          }).catch(() => {});
        }
      }

      setState(prev => ({ ...prev, subscribed: false }));
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/macintosh|mac os/.test(ua)) return 'mac';
  if (/windows/.test(ua)) return 'windows';
  return 'web';
}
