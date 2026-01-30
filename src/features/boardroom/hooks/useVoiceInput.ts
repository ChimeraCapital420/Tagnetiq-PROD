// FILE: src/features/boardroom/hooks/useVoiceInput.ts
// Voice input hook for speech-to-text in Boardroom

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  continuous?: boolean;
  language?: string;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

// =============================================================================
// SPEECH RECOGNITION SETUP
// =============================================================================

// Browser compatibility
const SpeechRecognition = 
  (window as any).SpeechRecognition || 
  (window as any).webkitSpeechRecognition;

// =============================================================================
// HOOK
// =============================================================================

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    onTranscript,
    onInterimTranscript,
    continuous = false,
    language = 'en-US',
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isSupported = !!SpeechRecognition;

  // Initialize recognition
  useEffect(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      switch (event.error) {
        case 'no-speech':
          setError('No speech detected. Please try again.');
          break;
        case 'audio-capture':
          setError('Microphone not available.');
          toast.error('Microphone access denied');
          break;
        case 'not-allowed':
          setError('Microphone permission denied.');
          toast.error('Please enable microphone access');
          break;
        case 'network':
          setError('Network error occurred.');
          break;
        default:
          setError(`Error: ${event.error}`);
      }
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => {
          const newTranscript = prev ? `${prev} ${finalTranscript}` : finalTranscript;
          onTranscript?.(newTranscript);
          return newTranscript;
        });
        setInterimTranscript('');
      }

      if (currentInterim) {
        setInterimTranscript(currentInterim);
        onInterimTranscript?.(currentInterim);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported, continuous, language, onTranscript, onInterimTranscript]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      toast.error('Speech recognition not supported');
      return;
    }

    if (!recognitionRef.current) return;

    try {
      setError(null);
      recognitionRef.current.start();
    } catch (err) {
      // Already started
      console.warn('Recognition already started');
    }
  }, [isSupported]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
}

export default useVoiceInput;