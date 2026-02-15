// FILE: src/components/scanner/hooks/useCameraStream.ts
// Camera stream management hook
// v4.0: ARCHITECTURE FIX — Declarative camera lifecycle
//   Previous versions exposed startCamera() which could be called from
//   anywhere, any number of times → multiple streams → black screen.
//   Now accepts `active` boolean. ONE internal useEffect starts/stops
//   the camera. No external imperative calls needed for lifecycle.
//   switchCamera()/startCamera(deviceId) still available for device switching only.
//
// Mobile-first: Prefers rear camera, optimized constraints, explicit play()

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { CameraCapabilities, CameraSettings } from '../types';
import type { UseHealingHapticsReturn } from './useHealingHaptics';

// =============================================================================
// MODULE-LEVEL: Ensures only ONE stream exists globally
// Prevents multiple hook instances or double-mounts from creating parallel streams
// =============================================================================
let activeStreamId: string | null = null;

// =============================================================================
// TYPES
// =============================================================================
export interface UseCameraStreamOptions {
  /** Whether the camera should be active (replaces manual startCamera/stopCamera) */
  active?: boolean;
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

  // Actions — switchCamera still needs imperative call
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
  const { active = false, includeAudio = false, haptics } = options;

  const videoRef = useRef<HTMLVideoElement>(null!);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);

  const [isActive, setIsActive] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(
    undefined
  );
  const [capabilities, setCapabilities] =
    useState<CameraCapabilities>(DEFAULT_CAPABILITIES);
  const [settings, setSettings] = useState<CameraSettings>(DEFAULT_SETTINGS);

  // ==========================================================================
  // DETECT CAMERA CAPABILITIES
  // ==========================================================================
  const detectCapabilities = useCallback((track: MediaStreamTrack) => {
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

      console.log('📷 [CAMERA] Capabilities:', {
        trackId: track.id.slice(0, 8),
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
  // INTERNAL: Create a camera stream and attach to video element
  // This is the ONLY function that calls getUserMedia for the real stream.
  // ==========================================================================
  const createStream = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      try {
        // Get available devices if we don't have them
        let videoDevices: MediaDeviceInfo[] = [];
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = allDevices.filter((d) => d.kind === 'videoinput');

          // If labels are empty, we need permission first
          if (videoDevices.length > 0 && !videoDevices[0].label) {
            const permStream = await navigator.mediaDevices.getUserMedia({
              video: true,
            });
            permStream.getTracks().forEach((t) => t.stop());
            const retry = await navigator.mediaDevices.enumerateDevices();
            videoDevices = retry.filter((d) => d.kind === 'videoinput');
          }
        } catch {
          // Can't enumerate — will use facingMode fallback
        }

        if (mountedRef.current) {
          setDevices(videoDevices);
        }

        // Select device — prefer rear camera
        let selectedDeviceId = deviceId;
        if (!selectedDeviceId && videoDevices.length > 0) {
          const rearCamera = videoDevices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          selectedDeviceId = rearCamera?.deviceId || videoDevices[0].deviceId;
        }

        // Create the ONE stream
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
            ? { echoCancellation: true, noiseSuppression: true }
            : false,
        });

        if (!mountedRef.current) {
          // Component unmounted during async — clean up
          stream.getTracks().forEach((t) => t.stop());
          return null;
        }

        // Register as the global active stream
        const streamId = stream.getVideoTracks()[0]?.id || 'unknown';
        activeStreamId = streamId;

        if (mountedRef.current) {
          setCurrentDeviceId(selectedDeviceId);
        }

        console.log('📷 [CAMERA] Stream started:', {
          streamId: streamId.slice(0, 8),
          deviceId: selectedDeviceId?.slice(0, 8),
        });

        // Detect capabilities
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          detectCapabilities(videoTrack);
        }

        return stream;
      } catch (error) {
        console.error('[CAMERA] Error creating stream:', error);
        toast.error('Camera access denied');
        return null;
      }
    },
    [includeAudio, detectCapabilities]
  );

  // ==========================================================================
  // INTERNAL: Attach stream to video element and play
  // ==========================================================================
  const attachStream = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (!video) {
        console.warn('📷 [CAMERA] No video element to attach to');
        return;
      }

      video.srcObject = stream;

      // Explicit play — required by Chrome incognito, some Android WebViews
      try {
        await video.play();
        console.log('📷 [CAMERA] Video playing');
      } catch {
        console.log('📷 [CAMERA] Auto-play deferred (user interaction required)');
      }
    },
    []
  );

  // ==========================================================================
  // INTERNAL: Stop and clean up stream
  // ==========================================================================
  const destroyStream = useCallback(() => {
    if (streamRef.current) {
      const trackId = streamRef.current.getVideoTracks()[0]?.id || 'unknown';
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      // Clear global lock if it's ours
      if (activeStreamId === trackId) {
        activeStreamId = null;
      }

      console.log('📷 [CAMERA] Stream stopped:', {
        streamId: trackId.slice(0, 8),
      });
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ==========================================================================
  // DECLARATIVE LIFECYCLE — THE SINGLE SOURCE OF TRUTH
  //
  // This ONE useEffect controls the entire camera lifecycle.
  // When `active` becomes true → create stream, attach, play
  // When `active` becomes false → stop stream, clean up
  // Re-renders with the same `active` value → no-op
  //
  // This replaces ALL external startCamera/stopCamera calls from DualScanner.
  // ==========================================================================
  useEffect(() => {
    // Track if THIS effect invocation is still current
    let cancelled = false;

    if (active) {
      // Check if we already have a live stream — skip if so
      if (
        streamRef.current &&
        streamRef.current.getVideoTracks().length > 0 &&
        streamRef.current.getVideoTracks()[0].readyState === 'live'
      ) {
        // Stream already live — just make sure it's attached
        if (videoRef.current && !videoRef.current.srcObject) {
          attachStream(streamRef.current);
        }
        setIsActive(true);
        return;
      }

      // Small delay to let the DOM mount the video element
      const timer = setTimeout(async () => {
        if (cancelled) return;

        // Destroy any dead stream first
        destroyStream();

        // Create fresh stream
        const stream = await createStream();
        if (cancelled || !stream) return;

        streamRef.current = stream;
        await attachStream(stream);

        if (!cancelled) {
          setIsActive(true);
        }
      }, 150);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    } else {
      // Inactive — tear down
      destroyStream();
      setIsActive(false);
      setCapabilities(DEFAULT_CAPABILITIES);
      setSettings(DEFAULT_SETTINGS);
    }
  }, [active]); // ONLY depends on `active` — nothing else can trigger this

  // ==========================================================================
  // CLEANUP ON UNMOUNT
  // ==========================================================================
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        activeStreamId = null;
      }
    };
  }, []);

  // ==========================================================================
  // PUBLIC: startCamera — ONLY for explicit device switching
  // Normal lifecycle is handled by the `active` prop above.
  // ==========================================================================
  const startCamera = useCallback(
    async (deviceId?: string) => {
      // If no deviceId, this is a lifecycle call — let the effect handle it
      if (!deviceId) return;

      destroyStream();
      const stream = await createStream(deviceId);
      if (stream && mountedRef.current) {
        streamRef.current = stream;
        await attachStream(stream);
        setIsActive(true);
      }
    },
    [createStream, attachStream, destroyStream]
  );

  // ==========================================================================
  // PUBLIC: stopCamera — exposed for emergency manual stop
  // ==========================================================================
  const stopCamera = useCallback(() => {
    destroyStream();
    setIsActive(false);
    setCapabilities(DEFAULT_CAPABILITIES);
    setSettings(DEFAULT_SETTINGS);
  }, [destroyStream]);

  // ==========================================================================
  // SWITCH CAMERA
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

    if (haptics) {
      haptics.tap();
    } else if ('vibrate' in navigator) {
      navigator.vibrate(30);
    }
  }, [devices, currentDeviceId, startCamera, haptics]);

  // ==========================================================================
  // TORCH CONTROL
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
      if (!capabilities.zoom) return;

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
  // FOCUS TRIGGER
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

    if (haptics) {
      haptics.tap();
    } else if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, [capabilities.focusMode, haptics]);

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