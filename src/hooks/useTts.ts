// FILE: src/hooks/useTts.ts
// Oracle TTS — Premium ElevenLabs voice with browser fallback
// FIXED: Was using `session` from useAuth() which doesn't exist on AuthContext
//        Now gets session directly from supabase.auth.getSession()

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

export const useTts = () => {
  const { i18n } = useTranslation();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setIsSpeaking(true);

      try {
        // Get session directly from supabase — not from AuthContext
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
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });

        audio.addEventListener('error', () => {
          console.error('Error playing ElevenLabs audio');
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });

        await audio.play();

      } catch (error) {
        console.error('Premium voice error, falling back to browser TTS:', error);
        setIsSpeaking(false);
        // Fallback to browser TTS — don't pass premiumVoiceId to avoid loop
        speakWithBrowser(text, voiceURI);
      }

      return;
    }

    // ── Browser TTS fallback ──────────────────────────────
    speakWithBrowser(text, voiceURI);

  }, [voices, preferredVoice, i18n.language]);

  /**
   * Browser SpeechSynthesis — the free robotic fallback.
   * Only used when no premiumVoiceId is set or when ElevenLabs fails.
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

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voices, preferredVoice, i18n.language]);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

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