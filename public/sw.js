// FILE: public/sw.js
// Service Worker for Push Notifications
// Handles background notification receipt and click actions

const CACHE_NAME = 'tagnetiq-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'TagnetIQ',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    url: '/marketplace',
  };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    image: data.image,
    vibrate: [100, 50, 100],
    data: {
      url: data.url,
      ...data.data,
    },
    actions: getActionsForEvent(data.event_type),
    requireInteraction: data.event_type === 'new_message',
    tag: data.event_type || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/marketplace';
  
  // Handle action buttons
  if (event.action === 'view') {
    // Default action - open the URL
  } else if (event.action === 'dismiss') {
    return; // Just close the notification
  } else if (event.action === 'reply' && event.notification.data?.listing_id) {
    // Open messages for that listing
    const listingId = event.notification.data.listing_id;
    event.waitUntil(
      clients.openWindow(`/messages?listing=${listingId}`)
    );
    return;
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  // Could track dismissal analytics here
});

// Helper: Get actions based on event type
function getActionsForEvent(eventType) {
  switch (eventType) {
    case 'new_message':
      return [
        { action: 'reply', title: '💬 Reply', icon: '/icons/reply.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'price_drop':
      return [
        { action: 'view', title: '🛒 View Deal', icon: '/icons/cart.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'watchlist_match':
    case 'new_listing':
      return [
        { action: 'view', title: '👀 View', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    case 'sale_completed':
    case 'listing_sold':
      return [
        { action: 'view', title: '🎉 Details', icon: '/icons/check.png' },
      ];
    default:
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }
}

// Background sync (for offline message queue)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Implement offline message queue sync
  console.log('[SW] Syncing messages...');
}

// Push subscription change (key rotation)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    fetch('/api/notifications/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldSubscription: event.oldSubscription,
        newSubscription: event.newSubscription,
      }),
    })
  );
});