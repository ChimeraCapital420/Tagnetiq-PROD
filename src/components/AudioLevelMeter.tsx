// FILE: src/components/AudioLevelMeter.tsx
// Visual audio level indicator for video recording
// Mobile-first: battery-conscious, GPU-accelerated animations

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AudioLevelMeterProps {
  stream?: MediaStream | null;
  bars?: number;
  compact?: boolean;
  autoStart?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

interface FloatingAudioMeterProps {
  stream?: MediaStream | null;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoStart?: boolean;
}

// =============================================================================
// AUDIO LEVEL HOOK (Internal)
// =============================================================================

const useAudioLevel = (stream: MediaStream | null | undefined) => {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peakDecayRef = useRef(0);

  const startMonitoring = useCallback((inputStream?: MediaStream) => {
    const streamToUse = inputStream || stream;
    
    if (!streamToUse) {
      setError('No audio stream available');
      return;
    }

    // Check for audio tracks
    const audioTracks = streamToUse.getAudioTracks();
    if (audioTracks.length === 0) {
      setError('No audio track in stream');
      return;
    }

    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;

      // Resume if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Create analyser
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create source from stream
      const source = audioContext.createMediaStreamSource(streamToUse);
      source.connect(analyser);
      sourceRef.current = source;

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedLevel = Math.min(100, (rms / 128) * 100);

        setLevel(normalizedLevel);

        // Update peak with decay
        if (normalizedLevel > peakDecayRef.current) {
          peakDecayRef.current = normalizedLevel;
          setPeak(normalizedLevel);
        } else {
          peakDecayRef.current = Math.max(0, peakDecayRef.current - 1);
          setPeak(peakDecayRef.current);
        }

        // Clipping detection
        setIsClipping(normalizedLevel > 95);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      setIsMonitoring(true);
      setError(null);
    } catch (err) {
      console.error('Audio monitoring error:', err);
      setError('Failed to start audio monitoring');
    }
  }, [stream]);

  const stopMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    setIsMonitoring(false);
    setLevel(0);
    setPeak(0);
    setIsClipping(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopMonitoring]);

  return {
    level,
    peak,
    isClipping,
    isMonitoring,
    error,
    startMonitoring,
    stopMonitoring,
  };
};

// =============================================================================
// AUDIO LEVEL METER COMPONENT
// =============================================================================

export const AudioLevelMeter = memo<AudioLevelMeterProps>(function AudioLevelMeter({
  stream,
  bars = 10,
  compact = false,
  autoStart = false,
  orientation = 'horizontal',
  className = '',
}) {
  const {
    level,
    peak,
    isClipping,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  } = useAudioLevel(stream);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && stream && !isMonitoring) {
      startMonitoring();
    }
  }, [autoStart, stream, isMonitoring, startMonitoring]);

  // Generate bar levels
  const barLevels = Array.from({ length: bars }, (_, i) => {
    const threshold = ((i + 1) / bars) * 100;
    return level >= threshold;
  });

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isVertical ? 'flex-col-reverse' : 'flex-row',
        className
      )}
    >
      {/* Level bars */}
      <div
        className={cn(
          'flex gap-0.5',
          isVertical ? 'flex-col-reverse' : 'flex-row'
        )}
      >
        {barLevels.map((isActive, i) => {
          // Color gradient: green -> yellow -> red
          const percentage = ((i + 1) / bars) * 100;
          const barColor = isActive
            ? percentage > 90
              ? '#ef4444' // red
              : percentage > 70
              ? '#f59e0b' // yellow
              : '#22c55e' // green
            : undefined;

          return (
            <div
              key={i}
              className={cn(
                'rounded-sm transition-all duration-75',
                isVertical ? 'w-3 h-1.5' : 'h-3 w-1.5',
                compact && (isVertical ? 'w-2 h-1' : 'h-2 w-1'),
                isActive ? '' : 'bg-muted/50'
              )}
              style={{
                backgroundColor: barColor,
                // GPU acceleration
                transform: 'translateZ(0)',
              }}
            />
          );
        })}
      </div>

      {/* Peak indicator */}
      {!compact && (
        <div
          className={cn(
            'text-xs font-mono tabular-nums',
            isClipping ? 'text-red-500 font-bold' : 'text-muted-foreground'
          )}
        >
          {Math.round(level)}%
        </div>
      )}

      {/* Mic icon toggle */}
      {!compact && (
        <button
          onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring(stream || undefined))}
          className={cn(
            'p-1 rounded-full transition-colors',
            isMonitoring
              ? 'bg-green-500/20 text-green-500'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
          title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
        >
          {isMonitoring ? (
            <Mic className="w-3 h-3" />
          ) : (
            <MicOff className="w-3 h-3" />
          )}
        </button>
      )}

      {/* Clipping indicator */}
      {isClipping && (
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Audio clipping!" />
      )}
    </div>
  );
});

// =============================================================================
// FLOATING AUDIO METER (For overlaying on video)
// =============================================================================

export const FloatingAudioMeter = memo<FloatingAudioMeterProps>(
  function FloatingAudioMeter({
    stream,
    position = 'bottom-right',
    autoStart = true,
  }) {
    const positionClasses = {
      'top-left': 'top-3 left-3',
      'top-right': 'top-3 right-3',
      'bottom-left': 'bottom-3 left-3',
      'bottom-right': 'bottom-3 right-3',
    };

    return (
      <div
        className={cn(
          'absolute z-20 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2',
          positionClasses[position]
        )}
      >
        <AudioLevelMeter
          stream={stream}
          bars={8}
          compact
          autoStart={autoStart}
          orientation="horizontal"
        />
      </div>
    );
  }
);

// =============================================================================
// EXPORTS
// =============================================================================

export default AudioLevelMeter;