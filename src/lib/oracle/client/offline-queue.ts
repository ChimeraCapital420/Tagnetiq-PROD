// FILE: src/lib/oracle/client/offline-queue.ts
// ═══════════════════════════════════════════════════════════════════════
// Offline Message Queue (Service Worker Integration)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
//
// When the user sends a message while offline, this queues it via
// the service worker's Background Sync API. When connectivity returns,
// the service worker replays the queued messages automatically.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Queue a message for offline sync via the service worker.
 * Called when a fetch() to the Oracle API fails with a network error.
 *
 * The service worker handles:
 *   1. Storing the message in IndexedDB
 *   2. Registering a Background Sync event ('sync-oracle-messages')
 *   3. Replaying messages when connectivity returns
 *
 * Silently fails if:
 *   - Service worker is not available
 *   - Service worker is not controlling the page
 *   - Background Sync API is not supported
 *
 * @param message - The user's message text to queue
 */
export function queueForOfflineSync(message: string): void {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  // Send message to service worker for queueing
  navigator.serviceWorker.controller.postMessage({
    type: 'QUEUE_ORACLE_MESSAGE',
    payload: {
      url: '/api/oracle/chat',
      headers: { 'Content-Type': 'application/json' },
      body: { message },
      timestamp: Date.now(),
    },
  });

  // Register Background Sync (if supported)
  navigator.serviceWorker.ready.then(reg => {
    if ('sync' in reg) {
      (reg as any).sync.register('sync-oracle-messages').catch(() => {});
    }
  });
}