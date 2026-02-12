// FILE: src/components/oracle/OracleVoiceButton.tsx
// Oracle Phase 2 — Voice interface with conversation support
// FIXED: Now shows transcript bubble during chat responses (not just commands)
// FIXED: Processing state stays visible while waiting for chat API response

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { useStt } from '@/hooks/useStt';
import { useTts } from '@/hooks/useTts';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routeCommand, OracleContext } from '@/lib/oracle/command-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type OracleState = 'idle' | 'listening' | 'processing' | 'speaking';

export default function OracleVoiceButton() {
  const [state, setState] = useState<OracleState>('idle');
  const [lastTranscript, setLastTranscript] = useState('');

  const { startListening, stopListening, isListening, isSupported } = useStt();
  const { speak, isSpeaking, cancel: cancelSpeech } = useTts();
  const { profile } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  // Sync speaking state
  useEffect(() => {
    if (isSpeaking && state !== 'speaking') {
      setState('speaking');
    } else if (!isSpeaking && state === 'speaking') {
      setState('idle');
    }
  }, [isSpeaking, state]);

  // Sync listening state (safety net)
  useEffect(() => {
    if (!isListening && state === 'listening') {
      setState('idle');
    }
  }, [isListening, state]);

  // Build Oracle context from AppContext
  const buildContext = useCallback((): OracleContext => ({
    setIsScannerOpen: appContext.setIsScannerOpen,
    startScanWithCategory: appContext.startScanWithCategory,
    setSearchArenaQuery: appContext.setSearchArenaQuery,
    navigate,
    speak,
    voiceURI: profile?.settings?.tts_voice_uri || null,
    premiumVoiceId: profile?.settings?.premium_voice_id || null,
    hasAnalysisResult: !!appContext.lastAnalysisResult,
  }), [appContext, navigate, speak, profile]);

  // ── Main activation flow ──────────────────────────────────
  const handleActivation = useCallback(async () => {
    // If currently listening, cancel
    if (state === 'listening') {
      stopListening();
      setState('idle');
      return;
    }

    // If speaking, cancel speech
    if (state === 'speaking') {
      cancelSpeech();
      setState('idle');
      return;
    }

    // If processing, ignore tap
    if (state === 'processing') return;

    // Check if Oracle is enabled
    if (!profile?.settings?.tts_enabled) {
      toast.info('Enable the Oracle in Settings → Oracle to use voice commands.');
      return;
    }

    // Start listening
    setState('listening');
    const transcript = await startListening();

    if (!transcript) {
      setState('idle');
      return;
    }

    // Got a transcript — process it
    setLastTranscript(transcript);
    setState('processing');

    try {
      const ctx = buildContext();
      await routeCommand(transcript, i18n.language, ctx);
      // routeCommand now handles speaking internally (including chat responses)
      // State will transition to 'speaking' via isSpeaking effect
      if (!isSpeaking) {
        // Give a moment for speak() to kick in before going idle
        setTimeout(() => {
          if (!isSpeaking) setState('idle');
        }, 500);
      }
    } catch (error) {
      console.error('Oracle command error:', error);
      toast.error('Oracle encountered an error.');
      setState('idle');
    }
  }, [state, startListening, stopListening, cancelSpeech, profile, buildContext, i18n.language, isSpeaking]);

  // ── Keyboard shortcut ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        handleActivation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleActivation]);

  // Don't render if browser doesn't support speech
  if (!isSupported) return null;

  // ── Render ────────────────────────────────────────────────
  const stateColors = {
    idle: 'bg-primary shadow-lg shadow-primary/30',
    listening: 'bg-red-500 shadow-lg shadow-red-500/50',
    processing: 'bg-amber-500 shadow-lg shadow-amber-500/30',
    speaking: 'bg-cyan-500 shadow-lg shadow-cyan-500/30',
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {/* Transcript bubble */}
        {lastTranscript && (state === 'processing' || state === 'speaking') && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-black/90 backdrop-blur-xl rounded-lg px-3 py-2 max-w-[240px]"
          >
            <p className="text-xs text-white/90 leading-relaxed">"{lastTranscript}"</p>
          </motion.div>
        )}

        {/* Speaking indicator */}
        {state === 'speaking' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 bg-cyan-500/20 backdrop-blur-sm rounded-full px-3 py-1"
          >
            <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span className="text-[10px] text-cyan-300 font-medium">Oracle speaking</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={handleActivation}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'relative w-14 h-14 rounded-full flex items-center justify-center',
          'transition-colors duration-300 touch-manipulation',
          stateColors[state],
        )}
        aria-label={
          state === 'idle' ? 'Activate Oracle voice' :
          state === 'listening' ? 'Stop listening' :
          state === 'processing' ? 'Processing...' :
          'Oracle speaking — tap to stop'
        }
      >
        {/* Pulse rings when listening */}
        {state === 'listening' && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500/60"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500/40"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}

        {/* Icon */}
        <div className="relative z-10">
          {state === 'idle' && <Mic className="w-6 h-6 text-white" />}
          {state === 'listening' && (
            <motion.div
              animate={{ scale: [1, 0.85, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <MicOff className="w-6 h-6 text-white" />
            </motion.div>
          )}
          {state === 'processing' && <Loader2 className="w-6 h-6 text-white animate-spin" />}
          {state === 'speaking' && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Volume2 className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </div>
      </motion.button>
    </div>
  );
}