// FILE: src/components/AudioLevelMeter.tsx
// Visual audio level meter for video recording
// Mobile-first: compact, touch-friendly, battery-conscious

import React, { memo, useEffect } from 'react';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface AudioLevelMeterProps {
  /** MediaStream to monitor (optional - will request mic if not provided) */
  stream?: MediaStream;
  /** Number of bars in the meter */
  bars?: number;
  /** Orientation of the meter */
  orientation?: 'horizontal' | 'vertical';
  /** Show decibel value */
  showDecibels?: boolean;
  /** Compact mode (just bars, no labels) */
  compact?: boolean;
  /** Auto-start monitoring */
  autoStart?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when clipping is detected */
  onClipping?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const AudioLevelMeter = memo<AudioLevelMeterProps>(function AudioLevelMeter({
  stream,
  bars = 10,
  orientation = 'horizontal',
  showDecibels = false,
  compact = false,
  autoStart = false,
  className = '',
  onClipping,
}) {
  const {
    isMonitoring,
    audioData,
    error,
    startMonitoring,
    stopMonitoring,
    getBarCount,
    getLevelColor,
  } = useAudioLevel();

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isMonitoring) {
      startMonitoring(stream);
    }
    return () => {
      if (autoStart) {
        stopMonitoring();
      }
    };
  }, [autoStart, stream]); // eslint-disable-line react-hooks/exhaustive-deps

  // Callback when clipping
  useEffect(() => {
    if (audioData.isClipping && onClipping) {
      onClipping();
    }
  }, [audioData.isClipping, onClipping]);

  const activeBars = getBarCount(bars);
  const levelColor = getLevelColor();

  // ---------------------------------------------------------------------------
  // RENDER: HORIZONTAL METER
  // ---------------------------------------------------------------------------

  if (orientation === 'horizontal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Mic icon / toggle */}
        {!compact && (
          <button
            onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring(stream))}
            className={cn(
              'p-1.5 rounded-full transition-colors',
              isMonitoring
                ? 'bg-green-500/20 text-green-500'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            title={isMonitoring ? 'Stop monitoring' : 'Start monitoring'}
          >
            {isMonitoring ? (
              <Mic className="w-4 h-4" />
            ) : (
              <MicOff className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Level bars */}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: bars }).map((_, i) => {
            const isActive = i < activeBars;
            const barColor = isActive
              ? i >= bars * 0.9
                ? '#ef4444' // Red for top 10%
                : i >= bars * 0.7
                ? '#f59e0b' // Yellow for 70-90%
                : '#22c55e' // Green for rest
              : undefined;

            return (
              <div
                key={i}
                className={cn(
                  'w-1.5 rounded-sm transition-all duration-75',
                  compact ? 'h-3' : 'h-4',
                  isActive ? '' : 'bg-muted'
                )}
                style={{
                  backgroundColor: isActive ? barColor : undefined,
                }}
              />
            );
          })}
        </div>

        {/* Peak indicator */}
        {!compact && audioData.isClipping && (
          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
        )}

        {/* Decibel display */}
        {showDecibels && (
          <span className="text-xs font-mono text-muted-foreground min-w-[3rem]">
            {audioData.decibels > -100 ? `${audioData.decibels}dB` : '—'}
          </span>
        )}

        {/* Error indicator */}
        {error && !compact && (
          <span className="text-xs text-red-500" title={error}>
            ⚠️
          </span>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: VERTICAL METER
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      {/* Level bars (vertical) */}
      <div className="flex flex-col-reverse items-center gap-0.5">
        {Array.from({ length: bars }).map((_, i) => {
          const isActive = i < activeBars;
          const barColor = isActive
            ? i >= bars * 0.9
              ? '#ef4444'
              : i >= bars * 0.7
              ? '#f59e0b'
              : '#22c55e'
            : undefined;

          return (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-sm transition-all duration-75',
                compact ? 'w-3' : 'w-4',
                isActive ? '' : 'bg-muted'
              )}
              style={{
                backgroundColor: isActive ? barColor : undefined,
              }}
            />
          );
        })}
      </div>

      {/* Mic icon */}
      {!compact && (
        <button
          onClick={() => (isMonitoring ? stopMonitoring() : startMonitoring(stream))}
          className={cn(
            'p-1 rounded-full transition-colors',
            isMonitoring
              ? 'bg-green-500/20 text-green-500'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isMonitoring ? (
            <Mic className="w-3 h-3" />
          ) : (
            <MicOff className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
});

// =============================================================================
// FLOATING AUDIO METER (For overlaying on video)
// =============================================================================

interface FloatingAudioMeterProps {
  stream?: MediaStream;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoStart?: boolean;
}

export const FloatingAudioMeter = memo<FloatingAudioMeterProps>(function FloatingAudioMeter({
  stream,
  position = 'bottom-right',
  autoStart = false,
}) {
  const positionClasses = {
    'top-left': 'top-2 left-2',
    'top-right': 'top-2 right-2',
    'bottom-left': 'bottom-2 left-2',
    'bottom-right': 'bottom-2 right-2',
  };

  return (
    <div
      className={cn(
        'absolute z-20 bg-black/50 backdrop-blur-sm rounded-lg p-2',
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
});

export default AudioLevelMeter;