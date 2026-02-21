// FILE: src/features/boardroom/hooks/useMeeting.ts
// Hook for meeting management and chat functionality
//
// Sprint 9: Client-Side Intelligence Integration
//   - Every sendMessage attaches clientContext (energy, routing, room hints)
//   - Offline queue: messages saved locally when network drops
//   - Network restoration: queued messages replay automatically
//   - Routing preview exposed for UI ("Athena is preparing..." before send)

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { 
  Meeting, 
  Message, 
  MeetingType,
  BoardMember,
  BoardResponse,
  ChatResponse,
  UseMeetingReturn 
} from '../types';
import { 
  API_ENDPOINTS, 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  PARTICIPANT_REQUIRED_TYPES 
} from '../constants';

// Sprint 9: Intelligence
import { useBoardroomIntelligence } from './useBoardroomIntelligence';
import type { BoardroomClientContext } from './useBoardroomIntelligence';
import { isOnline as checkOnline } from '../intelligence/offline-queue';

// =============================================================================
// TYPES
// =============================================================================

interface UseMeetingOptions {
  members: BoardMember[];
  onMeetingCreated?: (meeting: Meeting) => void;
}

// Extend the return type with Sprint 9 intelligence
export interface UseMeetingWithIntelligence extends UseMeetingReturn {
  /** Sprint 9: Whether the device is online */
  isOnline: boolean;
  /** Sprint 9: Number of messages queued for offline send */
  pendingOfflineCount: number;
  /** Sprint 9: Whether cognitive context is preloaded */
  contextReady: boolean;
  /** Sprint 9: Preview which member will respond for a given message */
  routingPreview: (message: string) => {
    primarySlug: string | null;
    primaryName: string;
    topic: string;
    confidence: number;
  };
  /** Sprint 9: Detect energy from message text (for real-time UI) */
  detectEnergy: (message: string) => {
    energy: string;
    confidence: number;
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useMeeting(options: UseMeetingOptions): UseMeetingWithIntelligence {
  const { members, onMeetingCreated } = options;

  // State
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState<string[]>([]);

  // Sprint 9: Wire intelligence
  const intelligence = useBoardroomIntelligence(members, activeMeeting);

  // Get auth session helper
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error(ERROR_MESSAGES.notAuthenticated);
    }
    return session;
  };

