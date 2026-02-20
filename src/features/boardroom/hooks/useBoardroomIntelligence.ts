// FILE: src/features/boardroom/hooks/useBoardroomIntelligence.ts
// Sprint 9: Boardroom Client-Side Intelligence Hook
//
// Main orchestrator that wires all 4 intelligence systems together.
// Returns a single `enrich()` function that the sendMessage flow calls
// to attach client-side hints to every outgoing message.
//
// Usage in useMeeting.ts:
//   const intelligence = useBoardroomIntelligence(members, activeMeeting);
//   // In sendMessage:
//   body: { ...payload, clientContext: intelligence.enrich(messageText) }
//
// The server TRUSTS these hints to skip redundant computation,
// but VALIDATES everything — zero risk if client is wrong.

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BoardMember, Meeting, MeetingType } from '../types';

// Intelligence modules
import {
  detectClientEnergy,
  estimateRoomEnergy,
  type ClientEnergyResult,
  type ClientRoomEnergyHint,
} from '../intelligence/client-energy';

import {
  previewRouting,
  detectClientTopic,
  type ClientRoutingPreview,
} from '../intelligence/client-router';

import {
  preloadCognitiveContext,
  getCachedContext,
  clearCachedContext,
  getCachedMemberTrust,
  type CachedCognitiveContext,
} from '../intelligence/context-preload';

import {
  isOnline,
  getPendingCount,
  startNetworkListeners,
  replayQueue,
  enqueueMessage,
  type QueuedMessage,
} from '../intelligence/offline-queue';

// =============================================================================
// TYPES
// =============================================================================

/** The enriched client context attached to every outgoing message */
export interface BoardroomClientContext {
  /** Client-detected energy */
  energy: {
    type: string;
    confidence: number;
    signals: string[];
  };
  /** Client-detected topic + routing preview */
  routing: {
    predictedPrimarySlug: string | null;
    topic: string;
    topicConfidence: number;
    supporting: string[];
  };
  /** Room energy hints */
  roomHints: {
    engagement: string;
    momentum: string;
    timeSinceLastMessage: number;
  };
  /** Cached cognitive context (if available from preload) */
  cachedContext: {
    memberTrust: Record<string, number>;
    memberTiers: Record<string, string>;
    recentTopics: string[];
    cachedAt: number;
  } | null;
  /** Device info */
  device: {
    type: 'mobile' | 'tablet' | 'desktop';
    isOnline: boolean;
    timestamp: number;
  };
}

/** Return type of the hook */
export interface UseBoardroomIntelligenceReturn {
  /** Enrich a message with client-side intelligence */
  enrich: (message: string) => BoardroomClientContext;
  /** Preview routing for a message (for UI display) */
  routingPreview: (message: string) => ClientRoutingPreview;
  /** Current energy detection (for real-time UI) */
  detectEnergy: (message: string) => ClientEnergyResult;
  /** Whether we're online */
  online: boolean;
  /** Number of queued offline messages */
  pendingOffline: number;
  /** Whether cognitive context is preloaded */
  contextReady: boolean;
  /** Queue a message for offline send */
  queueOffline: (meetingId: string, content: string, payload: Record<string, unknown>) => QueuedMessage;
  /** Replay queued messages */
  replay: (sendFn: (meetingId: string, payload: Record<string, unknown>) => Promise<boolean>) => Promise<void>;
  /** Clear cached context (call on meeting change) */
  clearContext: () => void;
}

// =============================================================================
// DEVICE DETECTION
// =============================================================================

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

// =============================================================================
// HOOK
// =============================================================================

