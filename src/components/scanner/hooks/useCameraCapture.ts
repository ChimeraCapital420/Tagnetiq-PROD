// FILE: src/components/scanner/hooks/useCameraCapture.ts
// Camera stream management and image capture

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface CameraDevice {
  deviceId: string;
  label: string;
  isRearCamera: boolean;
}

export interface UseCameraCaptureOptions {
  autoStart?: boolean;
  preferRearCamera?: boolean;
}

export interface UseCameraCaptureReturn {
  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  
  // State
  isReady: boolean;
  isCapturing: boolean;
  devices: CameraDevice[];
  currentDeviceId: string | undefined;
  
  // Actions
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  captureFrame: () => Promise<string | null>;
  
  // Manual focus (where supported)
  triggerFocus: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useCameraCapture(
  options: UseCameraCaptureOptions = {}
): UseCameraCaptureReturn {
  const { autoStart = false, preferRearCamera = true } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMountedRef = useRef(true);
  const hasEnumeratedRef = useRef(false); // Prevent multiple enumerations

  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>();

  // ========================================
  // DEVICE ENUMERATION
  // ========================================

  const enumerateDevices = useCallback(async () => {
    // Only enumerate once to prevent loops
    if (hasEnumeratedRef.current) {
      return devices;
    }
    
    try {
      // Try to enumerate without requesting permission first
      let allDevices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      
      // If we don't have labels, we need permission
      const needsPermission = videoDevices.some(d => !d.label);
      
      if (needsPermission && videoDevices.length > 0) {
        // Request minimal permission just to get labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Immediately stop - we just needed permission
        tempStream.getTracks().forEach(track => track.stop());
        
        // Re-enumerate with permission granted
        allDevices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      }
      
      const mappedDevices = videoDevices.map(d => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
        isRearCamera: d.label.toLowerCase().includes('back') || 
                      d.label.toLowerCase().includes('rear') ||
                      d.label.toLowerCase().includes('environment'),
      }));
      
      if (isMountedRef.current) {
        setDevices(mappedDevices);
        hasEnumeratedRef.current = true;
        
        // Select initial device if not set
        if (!currentDeviceId && mappedDevices.length > 0) {
          const preferred = preferRearCamera
            ? mappedDevices.find(d => d.isRearCamera)
            : mappedDevices.find(d => !d.isRearCamera);
          setCurrentDeviceId(preferred?.deviceId || mappedDevices[0].deviceId);
        }
      }
      
      return mappedDevices;
    } catch (error) {
      console.error('📷 [CAPTURE] Failed to enumerate devices:', error);
      return [];
    }
  }, [currentDeviceId, preferRearCamera, devices]);

  // ========================================
  // CAMERA CONTROL
  // ========================================

  const stopCamera = useCallback(() => {
    // Guard: Nothing to stop
    if (!streamRef.current) {
      return;
    }
    
    console.log('📷 [CAPTURE] Stopping camera...');
    streamRef.current.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    
    if (isMountedRef.current) {
      setIsReady(false);
    }
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    if (!isMountedRef.current) return;
    
    // Stop existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const targetDeviceId = deviceId || currentDeviceId;
    console.log('📷 [CAPTURE] Starting camera...', targetDeviceId || 'auto');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: preferRearCamera ? 'environment' : 'user',
        },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (targetDeviceId && isMountedRef.current) {
        setCurrentDeviceId(targetDeviceId);
      }
      
      if (isMountedRef.current) {
        setIsReady(true);
        console.log('📷 [CAPTURE] ✅ Camera ready');
      }
    } catch (error) {
      console.error('📷 [CAPTURE] Camera start error:', error);
      toast.error('Camera access denied', {
        description: 'Please enable camera permissions in your browser settings.',
      });
      throw error;
    }
  }, [currentDeviceId, preferRearCamera]);

  const switchCamera = useCallback(() => {
    if (devices.length <= 1) {
      toast.info('No other camera available');
      return;
    }

    const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDevice = devices[nextIndex];

    startCamera(nextDevice.deviceId);
  }, [devices, currentDeviceId, startCamera]);

  // ========================================
  // CAPTURE
  // ========================================

  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !isReady) {
      toast.error('Camera not ready');
      return null;
    }

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      
      // Create or reuse canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(video, 0, 0);
      
      // Return full-quality capture
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture image');
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  }, [isReady]);

  // ========================================
  // FOCUS (where supported)
  // ========================================

  const triggerFocus = useCallback(() => {
    if (!streamRef.current) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    // Check if focus is supported
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] };
    if (capabilities?.focusMode?.includes('manual')) {
      track.applyConstraints?.({
        advanced: [{ focusMode: 'manual' } as any],
      });
      
      // Reset to continuous after a moment
      setTimeout(() => {
        track.applyConstraints?.({
          advanced: [{ focusMode: 'continuous' } as any],
        });
      }, 500);
    }
  }, []);

  // ========================================
  // LIFECYCLE
  // ========================================

  // Track mount state and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Enumerate devices once on mount
  useEffect(() => {
    enumerateDevices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start if requested (separate effect, runs once)
  useEffect(() => {
    if (autoStart && !isReady) {
      // Small delay to ensure devices are enumerated
      const timer = setTimeout(() => {
        if (isMountedRef.current && !streamRef.current) {
          startCamera();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    videoRef,
    isReady,
    isCapturing,
    devices,
    currentDeviceId,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
    triggerFocus,
  };
}

export default useCameraCapture;