// FILE: src/lib/wellness/solfeggio-kirtan.ts
// RH-001 + RH-002 + RH-042 — Solfeggio Tones + Healing Haptics + Kirtan Kriya
// All three rabbit holes in one file. Zero API cost. Pure client-side.
// Web Audio API for tones. navigator.vibrate() for haptics.
//
// Usage:
//   import { KirtanKriyaSession, SolfeggioPlayer, HapticPulse } from '@/lib/wellness/solfeggio-kirtan';

// =============================================================================
// SOLFEGGIO FREQUENCIES — RH-001
// =============================================================================

export const SOLFEGGIO_FREQUENCIES = {
  396: { name: 'UT',  description: 'Liberating guilt & fear',           color: '#FF0000' },
  417: { name: 'RE',  description: 'Undoing situations & facilitating change', color: '#FF7700' },
  528: { name: 'MI',  description: 'Transformation, miracles, DNA repair', color: '#FFFF00' },
  639: { name: 'FA',  description: 'Connecting relationships',           color: '#00FF00' },
  741: { name: 'SOL', description: 'Awakening intuition',                color: '#0000FF' },
  852: { name: 'LA',  description: 'Returning to spiritual order',       color: '#8B00FF' },
  963: { name: 'SI',  description: 'Divine consciousness',               color: '#FFFFFF' },
} as const;

export type SolfeggioHz = keyof typeof SOLFEGGIO_FREQUENCIES;

export class SolfeggioPlayer {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  play(hz: SolfeggioHz = 528, volume = 0.15): void {
    this.stop();
    const ctx = this.getContext();

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, ctx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2);
    this.gainNode.connect(ctx.destination);

    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(hz, ctx.currentTime);
    this.oscillator.connect(this.gainNode);
    this.oscillator.start();
    this.isPlaying = true;
  }

  // Smooth transition between phases (no jarring cuts)
  transition(newHz: SolfeggioHz, durationMs = 2000): void {
    if (!this.oscillator || !this.gainNode) { this.play(newHz); return; }
    const ctx = this.getContext();
    const fadeDuration = durationMs / 1000 / 2;

    // Fade out → change freq → fade in
    this.gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeDuration);
    setTimeout(() => {
      if (this.oscillator) {
        this.oscillator.frequency.setValueAtTime(newHz, ctx.currentTime);
      }
      this.gainNode?.gain.linearRampToValueAtTime(0.15, ctx.currentTime + fadeDuration);
    }, fadeDuration * 1000);
  }

  // Play a brief phase transition chime
  chime(hz: SolfeggioHz = 528): void {
    const ctx = this.getContext();
    const chimeOsc = ctx.createOscillator();
    const chimeGain = ctx.createGain();

    chimeGain.gain.setValueAtTime(0.3, ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    chimeGain.connect(ctx.destination);

    chimeOsc.type = 'sine';
    chimeOsc.frequency.setValueAtTime(hz, ctx.currentTime);
    chimeOsc.connect(chimeGain);
    chimeOsc.start();
    chimeOsc.stop(ctx.currentTime + 1.5);
  }

  stop(): void {
    if (this.oscillator) {
      try {
        this.gainNode?.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime || 0) + 1);
        setTimeout(() => {
          try { this.oscillator?.stop(); } catch { /* already stopped */ }
          this.oscillator = null;
        }, 1000);
      } catch { /* already stopped */ }
    }
    this.isPlaying = false;
  }

  get playing(): boolean { return this.isPlaying; }
}

// =============================================================================
// HAPTIC PULSE — RH-002
// =============================================================================

export class HapticPulse {
  // SA TA NA MA — 4 pulses, one per syllable
  // Pattern: pulse, pause, pulse, pause, pulse, pause, pulse
  static readonly MANTRA_PATTERN = [200, 100, 200, 100, 200, 100, 200];

  // Phase transition — longer double pulse
  static readonly TRANSITION_PATTERN = [400, 200, 400];

  // Session complete — triple slow pulse
  static readonly COMPLETE_PATTERN = [600, 300, 600, 300, 600];

