// FILE: src/hooks/useStt.ts
// Oracle Phase 1 — Speech-to-Text hook
// FIXED: startListening() returns Promise<string>
// FIXED: PWA/standalone mode fallback — iOS blocks Web Speech API in home-screen apps
//        Falls back to MediaRecorder → /api/oracle/transcribe (Whisper)
// NOTE: Uses dedicated Oracle transcribe endpoint, NOT boardroom pipeline
// Mobile-first: Detects environment and picks the best path automatically

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

// =============================================================================
// BROWSER DETECTION
// =============================================================================

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

/**
 * Detect if running as installed PWA (home screen app).
 * iOS Safari strips Web Speech API in standalone mode.
 */
const isStandaloneMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  if ((navigator as any).standalone === true) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
};

/**
 * Determine which STT engine to use:
 * - 'web-speech': Browser-native (fastest, free, but not in iOS PWA)
 * - 'whisper': MediaRecorder → Oracle transcribe API (works everywhere)
 */
const getSTTEngine = (): 'web-speech' | 'whisper' => {
  const hasWebSpeech = !!getSpeechRecognition();
  const isPWA = isStandaloneMode();

  // iOS PWA: Web Speech API exists on window but throws on .start()
  if (isPWA && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return 'whisper';
  }

  if (hasWebSpeech) return 'web-speech';
  return 'whisper';
};

// =============================================================================
// HOOK
// =============================================================================

export const useStt = () => {
  const { i18n } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortRef = useRef(false);

  const engine = getSTTEngine();
  const isSupported = engine === 'web-speech' || (typeof navigator !== 'undefined' && !!navigator.mediaDevices);

  // ── Web Speech API path ─────────────────────────────────
  const startWebSpeech = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const SpeechRecognitionClass = getSpeechRecognition();
      if (!SpeechRecognitionClass) {
        resolve('');
        return;
      }

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
        if (event.error === 'aborted') {
          // User cancelled — silent
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

  // ── Whisper API path (PWA / fallback) ───────────────────
  const startWhisper = useCallback((): Promise<string> => {
    return new Promise(async (resolve) => {
      abortRef.current = false;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });

        // Determine best supported MIME type
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : 'audio/webm';

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunksRef.current = [];
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          // Clean up mic stream immediately
          stream.getTracks().forEach(track => track.stop());

          if (abortRef.current) {
            resolve('');
            return;
          }

          // Build audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          // Skip tiny recordings (< 0.5s of silence)
          if (audioBlob.size < 5000) {
            toast.info('No speech detected. Try again.');
            resolve('');
            return;
          }

          // Send to Oracle transcribe endpoint (NOT boardroom)
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const formData = new FormData();
            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
            formData.append('audio', audioBlob, `command.${ext}`);
            formData.append('language', i18n.language || 'en');

            const response = await fetch('/api/oracle/transcribe', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: formData,
            });

            if (!response.ok) throw new Error('Transcription failed');

            const data = await response.json();
            const text = (data.text || '').trim();

            if (text) {
              setTranscript(text);
              resolve(text);
            } else {
              toast.info('No speech detected. Try again.');
              resolve('');
            }
          } catch (err) {
            console.error('Oracle transcription error:', err);
            toast.error('Could not transcribe audio. Try again.');
            resolve('');
          }
        };

        // Start recording
        mediaRecorder.start(250); // Collect chunks every 250ms
        setIsListening(true);
        setTranscript('');

        // Auto-stop after 8 seconds (voice commands are short)
        setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
          }
        }, 8000);

      } catch (err) {
        console.error('Microphone access error:', err);
        if ((err as any)?.name === 'NotAllowedError') {
          toast.error('Microphone permission denied.');
        } else {
          toast.error('Could not access microphone.');
        }
        setIsListening(false);
        resolve('');
      }
    });
  }, [i18n.language]);

  // ── Public API ──────────────────────────────────────────

  /**
   * Start listening and return a Promise that resolves with the transcript.
   * Automatically picks Web Speech or Whisper based on environment.
   */
  const startListening = useCallback((): Promise<string> => {
    console.log(`🎤 STT engine: ${engine}${isStandaloneMode() ? ' (PWA mode)' : ''}`);

    if (engine === 'web-speech') {
      return startWebSpeech();
    }
    return startWhisper();
  }, [engine, startWebSpeech, startWhisper]);

  /**
   * Stop listening immediately.
   */
  const stopListening = useCallback(() => {
    abortRef.current = true;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    engine, // Expose so OracleVoiceButton can show engine in dev
  };
};