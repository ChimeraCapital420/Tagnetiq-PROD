// FILE: src/components/scanner/hooks/useCameraStream.ts
// Camera stream management hook
// v3.4: FIX — startCamera() is now truly idempotent
//   If a live stream already exists (and no different device requested), skip entirely.
//   This prevents black screen regardless of how many times startCamera is called.
// v3.3: FIX — orphaned permission stream, explicit play(), concurrent guard
// v3.2: Accepts optional haptics — replaces all inline navigator.vibrate() calls
// FIXED: Module-level logging to prevent spam across component lifecycles
// Mobile-first: Prefers rear camera, optimized constraints

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { CameraCapabilities, CameraSettings } from '../types';
import type { UseHealingHapticsReturn } from './useHealingHaptics';

// =============================================================================
// MODULE-LEVEL LOGGING CONTROL
// Persists across component mounts/unmounts to prevent spam
// =============================================================================
const loggedStreamIds = new Set<string>();
const loggedCapabilityIds = new Set<string>();

function getStreamId(stream: MediaStream | null): string {
  if (!stream) return 'null';
  const tracks = stream.getVideoTracks();
  return tracks.length > 0 ? tracks[0].id : 'no-track';
}

// =============================================================================
// TYPES
// =============================================================================
export interface UseCameraStreamOptions {
  /** Whether to include audio (video mode) */
  includeAudio?: boolean;
  /** Healing haptics hook return (optional — degrades gracefully) */
  haptics?: UseHealingHapticsReturn;
}

export interface UseCameraStreamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  isActive: boolean;
  devices: MediaDeviceInfo[];
  currentDeviceId: string | undefined;
  capabilities: CameraCapabilities;
  settings: CameraSettings;

  // Actions
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => void;
  setTorch: (enabled: boolean) => Promise<void>;
  setZoom: (level: number) => Promise<void>;
  triggerFocus: () => void;
}

const DEFAULT_CAPABILITIES: CameraCapabilities = {
  torch: false,
  zoom: null,
  focusMode: [],
  exposureMode: [],
  whiteBalanceMode: [],
};

const DEFAULT_SETTINGS: CameraSettings = {
  torch: false,
  zoom: 1,
  focusMode: 'continuous',
  exposureMode: 'continuous',
  whiteBalanceMode: 'continuous',
};

