// FILE: public/sw.js
// Service Worker for TagnetIQ
// Handles: push notifications, offline scan queue, Oracle conversation caching
// Enhanced: Argos alerts, Oracle notification routing, background sync

const CACHE_NAME = 'tagnetiq-v2';
const ORACLE_CACHE = 'tagnetiq-oracle-v1';

// Static assets to cache for offline
const STATIC_ASSETS = [
  '/offline.html',
];

// =============================================================================
// INSTALL
// =============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// =============================================================================
// ACTIVATE — clean old caches
// =============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v2');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== ORACLE_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

// =============================================================================
// FETCH — cache strategy for Oracle conversations
// =============================================================================

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache Oracle conversation data (GET requests only)
  if (url.pathname.startsWith('/api/oracle/conversations') && event.request.method === 'GET') {
    event.respondWith(
      caches.open(ORACLE_CACHE).then(cache =>
        fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Offline fallback — return cached version
            return cache.match(event.request);
          })
      )
    );
    return;
  }

  // Default: network-first for everything else
  // (don't cache API calls or dynamic content aggressively)
});

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

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
    requireInteraction: shouldRequireInteraction(data.event_type),
    tag: data.event_type || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// =============================================================================
// NOTIFICATION CLICK
// =============================================================================

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  let urlToOpen = event.notification.data?.url || '/marketplace';

  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }

  if (event.action === 'reply' && event.notification.data?.listing_id) {
    urlToOpen = `/messages?listing=${event.notification.data.listing_id}`;
  }

  // Oracle-specific routing
  if (event.action === 'view_oracle' || event.notification.data?.event_type === 'oracle_alert') {
    urlToOpen = '/oracle';
    // If there's a conversation ID, append it
    if (event.notification.data?.conversation_id) {
      urlToOpen = `/oracle?convo=${event.notification.data.conversation_id}`;
    }
  }

  // Argos alert — open Oracle with context
  if (event.notification.data?.event_type === 'argos_alert') {
    urlToOpen = '/oracle';
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// =============================================================================
// NOTIFICATION CLOSE
// =============================================================================

self.addEventListener('notificationclose', (event) => {
  // Track dismissal analytics if needed
  console.log('[SW] Notification closed:', event.notification.tag);
});

// =============================================================================
// BACKGROUND SYNC — offline scan queue
// =============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }

  if (event.tag === 'sync-scans') {
    event.waitUntil(syncOfflineScans());
  }

  if (event.tag === 'sync-oracle-messages') {
    event.waitUntil(syncOracleMessages());
  }
});

/**
 * Sync offline message queue
 */
async function syncMessages() {
  console.log('[SW] Syncing messages...');
  try {
    const db = await openDB();
    const tx = db.transaction('offline-messages', 'readwrite');
    const store = tx.objectStore('offline-messages');
    const messages = await getAllFromStore(store);

    for (const msg of messages) {
      try {
        const response = await fetch(msg.url, {
          method: 'POST',
          headers: msg.headers,
          body: JSON.stringify(msg.body),
        });

        if (response.ok) {
          store.delete(msg.id);
        }
      } catch (err) {
        console.error('[SW] Failed to sync message:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync messages failed:', err);
  }
}

/**
 * Sync offline Oracle chat messages
 */
async function syncOracleMessages() {
  console.log('[SW] Syncing Oracle messages...');
  try {
    const db = await openDB();
    const tx = db.transaction('oracle-queue', 'readwrite');
    const store = tx.objectStore('oracle-queue');
    const queued = await getAllFromStore(store);

    for (const item of queued) {
      try {
        const response = await fetch('/api/oracle/chat', {
          method: 'POST',
          headers: item.headers,
          body: JSON.stringify(item.body),
        });

        if (response.ok) {
          store.delete(item.id);
          // Notify the client about the synced response
          const clients = await self.clients.matchAll({ type: 'window' });
          const data = await response.json();
          for (const client of clients) {
            client.postMessage({
              type: 'oracle-sync-complete',
              messageId: item.id,
              response: data,
            });
          }
        }
      } catch (err) {
        console.error('[SW] Failed to sync Oracle message:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync Oracle messages failed:', err);
  }
}

/**
 * Sync offline scans (images captured offline)
 */
async function syncOfflineScans() {
  console.log('[SW] Syncing offline scans...');
  // Future: send queued scan images to /api/oracle/see
}

// =============================================================================
// PUSH SUBSCRIPTION CHANGE
// =============================================================================

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

// =============================================================================
// MESSAGE HANDLER — communication with main app
// =============================================================================

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Queue Oracle message for offline sync
  if (event.data?.type === 'QUEUE_ORACLE_MESSAGE') {
    queueOracleMessage(event.data.payload).catch(console.error);
  }

  // Clear Oracle cache (on logout)
  if (event.data?.type === 'CLEAR_ORACLE_CACHE') {
    caches.delete(ORACLE_CACHE).catch(console.error);
  }
});

// =============================================================================
// HELPERS
// =============================================================================

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
    // Oracle-specific notifications
    case 'oracle_alert':
    case 'argos_alert':
      return [
        { action: 'view_oracle', title: '🔮 Open Oracle', icon: '/icons/oracle.png' },
        { action: 'dismiss', title: 'Later' },
      ];
    case 'oracle_introduction':
      return [
        { action: 'view_oracle', title: '👋 View', icon: '/icons/oracle.png' },
        { action: 'dismiss', title: 'Skip' },
      ];
    default:
      return [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }
}

function shouldRequireInteraction(eventType) {
  // These notifications stay until explicitly dismissed
  return ['new_message', 'oracle_introduction', 'argos_alert'].includes(eventType);
}

// =============================================================================
// INDEXEDDB HELPERS (for offline queue)
// =============================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tagnetiq-sw', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-messages')) {
        db.createObjectStore('offline-messages', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('oracle-queue')) {
        db.createObjectStore('oracle-queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

async function queueOracleMessage(payload) {
  const db = await openDB();
  const tx = db.transaction('oracle-queue', 'readwrite');
  tx.objectStore('oracle-queue').add(payload);
}
