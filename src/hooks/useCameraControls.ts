// FILE: src/hooks/useCameraControls.ts
// Real camera track controls using MediaStream capabilities
// Mobile-first: battery-conscious, graceful degradation
// FIXED: Added hasLoggedRef to prevent console spam on every render

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface CameraCapabilities {
  // Standard capabilities
  torch: boolean;
  zoom: { min: number; max: number; step: number } | null;
  focusMode: string[];
  exposureMode: string[];
  whiteBalanceMode: string[];
  
  // Advanced capabilities (may not be available)
  brightness: { min: number; max: number; step: number } | null;
  contrast: { min: number; max: number; step: number } | null;
  saturation: { min: number; max: number; step: number } | null;
  sharpness: { min: number; max: number; step: number } | null;
  pan: { min: number; max: number; step: number } | null;
  tilt: { min: number; max: number; step: number } | null;
  
  // Resolution capabilities
  width: { min: number; max: number } | null;
  height: { min: number; max: number } | null;
  frameRate: { min: number; max: number } | null;
}

export interface CameraSettings {
  torch: boolean;
  zoom: number;
  focusMode: 'continuous' | 'single-shot' | 'manual';
  brightness: number;
  contrast: number;
  saturation: number;
  resolution: { width: number; height: number };
  frameRate: number;
}

export interface UseCameraControlsReturn {
  // State
  capabilities: CameraCapabilities;
  settings: CameraSettings;
  isApplying: boolean;
  error: string | null;
  isReady: boolean;
  
  // Actions
  setTorch: (enabled: boolean) => Promise<void>;
  setZoom: (level: number) => Promise<void>;
  setFocusMode: (mode: 'continuous' | 'single-shot' | 'manual') => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  setContrast: (value: number) => Promise<void>;
  setSaturation: (value: number) => Promise<void>;
  setResolution: (width: number, height: number) => Promise<void>;
  setFrameRate: (fps: number) => Promise<void>;
  
  // Utility
  refreshCapabilities: () => void;
  resetToDefaults: () => Promise<void>;
  applyPreset: (preset: 'default' | 'lowLight' | 'outdoor' | 'document') => Promise<void>;
}

// =============================================================================
// MODULE-LEVEL LOGGING CONTROL (persists across component remounts)
// =============================================================================
const loggedTrackIds = new Set<string>();

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_SETTINGS: CameraSettings = {
  torch: false,
  zoom: 1,
  focusMode: 'continuous',
  brightness: 50,
  contrast: 50,
  saturation: 50,
  resolution: { width: 1920, height: 1080 },
  frameRate: 30,
};

// Safe default capabilities - all features disabled until camera is ready
const EMPTY_CAPABILITIES: CameraCapabilities = {
  torch: false,
  zoom: null,
  focusMode: [],
  exposureMode: [],
  whiteBalanceMode: [],
  brightness: null,
  contrast: null,
  saturation: null,
  sharpness: null,
  pan: null,
  tilt: null,
  width: null,
  height: null,
  frameRate: null,
};

