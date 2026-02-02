// FILE: src/hooks/usePushNotifications.ts
// React hook for managing push notifications
// Mobile-first: Handles permissions, subscription, and preferences

import { useState, useEffect, useCallback } from 'react';

interface PushPreferences {
  watchlist: boolean;
  price_drops: boolean;
  messages: boolean;
  sales: boolean;
  categories: string[];
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'loading';
  isSubscribed: boolean;
  preferences: PushPreferences;
  subscribe: (prefs?: Partial<PushPreferences>) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<PushPreferences>) => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'loading'>('loading');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [preferences, setPreferences] = useState<PushPreferences>({
    watchlist: true,
    price_drops: true,
    messages: true,
    sales: true,
    categories: [],
  });

  // Check support and current state
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 
                        'PushManager' in window && 
                        'Notification' in window;
      
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
        
        // Check if already subscribed
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
          
          // Load preferences from server
          const response = await fetch('/api/notifications/push-subscribe');
          if (response.ok) {
            const data = await response.json();
            if (data.subscriptions?.length > 0) {
              const sub = data.subscriptions[0];
              setPreferences({
                watchlist: sub.notify_watchlist,
                price_drops: sub.notify_price_drops,
                messages: sub.notify_messages,
                sales: sub.notify_sales,
                categories: sub.categories || [],
              });
            }
          }
        } catch (err) {
          console.error('Error checking push status:', err);
        }
      } else {
        setPermission('denied');
      }
    };

    checkSupport();
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (err) {
      console.error('Permission request failed:', err);
      return 'denied';
    }
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (prefs?: Partial<PushPreferences>): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      // Request permission if not granted
      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== 'granted') {
        console.log('Notification permission not granted');
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Merge preferences
      const mergedPrefs = { ...preferences, ...prefs };

      // Send to server
      const response = await fetch('/api/notifications/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          categories: mergedPrefs.categories,
          notify_types: {
            watchlist: mergedPrefs.watchlist,
            price_drops: mergedPrefs.price_drops,
            messages: mergedPrefs.messages,
            sales: mergedPrefs.sales,
          },
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        setPreferences(mergedPrefs);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Subscribe failed:', err);
      return false;
    }
  }, [isSupported, preferences, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        await fetch('/api/notifications/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Unsubscribe failed:', err);
      return false;
    }
  }, [isSupported]);

  // Update preferences
  const updatePreferences = useCallback(async (prefs: Partial<PushPreferences>): Promise<boolean> => {
    const mergedPrefs = { ...preferences, ...prefs };
    
    if (isSubscribed) {
      // Re-subscribe with new preferences
      return subscribe(mergedPrefs);
    } else {
      setPreferences(mergedPrefs);
      return true;
    }
  }, [isSubscribed, preferences, subscribe]);

  return {
    isSupported,
    permission,
    isSubscribed,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    requestPermission,
  };
}

// Helper: Convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default usePushNotifications;