  // ==========================================================================
  // Sprint 9: Auto-replay queued messages when network restores
  // ==========================================================================
  useEffect(() => {
    if (intelligence.online && intelligence.pendingOffline > 0) {
      intelligence.replay(async (meetingId, payload) => {
        try {
          const session = await getSession();
          const response = await fetch(API_ENDPOINTS.chat, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          return response.ok;
        } catch {
          return false;
        }
      }).then(() => {
        const remaining = intelligence.pendingOffline;
        if (remaining === 0) {
          toast.success('Queued messages sent successfully');
        }
      });
    }
  }, [intelligence.online]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // Clear context when meeting changes
  // ==========================================================================
  useEffect(() => {
    intelligence.clearContext();
  }, [activeMeeting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // Create a new meeting
  // ==========================================================================
  const createMeeting = useCallback(async (
    title: string, 
    type: MeetingType, 
    participantSlugs?: string[]
  ): Promise<Meeting | null> => {
    try {
      const session = await getSession();

      // Convert slugs to IDs if needed
      let participants: string[] | null = null;
      if (PARTICIPANT_REQUIRED_TYPES.includes(type as any) && participantSlugs) {
        participants = participantSlugs
          .map(slug => members.find(m => m.slug === slug)?.id)
          .filter((id): id is string => Boolean(id));
      }

      const response = await fetch(API_ENDPOINTS.meetings, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          meeting_type: type,
          participants,
        }),
      });

      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.meetingCreateFailed);
      }

      const meeting: Meeting = await response.json();
      
      setActiveMeeting(meeting);
      setMessages([]);
      onMeetingCreated?.(meeting);
      toast.success(SUCCESS_MESSAGES.meetingCreated);
      
      return meeting;
    } catch (err) {
      console.error('Create meeting error:', err);
      toast.error(ERROR_MESSAGES.meetingCreateFailed);
      return null;
    }
  }, [members, onMeetingCreated]);

  // ==========================================================================
  // Load an existing meeting
  // ==========================================================================
  const loadMeeting = useCallback(async (meeting: Meeting): Promise<void> => {
    try {
      const session = await getSession();

      const response = await fetch(`${API_ENDPOINTS.meetings}?id=${meeting.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.meetingLoadFailed);
      }

      const data = await response.json();
      setActiveMeeting(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Load meeting error:', err);
      toast.error(ERROR_MESSAGES.meetingLoadFailed);
    }
  }, []);

  // ==========================================================================
  // Send a message in the active meeting
  // Sprint 9: Enriched with client intelligence + offline queue fallback
  // ==========================================================================
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim() || !activeMeeting || sending) return;

    setSending(true);
    const messageText = content.trim();

    // ── Sprint 9: Client-side intelligence (runs BEFORE network) ──
    const clientContext: BoardroomClientContext = intelligence.enrich(messageText);

    // Determine which members should respond
    let respondingMembers: string[] = [];
    if (activeMeeting.meeting_type === 'full_board' || activeMeeting.meeting_type === 'vote') {
      respondingMembers = members.map(m => m.slug);
    } else if (activeMeeting.participants) {
      const participantMembers = members.filter(m => 
        activeMeeting.participants?.includes(m.id)
      );
      respondingMembers = participantMembers.map(m => m.slug);
    } else {
      respondingMembers = members.map(m => m.slug);
    }

    setLoadingResponses(respondingMembers);

    // Add optimistic user message
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_type: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Build the full request payload
    const payload: Record<string, any> = {
      meeting_id: activeMeeting.id,
      message: messageText,
      // Sprint 9: Attach client intelligence
      clientContext,
    };

    // Route: tell chat.ts which handler to use
    if (activeMeeting.meeting_type === 'full_board' || activeMeeting.meeting_type === 'vote') {
      payload.mention_all = true;
    } else if (activeMeeting.meeting_type === 'committee' && respondingMembers.length >= 2) {
      payload.committee_members = respondingMembers;
    } else if (respondingMembers.length === 1) {
      payload.member_slug = respondingMembers[0];
    } else if (respondingMembers.length >= 2) {
      payload.committee_members = respondingMembers;
    } else {
      payload.mention_all = true;
    }

    // ── Sprint 9: Offline check — queue if no network ──
    if (!checkOnline()) {
      intelligence.queueOffline(activeMeeting.id, messageText, payload);
      toast.info('Message queued — will send when back online');
      // Update the optimistic message to show queued state
      setMessages(prev => prev.map(m => 
        m.id === tempUserMsg.id 
          ? { ...m, content: `${messageText}\n\n⏳ Queued — waiting for network` }
          : m
      ));
      setSending(false);
      setLoadingResponses([]);
      return;
    }

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(ERROR_MESSAGES.messageSendFailed);
      }

      const data: ChatResponse = await response.json();

      // Replace temp message with actual messages
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        
        const newMessages: Message[] = [];
        
        // Add user message if it exists
        if (data.user_message) {
          newMessages.push({ ...data.user_message, sender_type: 'user' });
        }
        
        // Safely map responses with fallback to empty array
        const responseMessages = (data.responses || []).map((r: BoardResponse) => ({
          id: `response-${r.member?.slug || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          sender_type: 'board_member' as const,
          member_slug: r.member?.slug,
          content: r.content || '[No response]',
          created_at: new Date().toISOString(),
          ai_provider: r.member?.ai_provider,
        }));
        
        newMessages.push(...responseMessages);
        
        return [...filtered, ...newMessages];
      });

    } catch (err) {
      console.error('Send message error:', err);

      // Sprint 9: If send fails, offer to queue
      if (!checkOnline()) {
        intelligence.queueOffline(activeMeeting.id, messageText, payload);
        toast.info('Network dropped — message queued for retry');
      } else {
        toast.error(ERROR_MESSAGES.messageSendFailed);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
      }
    } finally {
      setSending(false);
      setLoadingResponses([]);
    }
  }, [activeMeeting, sending, members, intelligence]);

  // ==========================================================================
  // Conclude the active meeting
  // ==========================================================================
  const concludeMeeting = useCallback(async (summary?: string): Promise<void> => {
    if (!activeMeeting) return;

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.meetings, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: activeMeeting.id,
          status: 'concluded',
          summary,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to conclude meeting');
      }

      const updatedMeeting = await response.json();
      setActiveMeeting(updatedMeeting);
      toast.success(SUCCESS_MESSAGES.meetingConcluded);
    } catch (err) {
      console.error('Conclude meeting error:', err);
      toast.error('Failed to conclude meeting');
    }
  }, [activeMeeting]);

  // ==========================================================================
  // Clear active meeting
  // ==========================================================================
  const clearActiveMeeting = useCallback(() => {
    setActiveMeeting(null);
    setMessages([]);
    setLoadingResponses([]);
    intelligence.clearContext();
  }, [intelligence]);

  // ==========================================================================
  // Sprint 9: Routing preview for UI
  // ==========================================================================
  const routingPreview = useCallback((message: string) => {
    const preview = intelligence.routingPreview(message);
    return {
      primarySlug: preview.primarySlug,
      primaryName: preview.primaryName,
      topic: preview.topic,
      confidence: preview.confidence,
    };
  }, [intelligence]);

  // ==========================================================================
  // Sprint 9: Energy detection for UI
  // ==========================================================================
  const detectEnergy = useCallback((message: string) => {
    const result = intelligence.detectEnergy(message);
    return {
      energy: result.energy,
      confidence: result.confidence,
    };
  }, [intelligence]);

  return {
    // State
    activeMeeting,
    messages,
    sending,
    loadingResponses,
    
    // Actions
    createMeeting,
    loadMeeting,
    sendMessage,
    concludeMeeting,
    clearActiveMeeting,

    // Sprint 9: Intelligence
    isOnline: intelligence.online,
    pendingOfflineCount: intelligence.pendingOffline,
    contextReady: intelligence.contextReady,
    routingPreview,
    detectEnergy,
  };
}

export default useMeeting;
