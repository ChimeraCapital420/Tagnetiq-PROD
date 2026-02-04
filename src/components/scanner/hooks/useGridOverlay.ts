// FILE: src/components/scanner/hooks/useGridOverlay.ts
// Grid overlay state management for camera composition guides
// Supports rule-of-thirds, golden ratio, center cross, diagonal

import { useState, useCallback } from 'react';
import type { GridType, GridOverlaySettings } from '../types';

export interface UseGridOverlayReturn {
  settings: GridOverlaySettings;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  setType: (type: GridType) => void;
  setOpacity: (opacity: number) => void;
  setColor: (color: string) => void;
  cycleType: () => void;
}

const GRID_TYPES: GridType[] = ['rule-of-thirds', 'golden-ratio', 'center-cross', 'diagonal'];

const DEFAULT_SETTINGS: GridOverlaySettings = {
  enabled: false,
  type: 'rule-of-thirds',
  opacity: 0.5,
  color: '#ffffff',
};

export function useGridOverlay(): UseGridOverlayReturn {
  const [settings, setSettings] = useState<GridOverlaySettings>(DEFAULT_SETTINGS);

  const toggle = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  const setType = useCallback((type: GridType) => {
    setSettings(prev => ({ ...prev, type }));
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    setSettings(prev => ({ ...prev, opacity: Math.max(0, Math.min(1, opacity)) }));
  }, []);

  const setColor = useCallback((color: string) => {
    setSettings(prev => ({ ...prev, color }));
  }, []);

  const cycleType = useCallback(() => {
    setSettings(prev => {
      const currentIndex = GRID_TYPES.indexOf(prev.type);
      const nextIndex = (currentIndex + 1) % GRID_TYPES.length;
      return { ...prev, type: GRID_TYPES[nextIndex] };
    });
  }, []);

  return {
    settings,
    toggle,
    setEnabled,
    setType,
    setOpacity,
    setColor,
    cycleType,
  };
}

export default useGridOverlay;