// FILE: src/components/oracle/hooks/useVision.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Hooks — Vision & Hunt (Phase 4 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from useOracleChat.ts — camera-based interactions:
//   sendImage() — send photo for vision analysis (6 modes)
//   sendHunt()  — send photo for hunt triage (BUY/SKIP)
//
// ZERO LOGIC CHANGES — pure code movement.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatMessage, VisionMode, CameraCapture } from '../types';
import type { SharedChatState } from './chat-hook-types';
import { getToken } from './chat-hook-types';

// =============================================================================
// HOOK
// =============================================================================

export function useVision(shared: SharedChatState) {
  const {
    isLoading, setIsLoading, setMessages, messageCountRef,
    conversationId, setConversationId,
  } = shared;

  // ── Send image for vision analysis ────────────────────
  const sendImage = useCallback(async (
    capture: CameraCapture,
    mode: VisionMode,
    question?: string,
  ): Promise<string | null> => {
    if (isLoading) return null;

    const userMessage: ChatMessage = {
      role: 'user',
      content: question || `[${mode} mode]`,
      timestamp: Date.now(),
      imagePreview: capture.base64,
      visionMode: mode,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    messageCountRef.current++;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/see', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: capture.base64,
          mimeType: capture.mimeType,
          mode,
          question,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Vision request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || data.description || 'I see it.',
        timestamp: Date.now(),
        visionData: data.visionData || data,
        attachments: data.visionData ? [{ type: 'vision', data: data.visionData }] : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);

      return data.response || data.description || null;
    } catch (err) {
      console.error('Oracle vision error:', err);
      toast.error('Oracle couldn\'t see that. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationId, setMessages, setIsLoading, messageCountRef, setConversationId]);

  // ── Send image for hunt triage (BUY/SKIP) ─────────────
  const sendHunt = useCallback(async (
    capture: CameraCapture,
    askingPrice?: number,
  ): Promise<string | null> => {
    if (isLoading) return null;

    const userMessage: ChatMessage = {
      role: 'user',
      content: askingPrice ? `Hunt mode — asking $${askingPrice}` : 'Hunt mode — what do you think?',
      timestamp: Date.now(),
      imagePreview: capture.base64,
      visionMode: 'hunt_scan',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    messageCountRef.current++;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: capture.base64,
          mimeType: capture.mimeType,
          askingPrice,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Hunt request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || `${data.verdict}: ${data.reasoning}`,
        timestamp: Date.now(),
        huntData: data,
        attachments: [{ type: 'hunt', data: data }],
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);

      return data.response || data.reasoning || null;
    } catch (err) {
      console.error('Oracle hunt error:', err);
      toast.error('Hunt triage failed. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationId, setMessages, setIsLoading, messageCountRef, setConversationId]);

  return { sendImage, sendHunt };
}