const PRESETS: Record<string, Partial<CameraSettings>> = {
  default: DEFAULT_SETTINGS,
  lowLight: {
    brightness: 70,
    contrast: 40,
    saturation: 45,
    torch: true,
  },
  outdoor: {
    brightness: 40,
    contrast: 60,
    saturation: 55,
    torch: false,
  },
  document: {
    brightness: 60,
    contrast: 70,
    saturation: 30,
    torch: true,
    zoom: 2,
  },
};

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useCameraControls(
  videoTrack: MediaStreamTrack | null
): UseCameraControlsReturn {
  // State - capabilities starts with safe empty object, never null
  const [capabilities, setCapabilities] = useState<CameraCapabilities>(EMPTY_CAPABILITIES);
  const [settings, setSettings] = useState<CameraSettings>(DEFAULT_SETTINGS);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Ref to track component mount status
  const isMounted = useRef(true);
  
  // Track ID ref for detecting camera changes (still need this for other logic)
  const lastTrackIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // DETECT CAPABILITIES
  // ---------------------------------------------------------------------------

  const refreshCapabilities = useCallback(() => {
    // No track = reset to empty capabilities
    if (!videoTrack) {
      setCapabilities(EMPTY_CAPABILITIES);
      setIsReady(false);
      lastTrackIdRef.current = null;
      return;
    }

    try {
      // Get current track ID
      const currentTrackId = videoTrack.id || 'unknown';
      lastTrackIdRef.current = currentTrackId;

      // Get the track capabilities
      const caps = videoTrack.getCapabilities?.();
      const trackSettings = videoTrack.getSettings?.();
      
      if (!caps) {
        // Log once per track ID (module-level persistence)
        if (!loggedTrackIds.has(currentTrackId)) {
          loggedTrackIds.add(currentTrackId);
          console.log('📷 [CONTROLS] getCapabilities() not supported');
        }
        setCapabilities(EMPTY_CAPABILITIES);
        setIsReady(false);
        return;
      }

      // Build our capabilities object FIRST (before any logging)
      const detected: CameraCapabilities = {
        // Torch (flashlight)
        torch: 'torch' in caps && caps.torch === true,
        
        // Zoom
        zoom: caps.zoom ? {
          min: (caps.zoom as any).min ?? 1,
          max: (caps.zoom as any).max ?? 1,
          step: (caps.zoom as any).step ?? 0.1,
        } : null,
        
        // Focus modes
        focusMode: (caps.focusMode as string[]) ?? [],
        
        // Exposure modes
        exposureMode: (caps.exposureMode as string[]) ?? [],
        
        // White balance
        whiteBalanceMode: (caps.whiteBalanceMode as string[]) ?? [],
        
        // Brightness (not standard, but some cameras support)
        brightness: (caps as any).brightness ? {
          min: (caps as any).brightness.min ?? 0,
          max: (caps as any).brightness.max ?? 100,
          step: (caps as any).brightness.step ?? 1,
        } : null,
        
        // Contrast
        contrast: (caps as any).contrast ? {
          min: (caps as any).contrast.min ?? 0,
          max: (caps as any).contrast.max ?? 100,
          step: (caps as any).contrast.step ?? 1,
        } : null,
        
        // Saturation
        saturation: (caps as any).saturation ? {
          min: (caps as any).saturation.min ?? 0,
          max: (caps as any).saturation.max ?? 100,
          step: (caps as any).saturation.step ?? 1,
        } : null,
        
        // Sharpness
        sharpness: (caps as any).sharpness ? {
          min: (caps as any).sharpness.min ?? 0,
          max: (caps as any).sharpness.max ?? 100,
          step: (caps as any).sharpness.step ?? 1,
        } : null,
        
        // Pan
        pan: (caps as any).pan ? {
          min: (caps as any).pan.min ?? -180,
          max: (caps as any).pan.max ?? 180,
          step: (caps as any).pan.step ?? 1,
        } : null,
        
        // Tilt
        tilt: (caps as any).tilt ? {
          min: (caps as any).tilt.min ?? -180,
          max: (caps as any).tilt.max ?? 180,
          step: (caps as any).tilt.step ?? 1,
        } : null,
        
        // Resolution
        width: caps.width ? {
          min: (caps.width as any).min ?? 320,
          max: (caps.width as any).max ?? 4096,
        } : null,
        height: caps.height ? {
          min: (caps.height as any).min ?? 240,
          max: (caps.height as any).max ?? 2160,
        } : null,
        
        // Frame rate
        frameRate: caps.frameRate ? {
          min: (caps.frameRate as any).min ?? 1,
          max: (caps.frameRate as any).max ?? 60,
        } : null,
      };

      setCapabilities(detected);
      setIsReady(true);

      // Update settings with current track values
      if (trackSettings) {
        setSettings(prev => ({
          ...prev,
          torch: (trackSettings as any).torch ?? false,
          zoom: trackSettings.zoom ?? 1,
          focusMode: (trackSettings.focusMode as any) ?? 'continuous',
          resolution: {
            width: trackSettings.width ?? 1920,
            height: trackSettings.height ?? 1080,
          },
          frameRate: trackSettings.frameRate ?? 30,
        }));
      }

      // FIXED: Log ONCE per camera track ID (module-level, survives remounts)
      if (!loggedTrackIds.has(currentTrackId)) {
        loggedTrackIds.add(currentTrackId); // Add to Set FIRST
        console.log('📷 [CONTROLS] Raw capabilities:', caps);
        console.log('📷 [CONTROLS] Detected:', {
          torch: detected.torch,
          zoom: detected.zoom ? `${detected.zoom.min}-${detected.zoom.max}x` : 'No',
          focusModes: detected.focusMode.join(', ') || 'None',
        });
      }

    } catch (err) {
      // Log error once per track ID
      const errorKey = `error_${videoTrack?.id || 'unknown'}`;
      if (!loggedTrackIds.has(errorKey)) {
        loggedTrackIds.add(errorKey);
        console.error('📷 [CONTROLS] Failed to detect capabilities:', err);
      }
      setCapabilities(EMPTY_CAPABILITIES);
      setIsReady(false);
    }
  }, [videoTrack]);

  // Refresh capabilities when track changes
  useEffect(() => {
    refreshCapabilities();
  }, [refreshCapabilities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // APPLY CONSTRAINTS
  // ---------------------------------------------------------------------------

  const applyConstraints = useCallback(async (
    constraints: MediaTrackConstraints
  ): Promise<boolean> => {
    if (!videoTrack) {
      setError('No video track available');
      return false;
    }

    setIsApplying(true);
    setError(null);

    try {
      // Only log constraint applications (these are user-initiated, so OK to log)
      console.log('📷 [CONTROLS] Applying constraints:', constraints);
      await videoTrack.applyConstraints(constraints);
      
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(25);
      }
      
      return true;
    } catch (err: any) {
      console.error('📷 [CONTROLS] Failed to apply constraints:', err);
      setError(err.message || 'Failed to apply camera settings');
      return false;
    } finally {
      if (isMounted.current) {
        setIsApplying(false);
      }
    }
  }, [videoTrack]);

  // ---------------------------------------------------------------------------
  // TORCH CONTROL
  // ---------------------------------------------------------------------------

  const setTorch = useCallback(async (enabled: boolean) => {
    if (!capabilities.torch) {
      toast.error('Torch not available', {
        description: 'This camera does not support flashlight control'
      });
      return;
    }

    const success = await applyConstraints({
      advanced: [{ torch: enabled } as any]
    });

    if (success) {
      setSettings(prev => ({ ...prev, torch: enabled }));
      toast.success(enabled ? 'Flashlight on' : 'Flashlight off');
    }
  }, [capabilities.torch, applyConstraints]);

  // ---------------------------------------------------------------------------
  // ZOOM CONTROL
  // ---------------------------------------------------------------------------

  const setZoom = useCallback(async (level: number) => {
    if (!capabilities.zoom) {
      toast.error('Zoom not available', {
        description: 'This camera does not support digital zoom'
      });
      return;
    }

    // Clamp to valid range
    const clampedLevel = Math.max(
      capabilities.zoom.min,
      Math.min(capabilities.zoom.max, level)
    );

    const success = await applyConstraints({
      advanced: [{ zoom: clampedLevel } as any]
    });

    if (success) {
      setSettings(prev => ({ ...prev, zoom: clampedLevel }));
    }
  }, [capabilities.zoom, applyConstraints]);

  // ---------------------------------------------------------------------------
  // FOCUS MODE
  // ---------------------------------------------------------------------------

  const setFocusMode = useCallback(async (mode: 'continuous' | 'single-shot' | 'manual') => {
    if (!capabilities.focusMode.includes(mode)) {
      toast.error('Focus mode not available', {
        description: `This camera does not support "${mode}" focus`
      });
      return;
    }

    const success = await applyConstraints({
      advanced: [{ focusMode: mode } as any]
    });

    if (success) {
      setSettings(prev => ({ ...prev, focusMode: mode }));
      toast.success(`Focus: ${mode}`);
    }
  }, [capabilities.focusMode, applyConstraints]);

  // ---------------------------------------------------------------------------
  // BRIGHTNESS (via CSS filter if not supported natively)
  // ---------------------------------------------------------------------------

  const setBrightness = useCallback(async (value: number) => {
    if (capabilities.brightness) {
      // Native support
      await applyConstraints({
        advanced: [{ brightness: value } as any]
      });
    }
    // Always update state (will be applied via CSS filter in component)
    setSettings(prev => ({ ...prev, brightness: value }));
  }, [capabilities.brightness, applyConstraints]);

  // ---------------------------------------------------------------------------
  // CONTRAST (via CSS filter if not supported natively)
  // ---------------------------------------------------------------------------

  const setContrast = useCallback(async (value: number) => {
    if (capabilities.contrast) {
      // Native support
      await applyConstraints({
        advanced: [{ contrast: value } as any]
      });
    }
    // Always update state (will be applied via CSS filter in component)
    setSettings(prev => ({ ...prev, contrast: value }));
  }, [capabilities.contrast, applyConstraints]);

  // ---------------------------------------------------------------------------
  // SATURATION (via CSS filter if not supported natively)
  // ---------------------------------------------------------------------------

  const setSaturation = useCallback(async (value: number) => {
    if (capabilities.saturation) {
      // Native support
      await applyConstraints({
        advanced: [{ saturation: value } as any]
      });
    }
    // Always update state (will be applied via CSS filter in component)
    setSettings(prev => ({ ...prev, saturation: value }));
  }, [capabilities.saturation, applyConstraints]);

  // ---------------------------------------------------------------------------
  // RESOLUTION
  // ---------------------------------------------------------------------------

  const setResolution = useCallback(async (width: number, height: number) => {
    const success = await applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
    });

    if (success) {
      setSettings(prev => ({ ...prev, resolution: { width, height } }));
      toast.success(`Resolution: ${width}x${height}`);
    }
  }, [applyConstraints]);

  // ---------------------------------------------------------------------------
  // FRAME RATE
  // ---------------------------------------------------------------------------

  const setFrameRate = useCallback(async (fps: number) => {
    const success = await applyConstraints({
      frameRate: { ideal: fps },
    });

    if (success) {
      setSettings(prev => ({ ...prev, frameRate: fps }));
      toast.success(`Frame rate: ${fps} FPS`);
    }
  }, [applyConstraints]);

  // ---------------------------------------------------------------------------
  // RESET TO DEFAULTS
  // ---------------------------------------------------------------------------

  const resetToDefaults = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    
    // Apply default constraints only if we have a track
    if (videoTrack) {
      await applyConstraints({
        width: { ideal: DEFAULT_SETTINGS.resolution.width },
        height: { ideal: DEFAULT_SETTINGS.resolution.height },
        frameRate: { ideal: DEFAULT_SETTINGS.frameRate },
        advanced: [
          { torch: DEFAULT_SETTINGS.torch },
          { zoom: DEFAULT_SETTINGS.zoom },
          { focusMode: DEFAULT_SETTINGS.focusMode },
        ] as any,
      });
    }
    
    toast.success('Settings reset to defaults');
  }, [videoTrack, applyConstraints]);

  // ---------------------------------------------------------------------------
  // APPLY PRESET
  // ---------------------------------------------------------------------------

  const applyPreset = useCallback(async (preset: 'default' | 'lowLight' | 'outdoor' | 'document') => {
    const presetSettings = PRESETS[preset];
    if (!presetSettings) return;

    // Apply each setting from the preset
    if (presetSettings.torch !== undefined) await setTorch(presetSettings.torch);
    if (presetSettings.zoom !== undefined) await setZoom(presetSettings.zoom);
    if (presetSettings.brightness !== undefined) await setBrightness(presetSettings.brightness);
    if (presetSettings.contrast !== undefined) await setContrast(presetSettings.contrast);
    if (presetSettings.saturation !== undefined) await setSaturation(presetSettings.saturation);

    toast.success(`Applied "${preset}" preset`);
  }, [setTorch, setZoom, setBrightness, setContrast, setSaturation]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    // State - capabilities is NEVER null, safe to access .torch etc
    capabilities,
    settings,
    isApplying,
    error,
    isReady,
    
    // Actions
    setTorch,
    setZoom,
    setFocusMode,
    setBrightness,
    setContrast,
    setSaturation,
    setResolution,
    setFrameRate,
    
    // Utility
    refreshCapabilities,
    resetToDefaults,
    applyPreset,
  };
}

export default useCameraControls;