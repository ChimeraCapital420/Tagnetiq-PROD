// FILE: src/hooks/useTts.ts
// Oracle TTS — Premium ElevenLabs voice with browser fallback
// Enhanced: Energy-aware voice — matches tone to user's emotional state
// FIXED: Gets session from supabase directly (not AuthContext)
// FIXED: Dispatches global 'oracle-speak-start' / 'oracle-speak-end' events

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import type { EnergyLevel } from '@/components/oracle/types';

// =============================================================================
// GLOBAL SPEAKING STATE
// =============================================================================

function emitSpeakingState(speaking: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('oracle-speaking', { detail: { speaking } }));
}

/**
 * Hook for components that just need to know if Oracle is speaking.
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
// ENERGY → VOICE SETTINGS MAP
// =============================================================================

interface VoiceSettings {
  stability: number;         // 0-1: lower = more expressive
  similarity_boost: number;  // 0-1: voice consistency
  style: number;             // 0-1: style exaggeration (Eleven v2 only)
  speed: number;             // 0.7-1.3: speaking speed
}

function getEnergyVoiceSettings(energy?: EnergyLevel): VoiceSettings {
  switch (energy) {
    case 'excited':
      return { stability: 0.35, similarity_boost: 0.7, style: 0.6, speed: 1.1 };
    case 'frustrated':
      return { stability: 0.7, similarity_boost: 0.8, style: 0.2, speed: 0.9 };
    case 'focused':
      return { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 1.0 };
    case 'curious':
      return { stability: 0.45, similarity_boost: 0.75, style: 0.4, speed: 1.0 };
    case 'casual':
      return { stability: 0.5, similarity_boost: 0.7, style: 0.5, speed: 1.0 };
    case 'neutral':
    default:
      return { stability: 0.5, similarity_boost: 0.75, style: 0.3, speed: 1.0 };
  }
}

// =============================================================================
// BROWSER TTS ENERGY MAPPING
// =============================================================================

function applyEnergyToUtterance(
  utterance: SpeechSynthesisUtterance,
  energy?: EnergyLevel,
): void {
  switch (energy) {
    case 'excited':
      utterance.rate = 1.1;
      utterance.pitch = 1.15;
      break;
    case 'frustrated':
      utterance.rate = 0.9;
      utterance.pitch = 0.95;
      break;
    case 'focused':
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      break;
    case 'curious':
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      break;
    case 'casual':
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      break;
    default:
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
  }
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
    premiumVoiceId?: string | null,
    energy?: EnergyLevel,
  ) => {
    cancel();

    if (!text || text.trim().length === 0) return;

    // ── Premium ElevenLabs path ────────────────────────────
    if (premiumVoiceId) {
      setSpeaking(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.warn('No session for premium voice — falling back to browser TTS');
          speakWithBrowser(text, voiceURI, energy);
          return;
        }

        // Get energy-aware voice settings
        const voiceSettings = getEnergyVoiceSettings(energy);

        console.log(`🔊 ElevenLabs: "${text.substring(0, 40)}..." → ${premiumVoiceId} [${energy || 'neutral'}]`);

        const response = await fetch('/api/oracle/generate-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text,
            voiceId: premiumVoiceId,
            voiceSettings, // Pass energy-aware settings to API
          }),
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
        speakWithBrowser(text, voiceURI, energy);
      }

      return;
    }

    // ── Browser TTS fallback ──────────────────────────────
    speakWithBrowser(text, voiceURI, energy);

  }, [voices, preferredVoice, i18n.language, setSpeaking]);

  /**
   * Browser SpeechSynthesis — the free robotic fallback.
   * Now energy-aware: adjusts rate and pitch based on conversation energy.
   */
  const speakWithBrowser = useCallback((
    text: string,
    voiceURI?: string | null,
    energy?: EnergyLevel,
  ) => {
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

    // Apply energy-based voice modulation
    applyEnergyToUtterance(utterance, energy);

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
