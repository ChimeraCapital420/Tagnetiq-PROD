// FILE: src/hooks/useTts.ts

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export const useTts = () => {
  const { i18n } = useTranslation();
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
    utterance.lang = i18n.language; // Set language from i18n

    const voiceToUse = voices.find(v => v.voiceURI === voiceURI) || preferredVoice || voices.find(v => v.lang.startsWith(i18n.language)) || voices[0];
    
    if (voiceToUse) {
      utterance.voice = voiceToUse;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
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