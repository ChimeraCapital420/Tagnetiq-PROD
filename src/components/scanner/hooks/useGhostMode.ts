// FILE: src/components/scanner/hooks/useGhostMode.ts
// Ghost Protocol hook - allows listing items you don't own yet
// Captures location, store info, and calculates profit margins

import { useState, useCallback } from 'react';
import type { 
  GhostLocation, 
  GhostStoreInfo, 
  GhostData,
  GhostModeState 
} from '../types';

export interface UseGhostModeReturn extends GhostModeState {
  toggleGhostMode: (enabled?: boolean) => void;
  refreshLocation: () => void;
  updateStoreInfo: (info: Partial<GhostStoreInfo>) => void;
  setHandlingHours: (hours: number) => void;
  buildGhostData: (estimatedValue: number) => GhostData | null;
  reset: () => void;
}

export function useGhostMode(): UseGhostModeReturn {
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [location, setLocation] = useState<GhostLocation | null>(null);
  const [storeInfo, setStoreInfo] = useState<GhostStoreInfo | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [handlingHours, setHandlingHours] = useState(24);

  // Capture current GPS location
  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    setIsCapturingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        });
        setIsCapturingLocation(false);
      },
      (error) => {
        setLocationError(error.message);
        setIsCapturingLocation(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000 
      }
    );
  }, []);

  // Toggle ghost mode on/off
  const toggleGhostMode = useCallback((enabled?: boolean) => {
    const newState = enabled ?? !isGhostMode;
    setIsGhostMode(newState);
    
    // Auto-capture location when enabling
    if (newState && !location) {
      captureLocation();
    }
    
    // Clear store info when disabling
    if (!newState) {
      setStoreInfo(null);
      setLocationError(null);
    }
  }, [isGhostMode, location, captureLocation]);

  // Update store information
  const updateStoreInfo = useCallback((info: Partial<GhostStoreInfo>) => {
    setStoreInfo(prev => prev 
      ? { ...prev, ...info } 
      : {
          type: 'thrift',
          name: '',
          shelf_price: 0,
          ...info,
        } as GhostStoreInfo
    );
  }, []);

  // Check if ghost mode is fully configured
  const isReady = isGhostMode && 
    location !== null && 
    storeInfo !== null && 
    storeInfo.name.trim() !== '' && 
    storeInfo.shelf_price > 0;

  // Build ghost data for analysis result
  const buildGhostData = useCallback((estimatedValue: number): GhostData | null => {
    if (!location || !storeInfo) return null;

    const margin = estimatedValue - storeInfo.shelf_price;
    const marginPercent = storeInfo.shelf_price > 0 
      ? (margin / storeInfo.shelf_price) * 100 
      : 0;

    return {
      is_ghost: true,
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
      },
      store: {
        type: storeInfo.type,
        name: storeInfo.name,
        aisle: storeInfo.aisle,
      },
      pricing: {
        shelf_price: storeInfo.shelf_price,
        estimated_value: estimatedValue,
      },
      handling_time_hours: handlingHours,
      kpis: {
        estimated_margin: margin,
        margin_percent: marginPercent,
        velocity_score: marginPercent > 100 ? 'high' : marginPercent > 50 ? 'medium' : 'low',
      },
      scanned_at: new Date().toISOString(),
    };
  }, [location, storeInfo, handlingHours]);

  // Reset all ghost state
  const reset = useCallback(() => {
    setIsGhostMode(false);
    setLocation(null);
    setStoreInfo(null);
    setIsCapturingLocation(false);
    setLocationError(null);
    setHandlingHours(24);
  }, []);

  return {
    // State
    isGhostMode,
    location,
    storeInfo,
    isCapturingLocation,
    locationError,
    handlingHours,
    isReady,
    
    // Actions
    toggleGhostMode,
    refreshLocation: captureLocation,
    updateStoreInfo,
    setHandlingHours,
    buildGhostData,
    reset,
  };
}

export default useGhostMode;