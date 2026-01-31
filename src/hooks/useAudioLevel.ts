// FILE: src/hooks/useAudioLevel.ts
// Real-time audio level monitoring using Web Audio API
// Mobile-first: battery-conscious, auto-cleanup, visual feedback ready

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface AudioLevelData {
  level: number;          // 0-100 normalized level
  peak: number;           // 0-100 peak level (with decay)
  isClipping: boolean;    // True if audio is clipping (too loud)
  isSilent: boolean;      // True if essentially no audio
  decibels: number;       // Raw dB value (-100 to 0)
}

export interface UseAudioLevelReturn {
  // State
  isMonitoring: boolean;
  audioData: AudioLevelData;
  error: string | null;
  
  // Actions
  startMonitoring: (stream?: MediaStream) => Promise<void>;
  stopMonitoring: () => void;
  
  // For visualization
  getBarCount: (totalBars: number) => number; // Returns how many bars to light up
  getLevelColor: () => string; // Returns color based on level (green/yellow/red)
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SILENCE_THRESHOLD = 5;      // Below this is considered silent
const CLIPPING_THRESHOLD = 95;    // Above this is considered clipping
const PEAK_DECAY_RATE = 0.95;     // How fast peak decays (0-1)
const UPDATE_INTERVAL_MS = 50;    // How often to update (20fps)

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useAudioLevel(): UseAudioLevelReturn {
  // State
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [audioData, setAudioData] = useState<AudioLevelData>({
    level: 0,
    peak: 0,
    isClipping: false,
    isSilent: true,
    decibels: -100,
  });
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  const cleanup = useCallback(() => {
    console.log('🎤 [AUDIO] Cleaning up audio monitoring');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    dataArrayRef.current = null;
    peakRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ---------------------------------------------------------------------------
  // ANALYSIS LOOP
  // ---------------------------------------------------------------------------

  const analyze = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) {
      return;
    }

    // Get frequency data
    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

    // Calculate RMS (root mean square) for more accurate level
    let sum = 0;
    const data = dataArrayRef.current;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);

    // Normalize to 0-100
    const normalizedLevel = Math.min(100, (rms / 255) * 100 * 1.5); // 1.5x boost for visibility

    // Calculate decibels (approximate)
    const decibels = rms > 0 ? 20 * Math.log10(rms / 255) : -100;

    // Update peak with decay
    if (normalizedLevel > peakRef.current) {
      peakRef.current = normalizedLevel;
    } else {
      peakRef.current *= PEAK_DECAY_RATE;
    }

    // Update state
    setAudioData({
      level: Math.round(normalizedLevel),
      peak: Math.round(peakRef.current),
      isClipping: normalizedLevel >= CLIPPING_THRESHOLD,
      isSilent: normalizedLevel < SILENCE_THRESHOLD,
      decibels: Math.round(decibels),
    });

    // Continue loop
    animationFrameRef.current = requestAnimationFrame(analyze);
  }, []);

  // ---------------------------------------------------------------------------
  // START MONITORING
  // ---------------------------------------------------------------------------

  const startMonitoring = useCallback(async (existingStream?: MediaStream) => {
    console.log('🎤 [AUDIO] Starting audio monitoring');
    setError(null);

    try {
      // Get audio stream
      let stream = existingStream;
      
      if (!stream) {
        // Request microphone access
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
      }

      // Check if stream has audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available');
      }

      console.log(`🎤 [AUDIO] Using audio track: ${audioTracks[0].label}`);

      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // Resume context if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create analyser node
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Create source from stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      // Create data array for analysis
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      // Start analysis loop
      setIsMonitoring(true);
      analyze();

      console.log('🎤 [AUDIO] Monitoring started successfully');

    } catch (err: any) {
      console.error('🎤 [AUDIO] Failed to start monitoring:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on this device.');
      } else {
        setError(err.message || 'Failed to start audio monitoring');
      }
      
      cleanup();
    }
  }, [analyze, cleanup]);

  // ---------------------------------------------------------------------------
  // STOP MONITORING
  // ---------------------------------------------------------------------------

  const stopMonitoring = useCallback(() => {
    console.log('🎤 [AUDIO] Stopping audio monitoring');
    setIsMonitoring(false);
    cleanup();
    
    setAudioData({
      level: 0,
      peak: 0,
      isClipping: false,
      isSilent: true,
      decibels: -100,
    });
  }, [cleanup]);

  // ---------------------------------------------------------------------------
  // HELPER: GET BAR COUNT FOR VISUALIZATION
  // ---------------------------------------------------------------------------

  const getBarCount = useCallback((totalBars: number): number => {
    return Math.round((audioData.level / 100) * totalBars);
  }, [audioData.level]);

  // ---------------------------------------------------------------------------
  // HELPER: GET LEVEL COLOR
  // ---------------------------------------------------------------------------

  const getLevelColor = useCallback((): string => {
    if (audioData.isClipping) return '#ef4444'; // Red
    if (audioData.level > 70) return '#f59e0b'; // Yellow/Orange
    return '#22c55e'; // Green
  }, [audioData.level, audioData.isClipping]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    isMonitoring,
    audioData,
    error,
    startMonitoring,
    stopMonitoring,
    getBarCount,
    getLevelColor,
  };
}

export default useAudioLevel;