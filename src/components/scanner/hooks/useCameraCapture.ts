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
  videoRef: React.RefObject<HTMLVideoElement>;
  
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>();

  // ========================================
  // DEVICE ENUMERATION
  // ========================================

  const enumerateDevices = useCallback(async () => {
    try {
      // Need to request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(d => d.kind === 'videoinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
          isRearCamera: d.label.toLowerCase().includes('back') || 
                        d.label.toLowerCase().includes('rear') ||
                        d.label.toLowerCase().includes('environment'),
        }));
      
      setDevices(videoDevices);
      
      // Select initial device
      if (!currentDeviceId && videoDevices.length > 0) {
        const preferred = preferRearCamera
          ? videoDevices.find(d => d.isRearCamera)
          : videoDevices.find(d => !d.isRearCamera);
        setCurrentDeviceId(preferred?.deviceId || videoDevices[0].deviceId);
      }
      
      return videoDevices;
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      toast.error('Could not access camera devices');
      return [];
    }
  }, [currentDeviceId, preferRearCamera]);

  // ========================================
  // CAMERA CONTROL
  // ========================================

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();

    const targetDeviceId = deviceId || currentDeviceId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: preferRearCamera ? 'environment' : 'user',
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (targetDeviceId) {
        setCurrentDeviceId(targetDeviceId);
      }
      
      setIsReady(true);
    } catch (error) {
      console.error('Camera start error:', error);
      toast.error('Camera access denied', {
        description: 'Please enable camera permissions in your browser settings.',
      });
      throw error;
    }
  }, [currentDeviceId, preferRearCamera, stopCamera]);

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
      
      // Return full-quality capture (compression happens in ImageStorageService)
      return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture image');
      return null;
    } finally {
      setIsCapturing(false);
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
    const capabilities = track.getCapabilities?.() as any;
    if (capabilities?.focusMode?.includes('manual')) {
      track.applyConstraints?.({
        advanced: [{ focusMode: 'manual' }],
      } as any);
      
      // Reset to continuous after a moment
      setTimeout(() => {
        track.applyConstraints?.({
          advanced: [{ focusMode: 'continuous' }],
        } as any);
      }, 500);
      
      toast.info('Focusing...');
    }
  }, []);

  // ========================================
  // LIFECYCLE
  // ========================================

  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  useEffect(() => {
    if (autoStart && devices.length > 0) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [autoStart, devices.length]); // eslint-disable-line react-hooks/exhaustive-deps

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