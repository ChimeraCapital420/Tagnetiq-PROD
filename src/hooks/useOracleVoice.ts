// FILE: src/hooks/useOracleVoice.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Voice — Text-to-Speech hook for Oracle responses
// ═══════════════════════════════════════════════════════════════════════
//
// Wraps window.speechSynthesis. Gives Dash a voice.
//
// MUTE PERSISTENCE:
//   isMuted is stored in localStorage under 'oracle-muted'.
//   User taps the mute toggle in OracleBar → stays muted across sessions.
//   Use case: auction floors, private residences, competitive bidders.
//
// SPEAK BEHAVIOR:
//   - Strips markdown (**, *, #, `, bullet points) before speaking.
//     Dash shouldn't say "asterisk asterisk bold asterisk asterisk".
//   - Cancels any in-progress speech before starting new response.
//   - Respects isMuted — speak() is a no-op when muted.
//   - Selects the best available voice: prefers neural/natural voices,
//     falls back to first English voice, then system default.
//
// USAGE:
//   const { speak, stop, isMuted, toggleMute, isSpeaking } = useOracleVoice();
//   speak(responseText);   // after Oracle responds
//   toggleMute();          // from mute button in OracleBar
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useEffect, useRef } from 'react';

const MUTE_KEY = 'oracle-muted';

// =============================================================================
// TEXT SANITIZER — strip markdown so TTS sounds natural
// =============================================================================

function sanitizeForSpeech(text: string): string {
  return text
    // Remove markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks entirely
    .replace(/```[\s\S]*?```/g, 'code block omitted')
    // Remove markdown links — keep label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bullet points
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove numbered list markers
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse multiple newlines to a pause
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// =============================================================================
// VOICE SELECTOR — prefer neural/natural voices, fall back gracefully
// =============================================================================

function selectVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  // Prefer Google or Apple neural voices (en-US)
  const neural = voices.find(v =>
    v.lang.startsWith('en') &&
    (v.name.includes('Neural') || v.name.includes('Natural') ||
     v.name.includes('Google') || v.name.includes('Samantha') ||
     v.name.includes('Alex') || v.name.includes('Karen'))
  );
  if (neural) return neural;

  // Fall back to any English voice
  const english = voices.find(v => v.lang.startsWith('en'));
  if (english) return english;

  // Last resort — first available
  return voices[0];
}

// =============================================================================
// HOOK
// =============================================================================

export function useOracleVoice() {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Load voices — Chrome loads them async, Safari loads sync
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [isSupported]);

  // ── Speak ──────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!isSupported || isMuted || !text.trim()) return;

    // Cancel anything currently playing
    window.speechSynthesis.cancel();

    const clean = sanitizeForSpeech(text);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);

    // Voice selection
    const voice = selectVoice(voicesRef.current);
    if (voice) utterance.voice = voice;

    // Natural speaking pace — not robotic, not rushed
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isSupported, isMuted]);

  // ── Stop ───────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  // ── Toggle mute ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, String(next));
      } catch { /* ignore */ }
      // Stop current speech immediately when muting
      if (next) window.speechSynthesis?.cancel();
      return next;
    });
  }, []);

  return {
    speak,
    stop,
    isMuted,
    toggleMute,
    isSpeaking,
    isSupported,
  };
}