// FILE: src/features/boardroom/hooks/useVoiceInput.ts
// Voice input hook for speech-to-text board communication
// Supports mobile-first voice interaction with the board

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

export interface VoiceInputState {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  permissionGranted: boolean | null;
}

export interface UseVoiceInputOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  onTranscript?: (transcript: string) => void;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  useWhisperFallback?: boolean; // Use OpenAI Whisper for better accuracy
}

export interface UseVoiceInputReturn extends VoiceInputState {
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  clearTranscript: () => void;
  requestPermission: () => Promise<boolean>;
}

// ============================================================================
// WEB SPEECH API DETECTION
// ============================================================================

const getSpeechRecognition = (): typeof SpeechRecognition | null => {
  if (typeof window === 'undefined') return null;
  
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    continuous = false,
    interimResults = true,
    language = 'en-US',
    onTranscript,
    onFinalTranscript,
    onError,
    useWhisperFallback = true,
  } = options;

  // State
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    isSupported: false,
    permissionGranted: null,
  });

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Check support on mount
  useEffect(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    setState(prev => ({
      ...prev,
      isSupported: !!SpeechRecognitionClass || useWhisperFallback,
    }));
  }, [useWhisperFallback]);

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Clean up
      setState(prev => ({ ...prev, permissionGranted: true }));
      return true;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setState(prev => ({ 
        ...prev, 
        permissionGranted: false,
        error: 'Microphone permission denied',
      }));
      return false;
    }
  }, []);

  // ========================================
  // WEB SPEECH API IMPLEMENTATION
  // ========================================

  const initWebSpeechRecognition = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
    };

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognition.onerror = (event) => {
      const errorMessage = getErrorMessage(event.error);
      setState(prev => ({ ...prev, error: errorMessage, isListening: false }));
      onError?.(errorMessage);
    };

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setState(prev => {
          const newTranscript = prev.transcript + finalText;
          onTranscript?.(newTranscript);
          onFinalTranscript?.(finalText);
          return {
            ...prev,
            transcript: newTranscript,
            interimTranscript: '',
          };
        });
      }

      if (interimText) {
        setState(prev => ({ ...prev, interimTranscript: interimText }));
      }
    };

    return recognition;
  }, [continuous, interimResults, language, onTranscript, onFinalTranscript, onError]);

  // ========================================
  // WHISPER API FALLBACK
  // ========================================

  const startWhisperRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setState(prev => ({ ...prev, isProcessing: true }));
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeWithWhisper(audioBlob);
        
        // Clean up stream
        stream.getTracks().forEach(track => track.stop());
        setState(prev => ({ ...prev, isProcessing: false }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setState(prev => ({ ...prev, isListening: true, error: null }));

    } catch (err) {
      console.error('Failed to start recording:', err);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to access microphone',
        isListening: false,
      }));
    }
  }, []);

  const stopWhisperRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setState(prev => ({ ...prev, isListening: false }));
    }
  }, []);

  const transcribeWithWhisper = useCallback(async (audioBlob: Blob) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/boardroom/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcript = data.text || '';

      if (transcript) {
        setState(prev => {
          const newTranscript = prev.transcript + (prev.transcript ? ' ' : '') + transcript;
          onTranscript?.(newTranscript);
          onFinalTranscript?.(transcript);
          return { ...prev, transcript: newTranscript };
        });
      }

    } catch (err) {
      console.error('Whisper transcription error:', err);
      const errorMessage = 'Failed to transcribe audio';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [onTranscript, onFinalTranscript, onError]);

  // ========================================
  // PUBLIC METHODS
  // ========================================

  const startListening = useCallback(async () => {
    // Check permission first
    if (state.permissionGranted === null) {
      const granted = await requestPermission();
      if (!granted) return;
    } else if (!state.permissionGranted) {
      toast.error('Microphone permission required');
      return;
    }

    // Try Web Speech API first
    const SpeechRecognitionClass = getSpeechRecognition();
    if (SpeechRecognitionClass) {
      recognitionRef.current = initWebSpeechRecognition();
      recognitionRef.current?.start();
    } else if (useWhisperFallback) {
      // Fall back to Whisper
      await startWhisperRecording();
    } else {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported' }));
    }
  }, [state.permissionGranted, requestPermission, initWebSpeechRecognition, useWhisperFallback, startWhisperRecording]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current) {
      stopWhisperRecording();
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, [stopWhisperRecording]);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  const clearTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '', interimTranscript: '' }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
    clearTranscript,
    requestPermission,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    'not-allowed': 'Microphone permission denied',
    'no-speech': 'No speech detected. Try again.',
    'audio-capture': 'No microphone found',
    'network': 'Network error. Check your connection.',
    'aborted': 'Listening stopped',
    'service-not-allowed': 'Speech service not allowed',
  };
  return errorMessages[error] || `Speech error: ${error}`;
}

export default useVoiceInput;