// FILE: src/components/wellness/KirtanKriyaTimer.tsx
// RH-042 — Kirtan Kriya 12-Minute Session UI
// Mobile-first. Full-screen during session. Phase transitions animated.
// Works with solfeggio-kirtan.ts engine — zero API cost.
//
// Usage:
//   import KirtanKriyaTimer from '@/components/wellness/KirtanKriyaTimer';
//   <KirtanKriyaTimer />

import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, Flame } from 'lucide-react';
import {
  KirtanKriyaSession,
  KIRTAN_PHASES,
  TOTAL_SESSION_SECONDS,
  type KirtanPhase,
  type SessionProgress,
} from '@/lib/wellness/solfeggio-kirtan';

const SOUND_LEVEL_CONFIG = {
  loud:    { label: 'FULL VOICE',  color: 'text-amber-300',  bg: 'bg-amber-950/40',  pulse: true },
  whisper: { label: 'WHISPER',     color: 'text-blue-300',   bg: 'bg-blue-950/40',   pulse: false },
  silent:  { label: 'SILENT',      color: 'text-purple-300', bg: 'bg-purple-950/60', pulse: false },
};

const SYLLABLES = ['SA', 'TA', 'NA', 'MA'];
const FINGER_LABELS = ['Index', 'Middle', 'Ring', 'Pinky'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const KirtanKriyaTimer: React.FC = () => {
  const [session] = useState(() => new KirtanKriyaSession({
    onProgress: (p) => setProgress(p),
    onPhaseChange: (ph) => setCurrentPhase(ph),
    onComplete: () => setComplete(true),
  }));

  const [progress, setProgress] = useState<SessionProgress | null>(null);
  const [currentPhase, setCurrentPhase] = useState<KirtanPhase | null>(null);
  const [complete, setComplete] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeSyllable, setActiveSyllable] = useState(0);
  const [streak, setStreak] = useState(KirtanKriyaSession.getStreak());

  // Cycle through syllables for visual rhythm
  useEffect(() => {
    if (!progress || progress.state !== 'running') return;
    if (currentPhase?.soundLevel === 'silent') return; // Don't animate during silent phase

    const interval = setInterval(() => {
      setActiveSyllable(prev => (prev + 1) % 4);
    }, 600); // ~100bpm — comfortable chanting pace

    return () => clearInterval(interval);
  }, [progress?.state, currentPhase?.soundLevel]);

  const handleStart = useCallback(() => {
    setComplete(false);
    session.start();
  }, [session]);

  const handlePauseResume = useCallback(() => {
    if (progress?.state === 'running') session.pause();
    else if (progress?.state === 'paused') session.resume();
  }, [session, progress?.state]);

  const handleStop = useCallback(() => {
    session.stop();
    setProgress(null);
    setCurrentPhase(null);
    setComplete(false);
    setStreak(KirtanKriyaSession.getStreak());
  }, [session]);

  // Idle / pre-session screen
  if (!progress || progress.state === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        {/* Streak */}
        {streak.streak > 0 && (
          <div className="flex items-center gap-1.5 mb-6 px-4 py-2 rounded-full bg-amber-950/40 border border-amber-500/20">
            <Flame className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">{streak.streak} day streak</span>
            {streak.isTodayComplete && <span className="text-xs text-amber-400/60 ml-1">✓ done today</span>}
          </div>
        )}

        {/* Title */}
        <div className="mb-8">
          <p className="text-5xl mb-3" aria-hidden>🕉</p>
          <h1 className="text-2xl font-bold text-white mb-2">Kirtan Kriya</h1>
          <p className="text-white/50 text-sm max-w-xs">12 minutes · SA TA NA MA · Solfeggio 528 Hz</p>
        </div>

        {/* Mantra preview */}
        <div className="flex gap-4 mb-8">
          {SYLLABLES.map((syl, i) => (
            <div key={syl} className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/20 flex items-center justify-center mb-1">
                <span className="text-purple-200 font-bold text-sm">{syl}</span>
              </div>
              <span className="text-white/30 text-xs">{FINGER_LABELS[i]}</span>
            </div>
          ))}
        </div>

        {/* Phases preview */}
        <div className="flex gap-1 mb-8 w-full max-w-xs">
          {KIRTAN_PHASES.map(phase => (
            <div
              key={phase.id}
              className={`flex-1 h-1.5 rounded-full ${
                phase.soundLevel === 'loud'    ? 'bg-amber-400' :
                phase.soundLevel === 'whisper' ? 'bg-blue-400' :
                'bg-purple-400'
              }`}
              style={{ flexGrow: phase.durationSeconds }}
            />
          ))}
        </div>
        <div className="flex gap-4 text-xs text-white/40 mb-8">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Full Voice</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Whisper</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" />Silent</span>
        </div>

        <button
          onClick={handleStart}
          className="w-full max-w-xs py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-all active:scale-[0.98] shadow-lg shadow-purple-900/40"
        >
          Begin Session
        </button>

        <p className="text-white/30 text-xs mt-4 max-w-xs">
          Find a comfortable seat. Rest your hands on your knees. The session will guide you through each phase.
        </p>
      </div>
    );
  }

  // Complete screen
  if (complete) {
    const newStreak = KirtanKriyaSession.getStreak();
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <p className="text-6xl mb-4">🙏</p>
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
        <p className="text-white/50 text-sm mb-6">12 minutes · SA TA NA MA</p>
        {newStreak.streak > 0 && (
          <div className="flex items-center gap-2 mb-6 px-5 py-3 rounded-2xl bg-amber-950/50 border border-amber-500/30">
            <Flame className="w-5 h-5 text-amber-400" />
            <div className="text-left">
              <p className="text-sm font-bold text-amber-300">{newStreak.streak} Day Streak</p>
              <p className="text-xs text-amber-400/60">
                {newStreak.streak >= 8 ? 'Research threshold reached — changes are taking hold.' : `${8 - newStreak.streak} more days to the 8-day research threshold.`}
              </p>
            </div>
          </div>
        )}
        <p className="text-white/40 text-sm max-w-xs mb-8">
          Take a moment before returning to your day. The effects of the practice continue after the session ends.
        </p>
        <button
          onClick={handleStop}
          className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all"
        >
          Return
        </button>
      </div>
    );
  }

  const lvlConfig = SOUND_LEVEL_CONFIG[currentPhase?.soundLevel || 'loud'];
  const phaseProgress = progress.phaseElapsed / (currentPhase?.durationSeconds || 1);
  const circumference = 2 * Math.PI * 90; // r=90

  return (
    <div className="flex flex-col items-center justify-between min-h-[80vh] px-6 py-8">
      {/* Phase name */}
      <div className={`px-5 py-2 rounded-full ${lvlConfig.bg} border border-white/10`}>
        <p className={`text-sm font-bold tracking-widest ${lvlConfig.color} ${lvlConfig.pulse ? 'animate-pulse' : ''}`}>
          {lvlConfig.label}
        </p>
      </div>

      {/* Ring timer */}
      <div className="relative flex items-center justify-center my-6">
        <svg width="200" height="200" className="-rotate-90">
          {/* Background ring */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          {/* Progress ring */}
          <circle
            cx="100" cy="100" r="90"
            fill="none"
            stroke={currentPhase?.soundLevel === 'loud' ? '#fbbf24' : currentPhase?.soundLevel === 'whisper' ? '#60a5fa' : '#a78bfa'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - phaseProgress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute text-center">
          <p className="text-4xl font-bold text-white tabular-nums">
            {formatTime(progress.phaseRemaining)}
          </p>
          <p className="text-white/40 text-xs mt-1">
            Phase {progress.phaseIndex + 1} of {KIRTAN_PHASES.length}
          </p>
        </div>
      </div>

      {/* Syllable display */}
      <div className="flex gap-3 mb-4">
        {SYLLABLES.map((syl, i) => (
          <div
            key={syl}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 ${
              i === activeSyllable && currentPhase?.soundLevel !== 'silent'
                ? 'bg-white/20 scale-110 shadow-lg'
                : 'bg-white/5'
            }`}
          >
            <span className={`text-lg font-bold ${i === activeSyllable && currentPhase?.soundLevel !== 'silent' ? 'text-white' : 'text-white/40'}`}>
              {syl}
            </span>
            <span className="text-[9px] text-white/20 mt-0.5">{FINGER_LABELS[i]}</span>
          </div>
        ))}
      </div>

      {/* Instruction */}
      {currentPhase && (
        <p className="text-center text-white/60 text-sm leading-relaxed max-w-xs px-2 mb-4">
          {currentPhase.instruction}
        </p>
      )}

      {/* Total progress bar */}
      <div className="w-full max-w-xs mb-6">
        <div className="flex justify-between text-xs text-white/30 mb-1">
          <span>{formatTime(progress.totalElapsed)}</span>
          <span>{formatTime(TOTAL_SESSION_SECONDS)}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress.totalProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleStop}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition-all active:scale-95"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={handlePauseResume}
          className="w-16 h-16 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shadow-lg shadow-purple-900/40 transition-all active:scale-95"
        >
          {progress.state === 'running'
            ? <Pause className="w-6 h-6" />
            : <Play className="w-6 h-6 ml-0.5" />
          }
        </button>
        <button
          onClick={() => setAudioEnabled(p => !p)}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition-all active:scale-95"
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default KirtanKriyaTimer;