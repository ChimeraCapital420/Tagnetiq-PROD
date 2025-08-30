// FILE: src/hooks/useTts.ts
// STATUS: Validated & Ready for Integration.

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const useTts = () => {
  // --- SURGICAL ADDITION: Oracle Language Awareness ---
  // The hook is connected to the application's internationalization (i18n) system.
  // This allows the Oracle's voice to be aware of the user's selected language.
  const { i18n } = useTranslation();
  // --- END SURGICAL ADDITION ---

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  const speak = useCallback((text: string, voiceURI?: string | null) => {
    if (!window.speechSynthesis) {
      console.warn('Speech Synthesis not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // --- SURGICAL ADDITION: Dynamic Language & Voice Selection ---
    // 1. The utterance's language is explicitly set from the app's current language setting.
    //    This ensures the browser's TTS engine uses the correct pronunciation rules.
    utterance.lang = i18n.language;

    // 2. The voice selection logic is enhanced. It now intelligently prioritizes:
    //    a. The user's explicitly saved preferred voice (`voiceURI`).
    //    b. The hook's currently active voice (`preferredVoice`).
    //    c. The *first available voice* on the user's system that matches their selected language.
    //    d. A fallback to the very first voice if no match is found.
    const voiceToUse = voices.find(v => v.voiceURI === voiceURI) || preferredVoice || voices.find(v => v.lang.startsWith(i18n.language)) || voices[0];
    // --- END SURGICAL ADDITION ---
    
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    // The i18n.language dependency ensures this `speak` function rebuilds if the user changes language.
  }, [voices, preferredVoice, i18n.language]);

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
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
