// FILE: src/components/oracle/hooks/useConversationMode.ts
// Conversation mode — tap once, talk naturally
// Handles: auto-listen after Oracle speaks, silence timeout, state machine

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStt } from '@/hooks/useStt';
import { useOracleSpeakingState } from '@/hooks/useTts';
import { toast } from 'sonner';

const SILENCE_TIMEOUT_MS = 60_000; // 60s silence → auto-disable
const POST_SPEECH_DELAY_MS = 600;  // Wait for audio output to stop before mic opens
const RETRY_DELAY_MS = 1_000;      // Delay before retrying listen on empty transcript

interface UseConversationModeOptions {
  isLoading: boolean;
  onTranscript: (text: string) => void;
}

export function useConversationMode({ isLoading, onTranscript }: UseConversationModeOptions) {
  const [conversationMode, setConversationMode] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const waitingToListenRef = useRef(false);

  const { startListening, stopListening, isListening, isSupported: micSupported } = useStt();
  const globalSpeaking = useOracleSpeakingState();

  // ── Auto-listen after Oracle finishes speaking ────────
  useEffect(() => {
    if (!conversationMode || isLoading || globalSpeaking) return;
    if (!waitingToListenRef.current) return;

    waitingToListenRef.current = false;

    const timer = setTimeout(() => {
      if (conversationMode && !isListening) {
        listen();
      }
    }, POST_SPEECH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [globalSpeaking, isLoading, conversationMode]);

  // ── Silence timeout ───────────────────────────────────
  useEffect(() => {
    if (conversationMode) {
      resetTimeout();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [conversationMode]);

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setConversationMode(false);
      toast('Conversation mode ended — tap mic to resume', { duration: 3000 });
    }, SILENCE_TIMEOUT_MS);
  };

  // ── Core listen function ──────────────────────────────
  const listen = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (conversationMode) resetTimeout();

    const transcript = await startListening();

    if (transcript) {
      onTranscript(transcript);
    } else if (conversationMode) {
      // No transcript but conversation mode on — retry after short delay
      setTimeout(() => {
        if (conversationMode && !isListening && !isLoading) {
          listen();
        }
      }, RETRY_DELAY_MS);
    }
  }, [isListening, startListening, stopListening, conversationMode, isLoading, onTranscript]);

  // ── Signal that we want to auto-listen after speech ───
  const queueAutoListen = useCallback(() => {
    if (conversationMode) {
      waitingToListenRef.current = true;
    }
  }, [conversationMode]);

  // ── Toggle ────────────────────────────────────────────
  const toggleConversationMode = useCallback(() => {
    if (conversationMode) {
      setConversationMode(false);
      stopListening();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      toast('Conversation mode off', { duration: 2000 });
    } else {
      setConversationMode(true);
      toast('Conversation mode — just talk naturally', { duration: 3000 });
      // Start listening after a beat
      setTimeout(() => listen(), 300);
    }
  }, [conversationMode, stopListening, listen]);

  return {
    conversationMode,
    setConversationMode,
    isListening,
    micSupported,
    globalSpeaking,
    listen,
    stopListening,
    queueAutoListen,
    toggleConversationMode,
    resetTimeout,
  };
}