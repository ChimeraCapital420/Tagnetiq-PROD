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
  videoRef: React.RefObject<HTMLVideoElement | null>;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const isStoppingRef = useRef(false); // Prevent concurrent stops

  // ==========================================================================
  // DEVICE ENUMERATION
  // ==========================================================================

  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      if (isMountedRef.current) {
        setDevices(videoDevices);
      }
      return videoDevices;
    } catch (err) {
      console.error('📷 [CAMERA] Failed to enumerate devices:', err);
      return [];
    }
  }, []);

  // Enumerate on mount (once only)
  useEffect(() => {
    enumerateDevices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // START CAMERA
  // ==========================================================================

  const startCamera = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isStoppingRef.current) return; // Don't start while stopping
    
    console.log(`📷 [CAMERA] Starting (facing: ${facingMode}, device: ${selectedDeviceId || 'auto'})`);
    
    setIsLoading(true);
    setError(null);

    try {
      // Stop any existing stream first (silently)
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

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!isMountedRef.current) {
        // Component unmounted while waiting for camera
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;

      // Attach to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          const timeoutId = setTimeout(() => reject(new Error('Camera start timeout')), 5000);
          
          video.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            video.play()
              .then(() => {
                console.log(`📷 [CAMERA] ✅ Active: ${video.videoWidth}x${video.videoHeight}`);
                resolve();
              })
              .catch(reject);
          };
          
          video.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error('Video element error'));
          };
        });
      }

      if (isMountedRef.current) {
        setIsActive(true);
        // Re-enumerate to get full device labels after permission
        await enumerateDevices();
      }

    } catch (err: unknown) {
      console.error(`📷 [CAMERA] ❌ Start failed:`, err);
      
      if (isMountedRef.current) {
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        if (err instanceof Error) {
          onError?.(err);
        }
      }
      
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [facingMode, selectedDeviceId, onError, enumerateDevices]);

  // ==========================================================================
  // STOP CAMERA
  // ==========================================================================

  const stopCamera = useCallback(() => {
    // Guard 1: Nothing to stop
    if (!streamRef.current) {
      return;
    }
    
    // Guard 2: Already stopping
    if (isStoppingRef.current) {
      return;
    }
    
    isStoppingRef.current = true;
    console.log(`📷 [CAMERA] Stopping...`);

    try {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (isMountedRef.current) {
        setIsActive(false);
        setError(null);
      }
      
      console.log(`📷 [CAMERA] ✅ Stopped`);
    } finally {
      isStoppingRef.current = false;
    }
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

  const getStream = useCallback(() => streamRef.current, []);

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Silent cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Auto-start if requested (only once)
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
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
    return error.message;
  }
  return 'Failed to access camera';
}

export default useCamera;