export function useCameraStream(
  options: UseCameraStreamOptions = {}
): UseCameraStreamReturn {
  const { includeAudio = false, haptics } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false); // Prevent concurrent starts

  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(
    undefined
  );
  const [capabilities, setCapabilities] =
    useState<CameraCapabilities>(DEFAULT_CAPABILITIES);
  const [settings, setSettings] = useState<CameraSettings>(DEFAULT_SETTINGS);

  // ==========================================================================
  // DETECT CAMERA CAPABILITIES (with logging control)
  // ==========================================================================
  const detectCapabilities = useCallback((track: MediaStreamTrack) => {
    const trackId = track.id;

    // Already logged this track? Skip
    if (loggedCapabilityIds.has(trackId)) {
      return;
    }

    try {
      const caps = track.getCapabilities?.() as any;
      if (!caps) return;

      const detected: CameraCapabilities = {
        torch: !!caps.torch,
        zoom: caps.zoom
          ? {
              min: caps.zoom.min || 1,
              max: caps.zoom.max || 1,
              step: caps.zoom.step || 0.1,
            }
          : null,
        focusMode: caps.focusMode || [],
        exposureMode: caps.exposureMode || [],
        whiteBalanceMode: caps.whiteBalanceMode || [],
      };

      // Log ONCE per track - add to set FIRST
      loggedCapabilityIds.add(trackId);
      console.log('📷 [CAMERA] Capabilities detected:', {
        trackId: trackId.slice(0, 8),
        torch: detected.torch,
        zoom: detected.zoom
          ? `${detected.zoom.min}-${detected.zoom.max}x`
          : 'No',
        focusModes: detected.focusMode.join(', ') || 'None',
      });

      setCapabilities(detected);
    } catch (error) {
      console.error('[CAMERA] Error detecting capabilities:', error);
    }
  }, []);

  // ==========================================================================
  // ENUMERATE DEVICES
  // ==========================================================================
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error('[CAMERA] Error enumerating devices:', error);
      return [];
    }
  }, []);

  // ==========================================================================
  // START CAMERA
  //
  // v3.4 FIX: IDEMPOTENT — if a live stream already exists and no specific
  //   device was requested, skip entirely. This is the nuclear fix for the
  //   double-start problem. No matter HOW MANY times startCamera is called
  //   (useEffect re-fires, external components, React Strict Mode, etc.),
  //   it will only create ONE stream.
  //
  // v3.3 FIX: Permission stream stopped immediately after enumeration.
  // v3.3 FIX: Explicit play() after srcObject assignment.
  // v3.3 FIX: isStartingRef prevents truly concurrent calls.
  // ==========================================================================
  const startCamera = useCallback(
    async (deviceId?: string) => {
      // ================================================================
      // IDEMPOTENCY CHECK — skip if already have a live stream
      // Only create a new stream if:
      //   (a) No stream exists at all, OR
      //   (b) A specific different device was requested (switchCamera)
      // ================================================================
      if (streamRef.current && !deviceId) {
        const existingTracks = streamRef.current.getVideoTracks();
        if (existingTracks.length > 0 && existingTracks[0].readyState === 'live') {
          // Stream is already live — just make sure video element is connected
          if (videoRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            try { await videoRef.current.play(); } catch { /* deferred */ }
          }
          console.log('📷 [CAMERA] Stream already live, skipping restart');
          return;
        }
      }

      // Prevent concurrent starts — second call is a no-op until first completes
      if (isStartingRef.current) {
        console.log('📷 [CAMERA] Start already in progress, skipping');
        return;
      }
      isStartingRef.current = true;

      // Stop any existing stream (dead or wrong device)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        // Get available devices first
        let videoDevices = devices;
        if (videoDevices.length === 0) {
          // Need initial permission to enumerate — request then STOP immediately
          // v3.3 FIX: This was the orphaned stream causing black screen
          const permissionStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          // Stop IMMEDIATELY — we only needed this for permission, not the stream
          permissionStream.getTracks().forEach((track) => track.stop());

          videoDevices = await enumerateDevices();
        }

        // Select device - prefer rear camera if no device specified
        let selectedDeviceId = deviceId;
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          selectedDeviceId =
            rearCamera?.deviceId || videoDevices[0].deviceId;
        }

        // Request stream with optimal constraints for mobile
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedDeviceId
              ? { exact: selectedDeviceId }
              : undefined,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: selectedDeviceId ? undefined : 'environment',
          },
          audio: includeAudio
            ? {
                echoCancellation: true,
                noiseSuppression: true,
              }
            : false,
        });

        streamRef.current = stream;
        setCurrentDeviceId(selectedDeviceId);
        setIsActive(true);

        // Connect to video element + explicit play()
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            // play() can reject if user hasn't interacted yet — that's fine,
            // autoPlay attribute will take over when they tap anything
            console.log('📷 [CAMERA] Auto-play deferred (user interaction required)');
          }
        }

        // Detect capabilities (will only log once per track)
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          detectCapabilities(videoTrack);
        }

        // Log stream start ONCE
        const streamId = getStreamId(stream);
        if (!loggedStreamIds.has(streamId)) {
          loggedStreamIds.add(streamId);
          console.log('📷 [CAMERA] Stream started:', {
            streamId: streamId.slice(0, 8),
            deviceId: selectedDeviceId?.slice(0, 8),
          });
        }
      } catch (error) {
        console.error('[CAMERA] Error starting camera:', error);
        toast.error('Camera access denied');
        setIsActive(false);
      } finally {
        // Always release the lock, even on error
        isStartingRef.current = false;
      }
    },
    [devices, enumerateDevices, detectCapabilities, includeAudio]
  );

  // ==========================================================================
  // STOP CAMERA
  // ==========================================================================
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setCapabilities(DEFAULT_CAPABILITIES);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // ==========================================================================
  // SWITCH CAMERA — haptics-aware
  // ==========================================================================
  const switchCamera = useCallback(() => {
    if (devices.length <= 1) {
      toast.info('No other camera available');
      return;
    }

    const currentIndex = devices.findIndex(
      (d) => d.deviceId === currentDeviceId
    );
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextDeviceId = devices[nextIndex].deviceId;

    startCamera(nextDeviceId);

    // Haptic feedback — use hook if available, fallback to inline
    if (haptics) {
      haptics.tap();
    } else if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, [devices, currentDeviceId, startCamera, haptics]);

  // ==========================================================================
  // TORCH CONTROL — haptics-aware
  // ==========================================================================
  const setTorch = useCallback(
    async (enabled: boolean) => {
      if (!capabilities.torch) {
        toast.info('Flashlight not available');
        return;
      }

      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;

      try {
        await track.applyConstraints({
          advanced: [{ torch: enabled } as any],
        });
        setSettings((prev) => ({ ...prev, torch: enabled }));

        // Haptic feedback — use hook if available, fallback to inline
        if (haptics) {
          haptics.tap();
        } else if ('vibrate' in navigator) {
          navigator.vibrate(30);
        }
      } catch (error) {
        console.error('[CAMERA] Torch error:', error);
        toast.error('Failed to toggle flashlight');
      }
    },
    [capabilities.torch, haptics]
  );

  // ==========================================================================
  // ZOOM CONTROL
  // ==========================================================================
  const setZoom = useCallback(
    async (level: number) => {
      if (!capabilities.zoom) {
        return;
      }

      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;

      const clampedLevel = Math.min(
        capabilities.zoom.max,
        Math.max(capabilities.zoom.min, level)
      );

      try {
        await track.applyConstraints({
          advanced: [{ zoom: clampedLevel } as any],
        });
        setSettings((prev) => ({ ...prev, zoom: clampedLevel }));
      } catch (error) {
        console.error('[CAMERA] Zoom error:', error);
      }
    },
    [capabilities.zoom]
  );

  // ==========================================================================
  // FOCUS TRIGGER — haptics-aware
  // ==========================================================================
  const triggerFocus = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    if (capabilities.focusMode.includes('single-shot')) {
      track
        .applyConstraints({
          advanced: [{ focusMode: 'single-shot' } as any],
        })
        .catch(() => {});

      toast.info('Focusing...');
    } else {
      toast.info('Auto-focus triggered');
    }

    // Haptic feedback — use hook if available, fallback to inline
    if (haptics) {
      haptics.tap();
    } else if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, [capabilities.focusMode, haptics]);

  // ==========================================================================
  // CLEANUP
  // ==========================================================================
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    stream: streamRef.current,
    isActive,
    devices,
    currentDeviceId,
    capabilities,
    settings,
    startCamera,
    stopCamera,
    switchCamera,
    setTorch,
    setZoom,
    triggerFocus,
  };
}

export default useCameraStream;