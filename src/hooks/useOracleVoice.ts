// FILE: src/hooks/useOracleVoice.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Voice — Text-to-Speech hook for Oracle responses
// ═══════════════════════════════════════════════════════════════════════
//
// v2.0 — ElevenLabs support:
//   speak() now accepts optional voiceURI + premiumVoiceId params.
//   When premiumVoiceId provided, calls /api/oracle/generate-speech.
//   Falls back to browser TTS if no premium voice or API fails.
//   OracleBar passes these from profile.settings — same Jess voice everywhere.
//
// MUTE PERSISTENCE:
//   isMuted stored in localStorage under 'oracle-muted'.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const MUTE_KEY = 'oracle-muted';

function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, 'code block omitted')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function selectVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const neural = voices.find(v =>
    v.lang.startsWith('en') &&
    (v.name.includes('Neural') || v.name.includes('Natural') ||
     v.name.includes('Google') || v.name.includes('Samantha') ||
     v.name.includes('Alex') || v.name.includes('Karen'))
  );
  if (neural) return neural;
  const english = voices.find(v => v.lang.startsWith('en'));
  if (english) return english;
  return voices[0];
}

export function useOracleVoice() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isSupported) return;
    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [isSupported]);

  const speakWithBrowser = useCallback((text: string) => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    const clean = sanitizeForSpeech(text);
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = selectVoice(voicesRef.current);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  // speak() — ElevenLabs when premiumVoiceId provided, browser TTS fallback
  const speak = useCallback(async (
    text: string,
    voiceURI?: string | null,
    premiumVoiceId?: string | null,
  ) => {
    if (isMuted || !text.trim()) return;

    // Stop anything currently playing
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis.cancel();

    if (premiumVoiceId) {
      setIsSpeaking(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const response = await fetch('/api/oracle/generate-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            text: sanitizeForSpeech(text),
            voiceId: premiumVoiceId,
          }),
        });

        if (!response.ok) throw new Error(`ElevenLabs ${response.status}`);

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
          setIsSpeaking(false);
          audioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        });

        await audio.play();
        return;

      } catch (err) {
        console.warn('[useOracleVoice] ElevenLabs failed, falling back:', err);
        setIsSpeaking(false);
        speakWithBrowser(text);
        return;
      }
    }

    speakWithBrowser(text);
  }, [isMuted, speakWithBrowser]);

  const stop = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch { /* ignore */ }
      if (next) {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        window.speechSynthesis?.cancel();
      }
      return next;
    });
  }, []);

  return { speak, stop, isMuted, toggleMute, isSpeaking, isSupported };
}