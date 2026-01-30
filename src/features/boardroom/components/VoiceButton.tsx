// FILE: src/features/boardroom/components/VoiceButton.tsx
// Voice playback button component for TTS

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants';

interface VoiceButtonProps {
  text: string;
  memberSlug: string;
  memberName: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ 
  text, 
  memberSlug, 
  memberName,
  className,
  size = 'sm',
}) => {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Clean up the blob URL
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current = null;
    }
    setPlaying(false);
  }, []);

  const playVoice = async () => {
    // If already playing, stop
    if (playing) {
      stopPlayback();
      return;
    }

    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(ERROR_MESSAGES.notAuthenticated);
      }

      const response = await fetch(API_ENDPOINTS.voice, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          text: text.substring(0, 4000), // Limit text length
          member_slug: memberSlug,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || ERROR_MESSAGES.voicePlaybackFailed);
      }

      if (!data.audio) {
        throw new Error('No audio data received');
      }

      // Convert base64 to audio blob
      const audioData = atob(data.audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Clean up any existing audio
      stopPlayback();

      // Create and play new audio
      audioRef.current = new Audio(audioUrl);
      
      audioRef.current.onended = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      
      audioRef.current.onerror = () => {
        setPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        toast.error('Audio playback failed');
      };

      await audioRef.current.play();
      setPlaying(true);
      
    } catch (err) {
      console.error('Voice playback error:', err);
      toast.error(err instanceof Error ? err.message : ERROR_MESSAGES.voicePlaybackFailed);
      stopPlayback();
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const buttonSize = size === 'sm' ? 'h-6 w-6 p-0' : size === 'lg' ? 'h-10 w-10 p-0' : 'h-8 w-8 p-0';

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(buttonSize, className)}
      onClick={playVoice}
      disabled={loading}
      title={playing ? `Stop ${memberName}` : `Listen to ${memberName}`}
    >
      {loading ? (
        <Loader2 className={cn(iconSize, 'animate-spin')} />
      ) : playing ? (
        <VolumeX className={cn(iconSize, 'text-primary')} />
      ) : (
        <Volume2 className={cn(iconSize, playing && 'text-primary')} />
      )}
    </Button>
  );
};

export default VoiceButton;