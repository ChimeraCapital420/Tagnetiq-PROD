// FILE: src/hooks/useTts.ts
// STATUS: Surgically updated to support premium, server-generated AI voices.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
// --- ORACLE SURGICAL ADDITION START ---
// We need the AuthContext to get the user's token for secure API calls.
import { useAuth } from '@/contexts/AuthContext';
// --- ORACLE SURGICAL ADDITION END ---

export const useTts = () => {
  const { i18n } = useTranslation();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // --- ORACLE SURGICAL ADDITION START ---
  const { session } = useAuth();
  // State to manage the Audio object for premium voices, allowing us to pause/cancel it.
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  // --- ORACLE SURGICAL ADDITION END ---

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

  // --- ORACLE SURGICAL MODIFICATION START ---
  // The `speak` function is upgraded to accept an optional `premiumVoiceId`.
  const speak = useCallback(async (text: string, voiceURI?: string | null, premiumVoiceId?: string | null) => {
    if (isSpeaking) {
      // Prevent new speech from starting while another is in progress.
      return;
    }

    // Always cancel previous speech, whether it's native or premium.
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (audio) audio.pause();

    // **PATH 1: Premium AI Voice Generation**
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
          throw new Error('Failed to generate premium voice audio.');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const newAudio = new Audio(audioUrl);
        
        setAudio(newAudio); // Store the audio object so it can be cancelled.
        
        newAudio.play();
        newAudio.onended = () => {
            setIsSpeaking(false);
            setAudio(null);
        };
        newAudio.onerror = () => {
            console.error("Error playing premium voice audio.");
            setIsSpeaking(false);
            setAudio(null);
        };
      } catch (error) {
        console.error(error);
        setIsSpeaking(false);
        // Fallback to native TTS on error
        speak(text, voiceURI, null);
      }
    // **PATH 2: Standard Browser Voice (Fallback)**
    } else {
        if (!window.speechSynthesis) {
            console.warn('Speech Synthesis not supported in this browser.');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = i18n.language;
        const voiceToUse = voices.find(v => v.voiceURI === voiceURI) || preferredVoice || voices.find(v => v.lang.startsWith(i18n.language)) || voices[0];
        
        if (voiceToUse) {
            utterance.voice = voiceToUse;
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    }
  }, [voices, preferredVoice, i18n.language, session, audio, isSpeaking]);
  // --- ORACLE SURGICAL MODIFICATION END ---

  const cancel = useCallback(() => {
    // --- ORACLE SURGICAL MODIFICATION START ---
    // The cancel function is now upgraded to stop both types of audio.
    if (audio) {
        audio.pause();
        setAudio(null);
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    // --- ORACLE SURGICAL MODIFICATION END ---
  }, [audio]);

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

