// FILE: src/features/boardroom/intelligence/offline-queue.ts
// Sprint 9: Offline Message Queue
//
// When the user sends a boardroom message with no network:
//   1. Message is saved to localStorage queue
//   2. Optimistic UI shows "Queued — will send when online"
//   3. When network returns, queue replays automatically
//   4. Failed replays retry with exponential backoff (max 3 attempts)
//
// Mobile-first: Mobile networks drop constantly. Users shouldn't lose
// their thoughts because they walked into an elevator.
//
// Uses localStorage (not IndexedDB) for simplicity and broad compat.
// Queue is capped at 10 messages to prevent storage bloat.

// =============================================================================
// TYPES
// =============================================================================

export interface QueuedMessage {
  /** Unique ID for deduplication */
  id: string;
  /** Meeting ID this message belongs to */
  meetingId: string;
  /** The message text */
  content: string;
  /** Full request payload (includes clientContext) */
  payload: Record<string, unknown>;
  /** When the message was queued */
  queuedAt: number;
  /** Number of replay attempts */
  attempts: number;
  /** Last error message (if any) */
  lastError?: string;
  /** Status */
  status: 'queued' | 'replaying' | 'failed';
}

export interface OfflineQueueState {
  /** Number of messages waiting to send */
  pendingCount: number;
  /** Whether we're currently online */
  isOnline: boolean;
  /** Whether the queue is actively replaying */
  isReplaying: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const QUEUE_KEY = 'boardroom_offline_queue';
const MAX_QUEUE_SIZE = 10;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 2000; // 2 seconds, doubles each retry

// =============================================================================
// QUEUE STORAGE
// =============================================================================

function getQueue(): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const queue: QueuedMessage[] = JSON.parse(raw);
    // Clean up stale messages (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return queue.filter(m => m.queuedAt > oneHourAgo);
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full — silently drop oldest
    try {
      const trimmed = queue.slice(-5);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
    } catch {
      // truly out of space — nothing we can do
    }
  }
}

// =============================================================================
// QUEUE OPERATIONS
// =============================================================================

/**
 * Add a message to the offline queue.
 * Returns the queued message with generated ID.
 */
export function enqueueMessage(
  meetingId: string,
  content: string,
  payload: Record<string, unknown>,
): QueuedMessage {
  const queue = getQueue();

  const msg: QueuedMessage = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    meetingId,
    content,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    status: 'queued',
  };

  // Cap queue size — drop oldest if full
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }

  queue.push(msg);
  saveQueue(queue);

  return msg;
}

/**
 * Remove a message from the queue (after successful send).
 */
export function dequeueMessage(id: string): void {
  const queue = getQueue().filter(m => m.id !== id);
  saveQueue(queue);
}

/**
 * Mark a message as failed with error.
 */
function markFailed(id: string, error: string): void {
  const queue = getQueue();
  const msg = queue.find(m => m.id === id);
  if (msg) {
    msg.attempts++;
    msg.lastError = error;
    msg.status = msg.attempts >= MAX_ATTEMPTS ? 'failed' : 'queued';
  }
  saveQueue(queue);
}

/**
 * Get all pending messages (queued, not permanently failed).
 */
export function getPendingMessages(): QueuedMessage[] {
  return getQueue().filter(m => m.status === 'queued');
}

/**
 * Get count of pending messages.
 */
export function getPendingCount(): number {
  return getPendingMessages().length;
}

/**
 * Clear the entire queue (e.g., user logs out).
 */
export function clearQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // noop
  }
}

// =============================================================================
// NETWORK DETECTION
// =============================================================================

/**
 * Check if the browser thinks we're online.
 * Falls back to true if navigator.onLine isn't available.
 */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// =============================================================================
// REPLAY ENGINE
// =============================================================================

/** Whether a replay is currently in progress */
let isCurrentlyReplaying = false;

/**
 * Replay all queued messages. Called when network comes back.
 *
 * @param sendFn - The actual send function from useMeeting
 *   Signature: (meetingId: string, payload: Record<string, unknown>) => Promise<boolean>
 *   Returns true if successful, false if failed.
 *
 * @param onMessageSent - Callback when a queued message sends successfully
 * @param onReplayComplete - Callback when all queued messages have been processed
 */
export async function replayQueue(
  sendFn: (meetingId: string, payload: Record<string, unknown>) => Promise<boolean>,
  onMessageSent?: (msg: QueuedMessage) => void,
  onReplayComplete?: (sent: number, failed: number) => void,
): Promise<void> {
  if (isCurrentlyReplaying) return;
  isCurrentlyReplaying = true;

  const pending = getPendingMessages();
  if (pending.length === 0) {
    isCurrentlyReplaying = false;
    return;
  }

  let sent = 0;
  let failed = 0;

  for (const msg of pending) {
    // Exponential backoff delay between retries
    if (msg.attempts > 0) {
      const delay = BASE_RETRY_DELAY * Math.pow(2, msg.attempts - 1);
      await new Promise(r => setTimeout(r, delay));
    }

    // Check network before each send
    if (!isOnline()) {
      // Network dropped again — stop replay
      break;
    }

    try {
      const success = await sendFn(msg.meetingId, msg.payload);
      if (success) {
        dequeueMessage(msg.id);
        onMessageSent?.(msg);
        sent++;
      } else {
        markFailed(msg.id, 'Send returned false');
        failed++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      markFailed(msg.id, errorMsg);
      failed++;
    }
  }

  isCurrentlyReplaying = false;
  onReplayComplete?.(sent, failed);
}

// =============================================================================
// NETWORK EVENT LISTENERS
// =============================================================================

/** Registered cleanup functions */
const cleanupFns: Array<() => void> = [];

/**
 * Start listening for online/offline events.
 * Call this once on mount, returns a cleanup function.
 *
 * @param onOnline - Called when network comes back
 * @param onOffline - Called when network drops
 */
export function startNetworkListeners(
  onOnline: () => void,
  onOffline: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.debug('[Intelligence] Network restored');
    onOnline();
  };

  const handleOffline = () => {
    console.debug('[Intelligence] Network lost');
    onOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  const cleanup = () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };

  cleanupFns.push(cleanup);
  return cleanup;
}