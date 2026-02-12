// FILE: src/hooks/useStt.ts
// Oracle Phase 1 — Speech-to-Text hook
// FIXED: startListening() now returns Promise<string> (was void — broke JarvisVoiceInterface)
// Mobile-first: Uses Web Speech API with language-aware recognition

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Browser compatibility
interface IWindow extends Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

const getSpeechRecognition = (): (typeof SpeechRecognition) | null => {
  if (typeof window === 'undefined') return null;
  return (window as unknown as IWindow).SpeechRecognition
    || (window as unknown as IWindow).webkitSpeechRecognition
    || null;
};

export const useStt = () => {
  const { i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = !!getSpeechRecognition();

  /**
   * Start listening and return a Promise that resolves with the transcript.
   * This is the critical fix — callers can now `await startListening()` and
   * get the result directly instead of watching state.
   *
   * Returns empty string if cancelled, errored, or no speech detected.
   */
  const startListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const SpeechRecognitionClass = getSpeechRecognition();

      if (!SpeechRecognitionClass) {
        toast.error('Speech recognition not supported in this browser.');
        resolve('');
        return;
      }

      // If already listening, stop first
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* ignore */ }
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = i18n.language || 'en-US';
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[0]?.[0]?.transcript || '';
        setTranscript(result);
        setIsListening(false);
        recognitionRef.current = null;
        resolve(result);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Don't toast on intentional abort or no-speech
        if (event.error === 'aborted') {
          // User cancelled — silent resolve
        } else if (event.error === 'no-speech') {
          toast.info('No speech detected. Try again.');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast.error('Microphone permission denied.');
        } else if (event.error === 'network') {
          toast.error('Network error — check your connection.');
        } else {
          toast.error(`Speech error: ${event.error}`);
        }

        setIsListening(false);
        recognitionRef.current = null;
        resolve('');
      };

      recognition.onend = () => {
        // Safety net — if onresult didn't fire, resolve empty
        setIsListening(false);
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
          resolve('');
        }
      };

      try {
        recognition.start();
      } catch (err) {
        console.error('Could not start speech recognition:', err);
        setIsListening(false);
        recognitionRef.current = null;
        resolve('');
      }
    });
  }, [i18n.language]);

  /**
   * Stop listening immediately. Triggers onend → resolves the Promise with ''.
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
  };
};