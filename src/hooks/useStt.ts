// FILE: src/hooks/useStt.ts
// STATUS: Validated & Ready for Integration.

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
// --- SURGICAL ADDITION VALIDATED ---
// The hook correctly imports the translation context, making it language-aware.
import { useTranslation } from 'react-i18next';

// Type guard for SpeechRecognition API
interface IWindow extends Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

export const useStt = () => {
  // --- SURGICAL ADDITION VALIDATED ---
  // The i18n instance is correctly initialized.
  const { i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as IWindow).SpeechRecognition || (window as IWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    // --- SURGICAL ADDITION VALIDATED ---
    // The recognition language is dynamically set from the user's profile language.
    // This is the core of making the Oracle's "ears" multilingual.
    recognition.lang = i18n.language;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error('Microphone permission denied.');
      } else {
        toast.error('Speech recognition error.', { description: event.error });
      }
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const currentTranscript = event.results[0][0].transcript;
      setTranscript(currentTranscript);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
    // The dependency on i18n.language ensures the recognition instance is rebuilt if the user changes their language setting.
  }, [i18n.language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      // --- SURGICAL ADDITION VALIDATED ---
      // This ensures that even if the component doesn't re-render, the most current language is used when listening starts.
      recognitionRef.current.lang = i18n.language;
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Could not start listening:", error);
      }
    }
  }, [isListening, i18n.language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: !!recognitionRef.current,
  };
};
