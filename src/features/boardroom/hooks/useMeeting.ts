// FILE: src/features/boardroom/hooks/useMeeting.ts
// Hook for meeting management and chat functionality

import { useState, useCallback } from 'react';
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

interface UseMeetingOptions {
  members: BoardMember[];
  onMeetingCreated?: (meeting: Meeting) => void;
}

export function useMeeting(options: UseMeetingOptions): UseMeetingReturn {
  const { members, onMeetingCreated } = options;

  // State
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState<string[]>([]);

  // Get auth session helper
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error(ERROR_MESSAGES.notAuthenticated);
    }
    return session;
  };

  // Create a new meeting
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

  // Load an existing meeting
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

  // Send a message in the active meeting
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim() || !activeMeeting || sending) return;

    setSending(true);
    const messageText = content.trim();

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

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.chat, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_id: activeMeeting.id,
          message: messageText,
        }),
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
      toast.error(ERROR_MESSAGES.messageSendFailed);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
      setLoadingResponses([]);
    }
  }, [activeMeeting, sending, members]);

  // Conclude the active meeting
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

  // Clear active meeting
  const clearActiveMeeting = useCallback(() => {
    setActiveMeeting(null);
    setMessages([]);
    setLoadingResponses([]);
  }, []);

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
  };
}

export default useMeeting;