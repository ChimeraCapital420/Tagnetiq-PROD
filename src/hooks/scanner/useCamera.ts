// FILE: src/hooks/scanner/useCamera.ts
// Mobile-first camera lifecycle hook
// Automatically releases camera on unmount (battery optimization)

import { useState, useRef, useCallback, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface UseCameraOptions {
  /** Initial facing mode - 'environment' (back) or 'user' (front) */
  initialFacingMode?: 'user' | 'environment';
  /** Callback when camera error occurs */
  onError?: (error: Error) => void;
  /** Auto-start camera when hook mounts */
  autoStart?: boolean;
}

export interface UseCameraReturn {
  /** Ref to attach to video element */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Whether camera stream is active */
  isActive: boolean;
  /** Whether camera is initializing */
  isLoading: boolean;
  /** Available video input devices */
  devices: MediaDeviceInfo[];
  /** Currently selected device ID */
  selectedDeviceId: string | undefined;
  /** Current facing mode */
  facingMode: 'user' | 'environment';
  /** Any error that occurred */
  error: string | null;
  /** Start the camera stream */
  startCamera: () => Promise<void>;
  /** Stop the camera stream */
  stopCamera: () => void;
  /** Flip between front/back camera */
  flipCamera: () => Promise<void>;
  /** Select a specific device */
  selectDevice: (deviceId: string) => Promise<void>;
  /** Get current stream (for recording) */
  getStream: () => MediaStream | null;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Camera lifecycle hook - mobile optimized
 * 
 * Features:
 * - Automatic cleanup on unmount (critical for mobile battery)
 * - Device enumeration
 * - Flip camera support
 * - Error handling
 * 
 * @example
 * const camera = useCamera({ initialFacingMode: 'environment' });
 * 
 * useEffect(() => {
 *   if (isOpen) camera.startCamera();
 *   else camera.stopCamera();
 * }, [isOpen]);
 * 
 * return <video ref={camera.videoRef} autoPlay playsInline />;
 */
export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    initialFacingMode = 'environment',
    onError,
    autoStart = false,
  } = options;

  // State
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ==========================================================================
  // DEVICE ENUMERATION
  // ==========================================================================

  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      console.log(`📷 [CAMERA] Found ${videoDevices.length} video devices`);
      return videoDevices;
    } catch (err) {
      console.error('📷 [CAMERA] Failed to enumerate devices:', err);
      return [];
    }
  }, []);

  // Enumerate on mount
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // ==========================================================================
  // START CAMERA
  // ==========================================================================

  const startCamera = useCallback(async () => {
    console.log(`📷 [CAMERA] Starting camera...`);
    console.log(`📷 [CAMERA] Facing mode: ${facingMode}`);
    console.log(`📷 [CAMERA] Selected device: ${selectedDeviceId || 'auto'}`);

    setIsLoading(true);
    setError(null);

    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Build constraints
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { 
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
        audio: false,
      };

      console.log(`📷 [CAMERA] Requesting stream with constraints:`, constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          video.onloadedmetadata = () => {
            video.play()
              .then(() => {
                console.log(`📷 [CAMERA] Video playing: ${video.videoWidth}x${video.videoHeight}`);
                resolve();
              })
              .catch(reject);
          };
          
          video.onerror = () => reject(new Error('Video element error'));
          
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('Camera start timeout')), 5000);
        });
      }

      setIsActive(true);
      console.log(`📷 [CAMERA] ✅ Camera started successfully`);

      // Re-enumerate devices (may have more info after permission granted)
      await enumerateDevices();

    } catch (err: any) {
      console.error(`📷 [CAMERA] ❌ Failed to start:`, err);
      
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      onError?.(err);
      
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, selectedDeviceId, onError, enumerateDevices]);

  // ==========================================================================
  // STOP CAMERA
  // ==========================================================================

  const stopCamera = useCallback(() => {
    console.log(`📷 [CAMERA] Stopping camera...`);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`📷 [CAMERA] Stopped track: ${track.kind}`);
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    setError(null);
    console.log(`📷 [CAMERA] ✅ Camera stopped`);
  }, []);

  // ==========================================================================
  // FLIP CAMERA
  // ==========================================================================

  const flipCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    console.log(`📷 [CAMERA] Flipping to: ${newMode}`);
    
    setFacingMode(newMode);
    setSelectedDeviceId(undefined); // Clear device selection to use facing mode
    
    if (isActive) {
      stopCamera();
      // Small delay to ensure camera is fully released
      await new Promise(resolve => setTimeout(resolve, 100));
      await startCamera();
    }
  }, [facingMode, isActive, stopCamera, startCamera]);

  // ==========================================================================
  // SELECT DEVICE
  // ==========================================================================

  const selectDevice = useCallback(async (deviceId: string) => {
    console.log(`📷 [CAMERA] Selecting device: ${deviceId}`);
    setSelectedDeviceId(deviceId);
    
    if (isActive) {
      stopCamera();
      await new Promise(resolve => setTimeout(resolve, 100));
      await startCamera();
    }
  }, [isActive, stopCamera, startCamera]);

  // ==========================================================================
  // GET STREAM
  // ==========================================================================

  const getStream = useCallback(() => {
    return streamRef.current;
  }, []);

  // ==========================================================================
  // CLEANUP ON UNMOUNT - Critical for mobile battery!
  // ==========================================================================

  useEffect(() => {
    return () => {
      console.log(`📷 [CAMERA] Unmounting - cleaning up...`);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    videoRef,
    isActive,
    isLoading,
    devices,
    selectedDeviceId,
    facingMode,
    error,
    startCamera,
    stopCamera,
    flipCamera,
    selectDevice,
    getStream,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getErrorMessage(error: any): string {
  if (error.name === 'NotAllowedError') {
    return 'Camera permission denied. Please allow camera access.';
  }
  if (error.name === 'NotFoundError') {
    return 'No camera found on this device.';
  }
  if (error.name === 'NotReadableError') {
    return 'Camera is in use by another app.';
  }
  if (error.name === 'OverconstrainedError') {
    return 'Camera does not support requested settings.';
  }
  return error.message || 'Failed to access camera';
}

export default useCamera;