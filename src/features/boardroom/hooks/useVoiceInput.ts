// FILE: src/features/boardroom/hooks/useVoiceInput.ts
// Voice input hook using Web Speech API
// Supports continuous listening, interim results, and multiple callback modes

import { useState, useRef, useCallback, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface UseVoiceInputOptions {
  /** Keep listening after each result */
  continuous?: boolean;
  /** Provide real-time partial results */
  interimResults?: boolean;
  /** Language for speech recognition */
  language?: string;
  /** Called with accumulated transcript as user speaks */
  onTranscript?: (text: string) => void;
  /** Called when a final (non-interim) result is received */
  onFinalTranscript?: (text: string) => void;
  /** Called on any error */
  onError?: (error: string) => void;
  /** Called when listening state changes */
  onListeningChange?: (isListening: boolean) => void;
}

export interface UseVoiceInputReturn {
  /** Whether the browser supports speech recognition */
  isSupported: boolean;
  /** Whether currently listening for speech */
  isListening: boolean;
  /** Whether processing (brief state between speaking and result) */
  isProcessing: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Accumulated final transcript */
  transcript: string;
  /** Current interim (partial) transcript */
  interimTranscript: string;
  /** Start listening for speech */
  startListening: () => void;
  /** Stop listening for speech */
  stopListening: () => void;
  /** Toggle listening state */
  toggleListening: () => void;
  /** Clear the transcript */
  clearTranscript: () => void;
  /** Reset everything (clear transcript and errors) */
  reset: () => void;
}

// =============================================================================
// BROWSER COMPATIBILITY
// =============================================================================

const SpeechRecognition =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// =============================================================================
// HOOK
// =============================================================================

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    continuous = false,
    interimResults = true,
    language = 'en-US',
    onTranscript,
    onFinalTranscript,
    onError,
    onListeningChange,
  } = options;

  // State
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Refs
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const isSupported = !!SpeechRecognition;

  // Keep transcript ref in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Initialize recognition instance
  useEffect(() => {
    if (!isSupported) return;

    const recognition = new SpeechRecognition();
    
    // Configure
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    // Event handlers
    recognition.onstart = () => {
      setIsListening(true);
      setIsProcessing(false);
      setError(null);
      onListeningChange?.(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      setIsProcessing(false);
      setInterimTranscript('');
      onListeningChange?.(false);
    };

    recognition.onerror = (event: any) => {
      setIsProcessing(false);
      
      let errorMessage: string;
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please connect one.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please enable permissions.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          // User aborted, not really an error
          errorMessage = '';
          break;
        case 'language-not-supported':
          errorMessage = 'Language not supported.';
          break;
        case 'service-not-allowed':
          errorMessage = 'Speech service not allowed.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      if (errorMessage) {
        setError(errorMessage);
        onError?.(errorMessage);
        console.warn('Speech recognition error:', event.error);
      }
      
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      // Update interim transcript
      setInterimTranscript(interimText);

      // Update final transcript
      if (finalText) {
        setTranscript((prev) => {
          const newTranscript = prev ? `${prev} ${finalText}`.trim() : finalText.trim();
          onTranscript?.(newTranscript);
          onFinalTranscript?.(finalText.trim());
          return newTranscript;
        });
      } else if (interimText) {
        // For interim results, call onTranscript with combined text
        const combinedText = transcriptRef.current 
          ? `${transcriptRef.current} ${interimText}`.trim() 
          : interimText.trim();
        onTranscript?.(combinedText);
      }
    };

    recognition.onspeechstart = () => {
      setIsProcessing(false);
    };

    recognition.onspeechend = () => {
      if (!continuous) {
        setIsProcessing(true);
      }
    };

    recognition.onnomatch = () => {
      setError('Could not understand speech. Please try again.');
    };

    recognitionRef.current = recognition;

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [continuous, interimResults, language, isSupported]);

  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      return;
    }

    if (!recognitionRef.current) return;

    try {
      setError(null);
      setIsProcessing(true);
      recognitionRef.current.start();
    } catch (err: any) {
      // Handle "already started" error
      if (err.name === 'InvalidStateError') {
        console.warn('Recognition already started');
      } else {
        console.error('Failed to start recognition:', err);
        setError('Failed to start voice recognition');
        setIsProcessing(false);
      }
    }
  }, [isSupported]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignore errors when stopping
      }
    }
    setIsListening(false);
    setIsProcessing(false);
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    transcriptRef.current = '';
  }, []);

  // Full reset
  const reset = useCallback(() => {
    stopListening();
    clearTranscript();
    setError(null);
  }, [stopListening, clearTranscript]);

  return {
    isSupported,
    isListening,
    isProcessing,
    error,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    reset,
  };
}

export default useVoiceInput;