  static isSupported(): boolean {
    return 'vibrate' in navigator;
  }

  static mantra(): void {
    if (!HapticPulse.isSupported()) return;
    navigator.vibrate(HapticPulse.MANTRA_PATTERN);
  }

  static transition(): void {
    if (!HapticPulse.isSupported()) return;
    navigator.vibrate(HapticPulse.TRANSITION_PATTERN);
  }

  static complete(): void {
    if (!HapticPulse.isSupported()) return;
    navigator.vibrate(HapticPulse.COMPLETE_PATTERN);
  }

  static stop(): void {
    if (!HapticPulse.isSupported()) return;
    navigator.vibrate(0);
  }
}

// =============================================================================
// KIRTAN KRIYA SESSION — RH-042
// 12-minute SA TA NA MA meditation
// =============================================================================

export interface KirtanPhase {
  id: number;
  name: string;
  durationSeconds: number;
  soundLevel: 'loud' | 'whisper' | 'silent';
  instruction: string;
  solfeggioHz: SolfeggioHz;
  hapticEnabled: boolean;
}

export const KIRTAN_PHASES: KirtanPhase[] = [
  {
    id: 1,
    name: 'Full Voice',
    durationSeconds: 120,
    soundLevel: 'loud',
    instruction: 'Chant SA TA NA MA aloud with each breath. Touch index, middle, ring, pinky fingers in rhythm.',
    solfeggioHz: 528,
    hapticEnabled: true,
  },
  {
    id: 2,
    name: 'Whisper',
    durationSeconds: 120,
    soundLevel: 'whisper',
    instruction: 'Bring your voice to a whisper. Continue the mudra. SA TA NA MA.',
    solfeggioHz: 417,
    hapticEnabled: true,
  },
  {
    id: 3,
    name: 'Silent',
    durationSeconds: 240,
    soundLevel: 'silent',
    instruction: 'Go completely silent. Hear the mantra only in your mind. Continue the mudra gently.',
    solfeggioHz: 741,
    hapticEnabled: false, // No vibration during silent phase — too distracting
  },
  {
    id: 4,
    name: 'Whisper',
    durationSeconds: 120,
    soundLevel: 'whisper',
    instruction: 'Return to whisper. Bring the mantra gently back to breath. SA TA NA MA.',
    solfeggioHz: 417,
    hapticEnabled: true,
  },
  {
    id: 5,
    name: 'Full Voice',
    durationSeconds: 120,
    soundLevel: 'loud',
    instruction: 'Return to full voice. Complete the cycle with energy and gratitude. SA TA NA MA.',
    solfeggioHz: 528,
    hapticEnabled: true,
  },
];

export const TOTAL_SESSION_SECONDS = KIRTAN_PHASES.reduce((s, p) => s + p.durationSeconds, 0); // 720s = 12min

export type SessionState = 'idle' | 'running' | 'paused' | 'complete';

export interface SessionProgress {
  state: SessionState;
  currentPhase: KirtanPhase | null;
  phaseIndex: number;
  phaseElapsed: number;
  phaseRemaining: number;
  totalElapsed: number;
  totalRemaining: number;
  totalProgress: number; // 0-1
}

export class KirtanKriyaSession {
  private player: SolfeggioPlayer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hapticTimer: ReturnType<typeof setInterval> | null = null;
  private phaseIndex = 0;
  private phaseElapsed = 0;
  private totalElapsed = 0;
  private state: SessionState = 'idle';
  private onProgress: (progress: SessionProgress) => void;
  private onPhaseChange: (phase: KirtanPhase) => void;
  private onComplete: () => void;

  constructor(callbacks: {
    onProgress: (progress: SessionProgress) => void;
    onPhaseChange: (phase: KirtanPhase) => void;
    onComplete: () => void;
  }) {
    this.player = new SolfeggioPlayer();
    this.onProgress = callbacks.onProgress;
    this.onPhaseChange = callbacks.onPhaseChange;
    this.onComplete = callbacks.onComplete;
  }

