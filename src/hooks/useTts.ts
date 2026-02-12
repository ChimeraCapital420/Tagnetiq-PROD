// FILE: src/hooks/useTts.ts
// Oracle TTS — Premium ElevenLabs voice with browser fallback
// FIXED: Gets session from supabase directly (not AuthContext)
// FIXED: Dispatches global 'oracle-speak-start' / 'oracle-speak-end' events
//        so OracleVisualizer (separate component) knows when speech is active

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

// =============================================================================
// GLOBAL SPEAKING STATE
// Each useTts() instance has its own isSpeaking, but other components
// (like OracleVisualizer) need to know when ANY instance is speaking.
// We use CustomEvents on window for this.
// =============================================================================

function emitSpeakingState(speaking: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('oracle-speaking', { detail: { speaking } }));
}

/**
 * Hook for components that just need to know if Oracle is speaking.
 * Lighter than importing full useTts — no speech capabilities, just state.
 */
export function useOracleSpeakingState() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsSpeaking(detail.speaking);
    };

    window.addEventListener('oracle-speaking', handler);
    return () => window.removeEventListener('oracle-speaking', handler);
  }, []);

  return isSpeaking;
}

// =============================================================================
// MAIN TTS HOOK
// =============================================================================

export const useTts = () => {
  const { i18n } = useTranslation();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to set speaking state locally AND globally
  const setSpeaking = useCallback((value: boolean) => {
    setIsSpeaking(value);
    emitSpeakingState(value);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const handleVoicesChanged = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    handleVoicesChanged();

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  const speak = useCallback(async (
    text: string,
    voiceURI?: string | null,
    premiumVoiceId?: string | null
  ) => {
    // Cancel any ongoing speech first
    cancel();

    if (!text || text.trim().length === 0) return;

    // ── Premium ElevenLabs path ────────────────────────────
    if (premiumVoiceId) {
      setSpeaking(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.warn('No session for premium voice — falling back to browser TTS');
          speakWithBrowser(text, voiceURI);
          return;
        }

        console.log(`🔊 ElevenLabs: "${text.substring(0, 40)}..." → ${premiumVoiceId}`);

        const response = await fetch('/api/oracle/generate-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, voiceId: premiumVoiceId }),
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audioRef.current = audio;

        audio.addEventListener('ended', () => {
          setSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });

        audio.addEventListener('error', () => {
          console.error('Error playing ElevenLabs audio');
          setSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });

        await audio.play();

      } catch (error) {
        console.error('Premium voice error, falling back to browser TTS:', error);
        setSpeaking(false);
        speakWithBrowser(text, voiceURI);
      }

      return;
    }

    // ── Browser TTS fallback ──────────────────────────────
    speakWithBrowser(text, voiceURI);

  }, [voices, preferredVoice, i18n.language, setSpeaking]);

  /**
   * Browser SpeechSynthesis — the free robotic fallback.
   */
  const speakWithBrowser = useCallback((text: string, voiceURI?: string | null) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('Speech Synthesis not supported');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = i18n.language;

    const voiceToUse = voices.find(v => v.voiceURI === voiceURI)
      || preferredVoice
      || voices.find(v => v.lang.startsWith(i18n.language))
      || voices[0];

    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voices, preferredVoice, i18n.language, setSpeaking]);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, [setSpeaking]);

  const setVoiceByURI = useCallback((uri: string) => {
    const foundVoice = voices.find(v => v.voiceURI === uri);
    if (foundVoice) {
      setPreferredVoice(foundVoice);
    }
  }, [voices]);

  return {
    speak,
    cancel,
    isSpeaking,
    voices,
    setVoiceByURI,
    preferredVoice,
  };
};