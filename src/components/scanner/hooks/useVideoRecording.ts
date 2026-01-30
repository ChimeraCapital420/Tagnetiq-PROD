// FILE: src/components/scanner/hooks/useVideoRecording.ts
// Video recording and frame extraction

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface VideoRecordingResult {
  blob: Blob;
  thumbnail: string;
  frames: string[];
  duration: number;
}

export interface UseVideoRecordingOptions {
  mimeType?: string;
  frameCount?: number;
}

export interface UseVideoRecordingReturn {
  isRecording: boolean;
  duration: number;
  
  startRecording: (stream: MediaStream) => void;
  stopRecording: () => Promise<VideoRecordingResult | null>;
  
  extractFrames: (videoBlob: Blob, count?: number) => Promise<string[]>;
  generateThumbnail: (videoBlob: Blob) => Promise<string>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useVideoRecording(
  options: UseVideoRecordingOptions = {}
): UseVideoRecordingReturn {
  const { mimeType = 'video/webm;codecs=vp9', frameCount = 5 } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================
  // RECORDING CONTROL
  // ========================================

  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) {
      toast.error('No stream available for recording');
      return;
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      setDuration(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);

      // Update duration display
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      toast.info('Recording started');
    } catch (error) {
      console.error('Recording start error:', error);
      toast.error('Failed to start recording');
    }
  }, [mimeType]);

  const stopRecording = useCallback(async (): Promise<VideoRecordingResult | null> => {
    if (!mediaRecorderRef.current || !isRecording) return null;

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        // Clear duration interval
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        try {
          const thumbnail = await generateThumbnail(blob);
          const frames = await extractFrames(blob, frameCount);

          setIsRecording(false);
          setDuration(0);

          resolve({
            blob,
            thumbnail,
            frames,
            duration: finalDuration,
          });
        } catch (error) {
          console.error('Video processing error:', error);
          setIsRecording(false);
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  }, [isRecording, frameCount]);

  // ========================================
  // FRAME EXTRACTION
  // ========================================

  const extractFrames = useCallback(async (
    videoBlob: Blob,
    count: number = frameCount
  ): Promise<string[]> => {
    return new Promise((resolve) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';

      const frames: string[] = [];
      let currentFrame = 0;

      video.onloadedmetadata = () => {
        const interval = video.duration / count;

        const extractNext = () => {
          if (currentFrame >= count) {
            URL.revokeObjectURL(videoUrl);
            resolve(frames);
            return;
          }

          video.currentTime = Math.max(0.1, interval * currentFrame);
        };

        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(video.videoWidth, 1280);
          canvas.height = Math.min(video.videoHeight, 720);
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.8));
          }

          currentFrame++;
          extractNext();
        };

        extractNext();
      };

      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        resolve([]);
      };

      video.load();
    });
  }, [frameCount]);

  const generateThumbnail = useCallback(async (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const videoUrl = URL.createObjectURL(videoBlob);
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        video.currentTime = Math.max(0.1, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 400);
        canvas.height = Math.min(video.videoHeight, 300);
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(videoUrl);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Video loading failed'));
      };

      video.load();
    });
  }, []);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    extractFrames,
    generateThumbnail,
  };
}

export default useVideoRecording;