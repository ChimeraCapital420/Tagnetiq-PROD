// FILE: src/hooks/useGridOverlay.ts
// Grid overlay for camera composition guides
// Mobile-first: persists preferences, battery-conscious rendering

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type GridType = 'none' | 'rule-of-thirds' | 'golden-ratio' | 'center-cross' | 'diagonal';

export interface GridSettings {
  enabled: boolean;
  type: GridType;
  opacity: number; // 0-100
  color: string;   // hex color
}

export interface UseGridOverlayReturn {
  settings: GridSettings;
  setEnabled: (enabled: boolean) => void;
  setType: (type: GridType) => void;
  setOpacity: (opacity: number) => void;
  setColor: (color: string) => void;
  toggle: () => void;
  cycleType: () => void;
  getGridSVG: (width: number, height: number) => string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'camera_grid_settings';

const DEFAULT_SETTINGS: GridSettings = {
  enabled: false,
  type: 'rule-of-thirds',
  opacity: 50,
  color: '#ffffff',
};

const GRID_TYPES: GridType[] = ['none', 'rule-of-thirds', 'golden-ratio', 'center-cross', 'diagonal'];

// =============================================================================
// GRID GENERATORS
// =============================================================================

function generateRuleOfThirds(width: number, height: number, color: string, opacity: number): string {
  const strokeOpacity = opacity / 100;
  const third1X = width / 3;
  const third2X = (width * 2) / 3;
  const third1Y = height / 3;
  const third2Y = (height * 2) / 3;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <line x1="${third1X}" y1="0" x2="${third1X}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="${third2X}" y1="0" x2="${third2X}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="0" y1="${third1Y}" x2="${width}" y2="${third1Y}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="0" y1="${third2Y}" x2="${width}" y2="${third2Y}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <!-- Power points -->
      <circle cx="${third1X}" cy="${third1Y}" r="4" fill="${color}" fill-opacity="${strokeOpacity * 0.5}"/>
      <circle cx="${third2X}" cy="${third1Y}" r="4" fill="${color}" fill-opacity="${strokeOpacity * 0.5}"/>
      <circle cx="${third1X}" cy="${third2Y}" r="4" fill="${color}" fill-opacity="${strokeOpacity * 0.5}"/>
      <circle cx="${third2X}" cy="${third2Y}" r="4" fill="${color}" fill-opacity="${strokeOpacity * 0.5}"/>
    </svg>
  `;
}

function generateGoldenRatio(width: number, height: number, color: string, opacity: number): string {
  const strokeOpacity = opacity / 100;
  const phi = 1.618;
  const goldenX1 = width / phi;
  const goldenX2 = width - (width / phi);
  const goldenY1 = height / phi;
  const goldenY2 = height - (height / phi);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <line x1="${goldenX1}" y1="0" x2="${goldenX1}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="${goldenX2}" y1="0" x2="${goldenX2}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="0" y1="${goldenY1}" x2="${width}" y2="${goldenY1}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="0" y1="${goldenY2}" x2="${width}" y2="${goldenY2}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <!-- Golden spiral hint -->
      <circle cx="${goldenX2}" cy="${goldenY1}" r="6" fill="none" stroke="${color}" stroke-opacity="${strokeOpacity * 0.7}" stroke-width="1"/>
    </svg>
  `;
}

function generateCenterCross(width: number, height: number, color: string, opacity: number): string {
  const strokeOpacity = opacity / 100;
  const centerX = width / 2;
  const centerY = height / 2;
  const crossSize = Math.min(width, height) * 0.1;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <!-- Center vertical line -->
      <line x1="${centerX}" y1="0" x2="${centerX}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity * 0.3}" stroke-width="1" stroke-dasharray="5,5"/>
      <!-- Center horizontal line -->
      <line x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" stroke="${color}" stroke-opacity="${strokeOpacity * 0.3}" stroke-width="1" stroke-dasharray="5,5"/>
      <!-- Center cross -->
      <line x1="${centerX - crossSize}" y1="${centerY}" x2="${centerX + crossSize}" y2="${centerY}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="2"/>
      <line x1="${centerX}" y1="${centerY - crossSize}" x2="${centerX}" y2="${centerY + crossSize}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="2"/>
      <!-- Center circle -->
      <circle cx="${centerX}" cy="${centerY}" r="${crossSize * 0.5}" fill="none" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
    </svg>
  `;
}

function generateDiagonal(width: number, height: number, color: string, opacity: number): string {
  const strokeOpacity = opacity / 100;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <!-- Main diagonals -->
      <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1"/>
      <!-- Edge to center diagonals -->
      <line x1="0" y1="${height / 2}" x2="${width / 2}" y2="0" stroke="${color}" stroke-opacity="${strokeOpacity * 0.5}" stroke-width="1"/>
      <line x1="${width / 2}" y1="0" x2="${width}" y2="${height / 2}" stroke="${color}" stroke-opacity="${strokeOpacity * 0.5}" stroke-width="1"/>
      <line x1="${width}" y1="${height / 2}" x2="${width / 2}" y2="${height}" stroke="${color}" stroke-opacity="${strokeOpacity * 0.5}" stroke-width="1"/>
      <line x1="${width / 2}" y1="${height}" x2="0" y2="${height / 2}" stroke="${color}" stroke-opacity="${strokeOpacity * 0.5}" stroke-width="1"/>
    </svg>
  `;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useGridOverlay(): UseGridOverlayReturn {
  const [settings, setSettings] = useState<GridSettings>(DEFAULT_SETTINGS);

  // ---------------------------------------------------------------------------
  // LOAD SAVED SETTINGS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (e) {
      console.warn('📐 [GRID] Could not load settings:', e);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // SAVE SETTINGS
  // ---------------------------------------------------------------------------

  const saveSettings = useCallback((newSettings: GridSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (e) {
      console.warn('📐 [GRID] Could not save settings:', e);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  const setEnabled = useCallback((enabled: boolean) => {
    saveSettings({ ...settings, enabled });
  }, [settings, saveSettings]);

  const setType = useCallback((type: GridType) => {
    saveSettings({ ...settings, type, enabled: type !== 'none' });
  }, [settings, saveSettings]);

  const setOpacity = useCallback((opacity: number) => {
    saveSettings({ ...settings, opacity: Math.max(0, Math.min(100, opacity)) });
  }, [settings, saveSettings]);

  const setColor = useCallback((color: string) => {
    saveSettings({ ...settings, color });
  }, [settings, saveSettings]);

  const toggle = useCallback(() => {
    saveSettings({ ...settings, enabled: !settings.enabled });
  }, [settings, saveSettings]);

  const cycleType = useCallback(() => {
    const currentIndex = GRID_TYPES.indexOf(settings.type);
    const nextIndex = (currentIndex + 1) % GRID_TYPES.length;
    setType(GRID_TYPES[nextIndex]);
  }, [settings.type, setType]);

  // ---------------------------------------------------------------------------
  // GENERATE SVG
  // ---------------------------------------------------------------------------

  const getGridSVG = useCallback((width: number, height: number): string => {
    if (!settings.enabled || settings.type === 'none') {
      return '';
    }

    switch (settings.type) {
      case 'rule-of-thirds':
        return generateRuleOfThirds(width, height, settings.color, settings.opacity);
      case 'golden-ratio':
        return generateGoldenRatio(width, height, settings.color, settings.opacity);
      case 'center-cross':
        return generateCenterCross(width, height, settings.color, settings.opacity);
      case 'diagonal':
        return generateDiagonal(width, height, settings.color, settings.opacity);
      default:
        return '';
    }
  }, [settings]);

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    settings,
    setEnabled,
    setType,
    setOpacity,
    setColor,
    toggle,
    cycleType,
    getGridSVG,
  };
}

export default useGridOverlay;