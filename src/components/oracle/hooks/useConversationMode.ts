// FILE: src/components/oracle/hooks/useConversationMode.ts
// Conversation mode — tap once, talk naturally
// Handles: auto-listen after Oracle speaks, silence timeout, state machine
//
// v9.1: Fixed timeout — resets after Oracle finishes speaking, not just on user input
//       60s of ACTUAL silence before auto-disable (doesn't count thinking/speaking time)

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStt } from '@/hooks/useStt';
import { useOracleSpeakingState } from '@/hooks/useTts';
import { toast } from 'sonner';

const SILENCE_TIMEOUT_MS = 60_000; // 60s of actual silence → auto-disable
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

  // ── Pause timeout while Oracle is thinking or speaking ──
  // The silence timer should only count ACTUAL silence —
  // not time spent waiting for API or playing TTS audio.
  useEffect(() => {
    if (!conversationMode) return;

    if (isLoading || globalSpeaking) {
      // Oracle is busy — pause the silence timer
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [isLoading, globalSpeaking, conversationMode]);

  // ── Auto-listen after Oracle finishes speaking ────────
  // This is the KEY fix: when Oracle stops speaking,
  // we reset the silence timer AND start listening again.
  useEffect(() => {
    if (!conversationMode || isLoading || globalSpeaking) return;
    if (!waitingToListenRef.current) return;

    waitingToListenRef.current = false;

    // Oracle just finished speaking — reset the silence timer
    // The 60s countdown starts NOW, not from when the user first spoke
    resetTimeout();

    const timer = setTimeout(() => {
      if (conversationMode && !isListening) {
        listen();
      }
    }, POST_SPEECH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [globalSpeaking, isLoading, conversationMode]);

  // ── Initialize timeout when conversation mode starts ──
  useEffect(() => {
    if (conversationMode) {
      resetTimeout();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [conversationMode]);

  // ── Reset the silence timer ───────────────────────────
  // Called when:
  // 1. Conversation mode first enabled
  // 2. User speaks (in listen())
  // 3. Oracle finishes speaking (in auto-listen effect)
  // 4. User taps send or quick chip
  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setConversationMode(false);
      stopListening();
      toast('Conversation mode ended — tap mic to resume', { duration: 3000 });
    }, SILENCE_TIMEOUT_MS);
  }, [stopListening]);

  // ── Core listen function ──────────────────────────────
  const listen = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    // User is about to speak — reset silence timer
    if (conversationMode) resetTimeout();

    const transcript = await startListening();

    if (transcript) {
      // Got speech — reset timer (will pause during loading/speaking)
      if (conversationMode) resetTimeout();
      onTranscript(transcript);
      // Signal we want to auto-listen after Oracle responds
      waitingToListenRef.current = true;
    } else if (conversationMode) {
      // No transcript but conversation mode on — retry after short delay
      setTimeout(() => {
        if (conversationMode && !isListening && !isLoading) {
          listen();
        }
      }, RETRY_DELAY_MS);
    }
  }, [isListening, startListening, stopListening, conversationMode, isLoading, onTranscript, resetTimeout]);

  // ── Signal that we want to auto-listen after speech ───
  // Called externally when Oracle starts generating a response
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
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