export function useBoardroomIntelligence(
  members: BoardMember[],
  activeMeeting?: Meeting | null,
): UseBoardroomIntelligenceReturn {
  // State
  const [online, setOnline] = useState(() => isOnline());
  const [pendingOffline, setPendingOffline] = useState(() => getPendingCount());
  const [contextReady, setContextReady] = useState(false);

  // Track message timestamps for room energy estimation
  const messageTimestampsRef = useRef<number[]>([]);

  // ── Preload cognitive context on mount ──────────────────
  useEffect(() => {
    let mounted = true;

    preloadCognitiveContext().then((ctx) => {
      if (mounted && ctx) {
        setContextReady(true);
      }
    });

    return () => { mounted = false; };
  }, []);

  // ── Clear context when meeting changes ─────────────────
  useEffect(() => {
    // Reset message timestamps when meeting changes
    messageTimestampsRef.current = [];
  }, [activeMeeting?.id]);

  // ── Network listeners ──────────────────────────────────
  useEffect(() => {
    const cleanup = startNetworkListeners(
      () => {
        setOnline(true);
        // Network restored — update pending count
        setPendingOffline(getPendingCount());
      },
      () => {
        setOnline(false);
      },
    );

    return cleanup;
  }, []);

  // ── Determine meeting participants ─────────────────────
  const getParticipantSlugs = useCallback((): string[] | undefined => {
    if (!activeMeeting) return undefined;
    if (activeMeeting.meeting_type === 'full_board' || activeMeeting.meeting_type === 'vote') {
      return members.map(m => m.slug);
    }
    if (activeMeeting.participants) {
      return members
        .filter(m => activeMeeting.participants?.includes(m.id))
        .map(m => m.slug);
    }
    return undefined;
  }, [activeMeeting, members]);

  // ── Core: Enrich a message with all client intelligence ──
  const enrich = useCallback((message: string): BoardroomClientContext => {
    // Track this message timestamp
    messageTimestampsRef.current.push(Date.now());
    // Keep only last 20 timestamps
    if (messageTimestampsRef.current.length > 20) {
      messageTimestampsRef.current = messageTimestampsRef.current.slice(-20);
    }

    // 1. Energy detection
    const energy = detectClientEnergy(message);

    // 2. Topic + routing
    const { topic, confidence: topicConfidence } = detectClientTopic(message);
    const routing = previewRouting(
      message,
      members,
      activeMeeting?.meeting_type,
      getParticipantSlugs(),
    );

    // 3. Room energy estimation
    const roomHints = estimateRoomEnergy(message, messageTimestampsRef.current);

    // 4. Cached cognitive context
    const cached = getCachedContext();
    const cachedContext = cached ? {
      memberTrust: cached.memberTrust,
      memberTiers: cached.memberTiers,
      recentTopics: cached.recentTopics,
      cachedAt: cached.cachedAt,
    } : null;

    return {
      energy: {
        type: energy.energy,
        confidence: energy.confidence,
        signals: energy.signals,
      },
      routing: {
        predictedPrimarySlug: routing.primarySlug,
        topic,
        topicConfidence,
        supporting: routing.supporting,
      },
      roomHints: {
        engagement: roomHints.engagement,
        momentum: roomHints.momentum,
        timeSinceLastMessage: roomHints.timeSinceLastMessage,
      },
      cachedContext,
      device: {
        type: getDeviceType(),
        isOnline: isOnline(),
        timestamp: Date.now(),
      },
    };
  }, [members, activeMeeting, getParticipantSlugs]);

  // ── Routing preview (for real-time UI before send) ─────
  const routingPreview = useCallback((message: string): ClientRoutingPreview => {
    return previewRouting(
      message,
      members,
      activeMeeting?.meeting_type,
      getParticipantSlugs(),
    );
  }, [members, activeMeeting, getParticipantSlugs]);

  // ── Queue offline message ──────────────────────────────
  const queueOffline = useCallback((
    meetingId: string,
    content: string,
    payload: Record<string, unknown>,
  ): QueuedMessage => {
    const msg = enqueueMessage(meetingId, content, payload);
    setPendingOffline(getPendingCount());
    return msg;
  }, []);

  // ── Replay queued messages ─────────────────────────────
  const replay = useCallback(async (
    sendFn: (meetingId: string, payload: Record<string, unknown>) => Promise<boolean>,
  ): Promise<void> => {
    await replayQueue(
      sendFn,
      () => {
        // On each successful send, update count
        setPendingOffline(getPendingCount());
      },
      (sent, failed) => {
        setPendingOffline(getPendingCount());
        if (sent > 0) {
          console.debug(`[Intelligence] Replayed ${sent} queued messages (${failed} failed)`);
        }
      },
    );
  }, []);

  // ── Clear context ──────────────────────────────────────
  const clearContext = useCallback(() => {
    clearCachedContext();
    setContextReady(false);
    messageTimestampsRef.current = [];
  }, []);

  return {
    enrich,
    routingPreview,
    detectEnergy: detectClientEnergy,
    online,
    pendingOffline,
    contextReady,
    queueOffline,
    replay,
    clearContext,
  };
}

export default useBoardroomIntelligence;