  start(): void {
    if (this.state === 'running') return;
    this.state = 'running';
    this.phaseIndex = 0;
    this.phaseElapsed = 0;
    this.totalElapsed = 0;

    const firstPhase = KIRTAN_PHASES[0];
    this.player.play(firstPhase.solfeggioHz);
    this.onPhaseChange(firstPhase);

    if (firstPhase.hapticEnabled) {
      this.startHapticLoop();
    }

    this.timer = setInterval(() => this.tick(), 1000);
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.player.stop();
    this.stopHapticLoop();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    const phase = KIRTAN_PHASES[this.phaseIndex];
    this.player.play(phase.solfeggioHz);
    if (phase.hapticEnabled) this.startHapticLoop();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    this.state = 'idle';
    this.player.stop();
    this.stopHapticLoop();
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    HapticPulse.stop();
  }

  private tick(): void {
    this.phaseElapsed++;
    this.totalElapsed++;

    const currentPhase = KIRTAN_PHASES[this.phaseIndex];

    this.onProgress({
      state: this.state,
      currentPhase,
      phaseIndex: this.phaseIndex,
      phaseElapsed: this.phaseElapsed,
      phaseRemaining: currentPhase.durationSeconds - this.phaseElapsed,
      totalElapsed: this.totalElapsed,
      totalRemaining: TOTAL_SESSION_SECONDS - this.totalElapsed,
      totalProgress: this.totalElapsed / TOTAL_SESSION_SECONDS,
    });

    // Phase complete?
    if (this.phaseElapsed >= currentPhase.durationSeconds) {
      this.nextPhase();
    }
  }

  private nextPhase(): void {
    this.stopHapticLoop();
    this.phaseElapsed = 0;
    this.phaseIndex++;

    if (this.phaseIndex >= KIRTAN_PHASES.length) {
      // Session complete
      this.state = 'complete';
      this.player.chime(528);
      HapticPulse.complete();
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this.incrementStreak();
      this.onComplete();
      return;
    }

    const nextPhase = KIRTAN_PHASES[this.phaseIndex];
    this.player.transition(nextPhase.solfeggioHz);
    this.player.chime(nextPhase.solfeggioHz);
    HapticPulse.transition();
    this.onPhaseChange(nextPhase);

    if (nextPhase.hapticEnabled) {
      // Small delay before restarting haptics so transition pulse is distinct
      setTimeout(() => this.startHapticLoop(), 3000);
    }
  }

  private startHapticLoop(): void {
    this.stopHapticLoop();
    // Pulse every ~2.4 seconds — approximately one SA TA NA MA cycle at moderate pace
    this.hapticTimer = setInterval(() => {
      if (this.state === 'running') HapticPulse.mantra();
    }, 2400);
  }

  private stopHapticLoop(): void {
    if (this.hapticTimer) {
      clearInterval(this.hapticTimer);
      this.hapticTimer = null;
    }
  }

  private incrementStreak(): void {
    try {
      const today = new Date().toDateString();
      const lastSession = localStorage.getItem('tagnetiq_kirtan_last');
      const streakStr = localStorage.getItem('tagnetiq_kirtan_streak') || '0';
      const streak = parseInt(streakStr, 10);

      const yesterday = new Date(Date.now() - 86400000).toDateString();

      let newStreak = 1;
      if (lastSession === yesterday) {
        newStreak = streak + 1; // Maintained streak
      } else if (lastSession === today) {
        newStreak = streak; // Already did today — don't increment again
      }

      localStorage.setItem('tagnetiq_kirtan_last', today);
      localStorage.setItem('tagnetiq_kirtan_streak', String(newStreak));
    } catch { /* silent */ }
  }

  static getStreak(): { streak: number; lastSession: string | null; isTodayComplete: boolean } {
    try {
      const today = new Date().toDateString();
      const lastSession = localStorage.getItem('tagnetiq_kirtan_last');
      const streak = parseInt(localStorage.getItem('tagnetiq_kirtan_streak') || '0', 10);
      return { streak, lastSession, isTodayComplete: lastSession === today };
    } catch {
      return { streak: 0, lastSession: null, isTodayComplete: false };
    }
  }
}