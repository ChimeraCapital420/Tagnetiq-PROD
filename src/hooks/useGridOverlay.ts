// FILE: src/hooks/useGridOverlay.ts
// FIXED: Ensure grid toggle properly updates state
// Grid overlay hook for camera composition guides
// Persists settings to localStorage

import { useState, useCallback, useEffect } from 'react';

export type GridType = 
  | 'rule-of-thirds' 
  | 'golden-ratio' 
  | 'diagonal' 
  | 'center-cross' 
  | 'square'
  | 'fibonacci';

export interface GridSettings {
  enabled: boolean;
  type: GridType;
  opacity: number;
  color: string;
}

const STORAGE_KEY = 'camera_grid_settings';

const DEFAULT_SETTINGS: GridSettings = {
  enabled: false,
  type: 'rule-of-thirds',
  opacity: 0.5,
  color: '#ffffff',
};

// All available grid types for cycling
const GRID_TYPES: GridType[] = [
  'rule-of-thirds',
  'golden-ratio',
  'diagonal',
  'center-cross',
  'square',
  'fibonacci',
];

export interface UseGridOverlayReturn {
  settings: GridSettings;
  setEnabled: (enabled: boolean) => void;
  setType: (type: GridType) => void;
  setOpacity: (opacity: number) => void;
  setColor: (color: string) => void;
  toggle: () => void;
  cycleType: () => void;
  reset: () => void;
}

export function useGridOverlay(): UseGridOverlayReturn {
  const [settings, setSettings] = useState<GridSettings>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('[GridOverlay] Error loading settings:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[GridOverlay] Error saving settings:', e);
    }
  }, [settings]);

  // FIXED: Toggle enabled state
  const toggle = useCallback(() => {
    setSettings(prev => {
      const newEnabled = !prev.enabled;
      console.log('[GridOverlay] Toggle:', newEnabled ? 'ON' : 'OFF');
      return { ...prev, enabled: newEnabled };
    });
  }, []);

  // Set enabled state directly
  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  // Set grid type
  const setType = useCallback((type: GridType) => {
    setSettings(prev => ({ ...prev, type }));
  }, []);

  // Set opacity (0-1)
  const setOpacity = useCallback((opacity: number) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    setSettings(prev => ({ ...prev, opacity: clampedOpacity }));
  }, []);

  // Set color
  const setColor = useCallback((color: string) => {
    setSettings(prev => ({ ...prev, color }));
  }, []);

  // FIXED: Cycle through grid types (and enable if disabled)
  const cycleType = useCallback(() => {
    setSettings(prev => {
      const currentIndex = GRID_TYPES.indexOf(prev.type);
      const nextIndex = (currentIndex + 1) % GRID_TYPES.length;
      const nextType = GRID_TYPES[nextIndex];
      console.log('[GridOverlay] Cycle type:', prev.type, '->', nextType);
      return { 
        ...prev, 
        type: nextType,
        // Auto-enable when cycling
        enabled: true 
      };
    });
  }, []);

  // Reset to defaults
  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }, []);

  return {
    settings,
    setEnabled,
    setType,
    setOpacity,
    setColor,
    toggle,
    cycleType,
    reset,
  };
}

// Export grid type labels for UI
export const GRID_TYPE_LABELS: Record<GridType, string> = {
  'rule-of-thirds': 'Rule of Thirds',
  'golden-ratio': 'Golden Ratio',
  'diagonal': 'Diagonal',
  'center-cross': 'Center Cross',
  'square': 'Square Grid',
  'fibonacci': 'Fibonacci Spiral',
};