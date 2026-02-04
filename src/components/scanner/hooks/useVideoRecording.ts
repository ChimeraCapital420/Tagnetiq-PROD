// FILE: src/components/scanner/hooks/useVideoRecording.ts
// Video recording hook with frame extraction for analysis
// Mobile-first: Extracts key frames instead of uploading full video

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { compressImage } from '../utils/compression';

export interface VideoRecordingResult {
  videoBlob: Blob;
  videoUrl: string;
  thumbnail: string;
  frames: string[];
  duration: number;
}

export interface UseVideoRecordingReturn {
  isRecording: boolean;
  duration: number;
  startRecording: (stream: MediaStream) => void;
  stopRecording: () => Promise<VideoRecordingResult | null>;
}

export function useVideoRecording(): UseVideoRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ==========================================================================
  // START RECORDING
  // ==========================================================================
  const startRecording = useCallback((stream: MediaStream) => {
    if (!stream) {
      toast.error('No camera stream available');
      return;
    }

    try {
      // Determine best supported codec
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Update duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      toast.info('Recording...');
      
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }

    } catch (error) {
      console.error('[VIDEO] Recording error:', error);
      toast.error('Failed to start recording');
    }
  }, []);

  // ==========================================================================
  // STOP RECORDING
  // ==========================================================================
  const stopRecording = useCallback((): Promise<VideoRecordingResult | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      // Clear duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(videoBlob);
        const recordedDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

        try {
          // Extract frames for AI analysis
          const frames = await extractVideoFrames(videoBlob, 5);
          const thumbnail = frames[0] || await generateThumbnail(videoBlob);

          // Compress frames for upload
          const compressedFrames = await Promise.all(
            frames.map(async (frame) => {
              const result = await compressImage(frame, { maxWidth: 1280, quality: 0.8 });
              return result.compressed;
            })
          );

          toast.success('Video recorded!');
          
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate([50, 30, 50]);
          }

          resolve({
            videoBlob,
            videoUrl,
            thumbnail,
            frames: compressedFrames,
            duration: recordedDuration,
          });

        } catch (error) {
          console.error('[VIDEO] Processing error:', error);
          resolve(null);
        }

        setIsRecording(false);
        setDuration(0);
      };

      mediaRecorder.stop();
    });
  }, [isRecording]);

  return {
    isRecording,
    duration,
    startRecording,
    stopRecording,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function extractVideoFrames(videoBlob: Blob, frameCount: number = 5): Promise<string[]> {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const tempVideo = document.createElement('video');
    tempVideo.src = videoUrl;
    tempVideo.muted = true;
    tempVideo.preload = 'metadata';

    const frames: string[] = [];
    let currentFrame = 0;

    tempVideo.onloadedmetadata = () => {
      const interval = tempVideo.duration / frameCount;
      
      const extractFrame = () => {
        if (currentFrame >= frameCount) {
          URL.revokeObjectURL(videoUrl);
          resolve(frames);
          return;
        }
        tempVideo.currentTime = Math.max(0.1, interval * currentFrame);
      };

      tempVideo.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 640;
        canvas.height = tempVideo.videoHeight || 480;
        const context = canvas.getContext('2d');
        
        if (context) {
          context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.85));
        }
        
        currentFrame++;
        extractFrame();
      };

      extractFrame();
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      resolve([]);
    };

    tempVideo.load();
  });
}

async function generateThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const tempVideo = document.createElement('video');
    tempVideo.src = videoUrl;
    tempVideo.muted = true;
    tempVideo.preload = 'metadata';

    tempVideo.onloadedmetadata = () => {
      tempVideo.currentTime = Math.max(0.1, tempVideo.duration / 2);
    };

    tempVideo.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = tempVideo.videoWidth || 320;
      canvas.height = tempVideo.videoHeight || 240;
      const context = canvas.getContext('2d');
      
      if (context) {
        context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(videoUrl);
        resolve(thumbnail);
      } else {
        reject(new Error('Could not generate thumbnail'));
      }
    };

    tempVideo.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Video loading failed'));
    };

    tempVideo.load();
  });
}

export default useVideoRecording;