// FILE: src/components/boardroom/VoicePlayer.tsx
// Audio playback component for board member responses

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  Loader2,
  SkipBack,
  SkipForward
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface VoicePlayerProps {
  text: string;
  memberSlug: string;
  memberName: string;
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  compact?: boolean;
}

export function VoicePlayer({ 
  text, 
  memberSlug, 
  memberName,
  autoPlay = false,
  onPlayStart,
  onPlayEnd,
  compact = false
}: VoicePlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate audio
  const generateAudio = async () => {
    if (audioUrl) {
      // Already have audio, just play it
      playAudio();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/boardroom/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text,
          member_slug: memberSlug,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate audio');
      }

      // Convert base64 to blob URL
      const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Auto-play after generation
      setTimeout(() => playAudio(url), 100);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Play audio
  const playAudio = (url?: string) => {
    const audioSrc = url || audioUrl;
    if (!audioSrc) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioSrc);
      
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
        }
      });

      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setDuration(audioRef.current.duration);
        }
      });

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
        onPlayEnd?.();
      });

      audioRef.current.addEventListener('error', (e) => {
        setError('Audio playback error');
        setIsPlaying(false);
      });
    }

    audioRef.current.src = audioSrc;
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.play();
    setIsPlaying(true);
    onPlayStart?.();
  };

  // Pause audio
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (isPlaying) {
      pauseAudio();
    } else if (audioUrl) {
      playAudio();
    } else {
      generateAudio();
    }
  };

  // Seek
  const handleSeek = (value: number[]) => {
    const time = value[0];
    setProgress(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  // Volume
  const handleVolumeChange = (value: number[]) => {
    const vol = value[0];
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    if (vol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume;
    }
  };

  // Skip forward/back
  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  // Playback rate
  const cyclePlaybackRate = () => {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Auto-play if enabled
  useEffect(() => {
    if (autoPlay && !audioUrl && !isLoading) {
      generateAudio();
    }
  }, [autoPlay]);

  if (error) {
    return (
      <div className="text-xs text-red-500 flex items-center gap-1">
        <VolumeX className="w-3 h-3" />
        {error}
      </div>
    );
  }

  // Compact mode - just a play button
  if (compact) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={togglePlayPause}
        disabled={isLoading}
        title={`Listen to ${memberName}`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </Button>
    );
  }

  // Full player
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      {/* Play/Pause */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0"
        onClick={togglePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>

      {/* Skip back */}
      {audioUrl && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => skip(-10)}
        >
          <SkipBack className="w-3 h-3" />
        </Button>
      )}

      {/* Progress */}
      {audioUrl && (
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10">
            {formatTime(progress)}
          </span>
          <Slider
            value={[progress]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Skip forward */}
      {audioUrl && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={() => skip(10)}
        >
          <SkipForward className="w-3 h-3" />
        </Button>
      )}

      {/* Playback rate */}
      {audioUrl && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1 text-xs"
          onClick={cyclePlaybackRate}
        >
          {playbackRate}x
        </Button>
      )}

      {/* Volume */}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={toggleMute}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="w-3 h-3" />
        ) : (
          <Volume2 className="w-3 h-3" />
        )}
      </Button>
      
      <Slider
        value={[isMuted ? 0 : volume]}
        max={1}
        step={0.1}
        onValueChange={handleVolumeChange}
        className="w-16"
      />
    </div>
  );
}

export default VoicePlayer;