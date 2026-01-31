// FILE: src/hooks/scanner/useVideoRecording.ts
// Video recording hook with frame extraction
// Lazy loadable - only import when video mode is needed

import { useState, useRef, useCallback } from 'react';
import { compressImage, formatBytes } from '@/lib/scanner/compression';
import type { CapturedItem } from '@/types/scanner';

// =============================================================================
// TYPES
// =============================================================================

export interface UseVideoRecordingOptions {
  /** Get stream from camera hook */
  getStream: () => MediaStream | null;
  /** Callback when video is captured */
  onCapture: (item: Omit<CapturedItem, 'id' | 'selected'>) => void;
  /** Max recording duration in seconds */
  maxDuration?: number;
  /** Number of frames to extract for analysis */
  frameCount?: number;
  /** Video MIME type */
  mimeType?: string;
}

export interface UseVideoRecordingReturn {
  /** Start recording */
  startRecording: () => void;
  /** Stop recording and process */
  stopRecording: () => Promise<void>;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether processing video */
  isProcessing: boolean;
  /** Recording duration in seconds */
  duration: number;
  /** Recording error if any */
  error: string | null;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Video recording hook with automatic frame extraction
 * 
 * Features:
 * - Records from camera stream
 * - Extracts frames for AI analysis
 * - Generates thumbnail
 * - Compresses frames for API
 * - Max duration limit
 * 
 * @example
 * const video = useVideoRecording({
 *   getStream: camera.getStream,
 *   onCapture: (item) => setItems(prev => [...prev, item]),
 *   maxDuration: 15,
 * });
 * 
 * return (
 *   <button onClick={video.isRecording ? video.stopRecording : video.startRecording}>
 *     {video.isRecording ? `Stop (${video.duration}s)` : 'Record'}
 *   </button>
 * );
 */
export function useVideoRecording(options: UseVideoRecordingOptions): UseVideoRecordingReturn {
  const {
    getStream,
    onCapture,
    maxDuration = 30,
    frameCount = 5,
    mimeType = 'video/webm;codecs=vp9',
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // ==========================================================================
  // START RECORDING
  // ==========================================================================

  const startRecording = useCallback(() => {
    const stream = getStream();
    if (!stream) {
      setError('No camera stream available');
      console.error('🎬 [VIDEO] No stream available');
      return;
    }

    console.log(`🎬 [VIDEO] Starting recording...`);
    setError(null);
    chunksRef.current = [];

    try {
      // Check supported MIME types
      const supportedType = getSupportedMimeType();
      console.log(`🎬 [VIDEO] Using MIME type: ${supportedType}`);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`🎬 [VIDEO] Chunk received: ${formatBytes(event.data.size)}`);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('🎬 [VIDEO] Recording error:', event.error);
        setError(event.error?.message || 'Recording failed');
        setIsRecording(false);
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      // Update duration timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          console.log(`🎬 [VIDEO] Max duration reached (${maxDuration}s)`);
          stopRecording();
        }
      }, 1000);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }

      console.log(`🎬 [VIDEO] ✅ Recording started`);

    } catch (err: any) {
      console.error('🎬 [VIDEO] Failed to start:', err);
      setError(err.message || 'Failed to start recording');
    }
  }, [getStream, maxDuration]);

  // ==========================================================================
  // STOP RECORDING
  // ==========================================================================

  const stopRecording = useCallback(async () => {
    console.log(`🎬 [VIDEO] Stopping recording...`);

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    setIsProcessing(true);

    try {
      // Stop recording and wait for final data
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => resolve();
        mediaRecorder.stop();
      });

      setIsRecording(false);

      // Create video blob
      const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
      const videoBlobUrl = URL.createObjectURL(videoBlob);
      
      console.log(`🎬 [VIDEO] Video size: ${formatBytes(videoBlob.size)}`);

      // Extract frames for AI analysis
      console.log(`🎬 [VIDEO] Extracting ${frameCount} frames...`);
      const frames = await extractVideoFrames(videoBlob, frameCount);
      console.log(`🎬 [VIDEO] Extracted ${frames.length} frames`);

      // Generate thumbnail
      const thumbnail = frames[0] || await generateVideoThumbnail(videoBlob);

      // Compress frames for API
      const compressedFrames = await Promise.all(
        frames.map(frame => compressImage(frame, { maxSizeMB: 0.5 }))
      );

      // Create captured item
      const item: Omit<CapturedItem, 'id' | 'selected'> = {
        type: 'video',
        data: videoBlobUrl,
        thumbnail,
        name: `Video ${new Date().toLocaleTimeString()}`,
        metadata: {
          videoFrames: compressedFrames.map(f => f.compressed),
          originalSize: videoBlob.size,
        },
      };

      console.log(`🎬 [VIDEO] ✅ Video captured successfully`);
      onCapture(item);

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

    } catch (err: any) {
      console.error('🎬 [VIDEO] Processing failed:', err);
      setError(err.message || 'Failed to process video');
    } finally {
      setIsProcessing(false);
      mediaRecorderRef.current = null;
      chunksRef.current = [];
    }
  }, [frameCount, onCapture]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    isProcessing,
    duration,
    error,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get supported video MIME type
 */
function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm'; // Fallback
}

/**
 * Extract frames from video at even intervals
 */
async function extractVideoFrames(videoBlob: Blob, count: number): Promise<string[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(videoBlob);
    const frames: string[] = [];
    
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'metadata';

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1);
      
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(video.videoWidth || 1280, 1280);
      canvas.height = Math.min(video.videoHeight || 720, 720);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(videoUrl);
        resolve([]);
        return;
      }

      for (let i = 1; i <= count; i++) {
        const time = interval * i;
        
        await new Promise<void>((seekResolve) => {
          video.onseeked = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.8));
            seekResolve();
          };
          video.currentTime = time;
        });
      }

      URL.revokeObjectURL(videoUrl);
      resolve(frames);
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      resolve([]);
    };

    video.load();
  });
}

/**
 * Generate thumbnail from video
 */
async function generateVideoThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(videoBlob);
    
    video.src = videoUrl;
    video.muted = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = Math.floor(200 * (video.videoHeight / video.videoWidth));
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(videoUrl);
        resolve(thumbnail);
      } else {
        URL.revokeObjectURL(videoUrl);
        reject(new Error('Could not get canvas context'));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Failed to load video'));
    };

    video.load();
  });
}

export default useVideoRecording;