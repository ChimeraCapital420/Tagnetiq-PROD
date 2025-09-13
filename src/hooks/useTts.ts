// FILE: src/hooks/useTts.ts
// Enhanced TTS hook with premium voice support

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export const useTts = () => {
  const { i18n } = useTranslation();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { session } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
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
    // Cancel any ongoing speech
    cancel();

    // Use premium voice if specified
    if (premiumVoiceId && session) {
      setIsSpeaking(true);
      try {
        const response = await fetch('/api/oracle/generate-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ text, voiceId: premiumVoiceId }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate premium voice audio');
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
          console.error('Error playing premium voice audio');
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });
        
        await audio.play();
      } catch (error) {
        console.error('Premium voice error:', error);
        setIsSpeaking(false);
        // Fallback to browser TTS
        speak(text, voiceURI);
      }
    } else {
      // Use browser's speech synthesis
      if (!window.speechSynthesis) {
        console.warn('Speech Synthesis not supported');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = i18n.language;
      
      const voiceToUse = voices.find(v => v.voiceURI === voiceURI) || 
                        preferredVoice || 
                        voices.find(v => v.lang.startsWith(i18n.language)) || 
                        voices[0];
      
      if (voiceToUse) {
        utterance.voice = voiceToUse;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  }, [voices, preferredVoice, i18n.language, session]);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (window.speechSynthesis) {
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