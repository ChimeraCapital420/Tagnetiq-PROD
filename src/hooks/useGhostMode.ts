// FILE: src/hooks/useGhostMode.ts
// Ghost Protocol - Mobile-first GPS capture and state management
// All location processing happens on the user's device to reduce server load

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface GhostLocation {
  lat: number;
  lng: number;
  accuracy: number;
  captured_at: string;
  address?: string; // Reverse geocoded (optional)
}

export interface StoreInfo {
  type: StoreType;
  name: string;
  address?: string;
  aisle?: string;
  shelf_price: number;
  notes?: string;
  hours?: string;
}

export type StoreType = 
  | 'thrift_store'
  | 'garage_sale'
  | 'estate_sale'
  | 'antique_mall'
  | 'habitat_restore'
  | 'pawn_shop'
  | 'flea_market'
  | 'private_sale'
  | 'auction'
  | 'other';

export interface GhostData {
  is_ghost: true;
  location: GhostLocation;
  store: StoreInfo;
  timer: {
    created_at: string;
    expires_at: string;
    handling_hours: number;
  };
  kpis: {
    scan_to_toggle_ms: number;
    estimated_margin: number;
    velocity_score: 'low' | 'medium' | 'high';
  };
}

export interface GhostModeState {
  isGhostMode: boolean;
  location: GhostLocation | null;
  storeInfo: StoreInfo | null;
  isCapturingLocation: boolean;
  locationError: string | null;
  handlingHours: number;
}

// =============================================================================
// STORE TYPE OPTIONS
// =============================================================================

export const STORE_TYPES: { value: StoreType; label: string; icon: string }[] = [
  { value: 'thrift_store', label: 'Thrift Store', icon: '🏪' },
  { value: 'garage_sale', label: 'Garage Sale', icon: '🏠' },
  { value: 'estate_sale', label: 'Estate Sale', icon: '🏛️' },
  { value: 'antique_mall', label: 'Antique Mall', icon: '🏺' },
  { value: 'habitat_restore', label: 'Habitat ReStore', icon: '🔨' },
  { value: 'pawn_shop', label: 'Pawn Shop', icon: '💰' },
  { value: 'flea_market', label: 'Flea Market', icon: '🎪' },
  { value: 'private_sale', label: 'Private Sale', icon: '🤝' },
  { value: 'auction', label: 'Auction', icon: '🔨' },
  { value: 'other', label: 'Other', icon: '📍' },
];

// =============================================================================
// HOOK
// =============================================================================

export function useGhostMode() {
  const [isGhostMode, setIsGhostMode] = useState(false);
  const [location, setLocation] = useState<GhostLocation | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [handlingHours, setHandlingHours] = useState(48); // Default 48hr
  const [ghostStartTime, setGhostStartTime] = useState<number | null>(null);

  // =========================================================================
  // GPS CAPTURE - Runs entirely on user's device
  // =========================================================================

  const captureLocation = useCallback(async (): Promise<GhostLocation | null> => {
    // Check for geolocation support
    if (!navigator.geolocation) {
      setLocationError('GPS not available on this device');
      toast.error('GPS not available', {
        description: 'Please enable location services or use a device with GPS.',
      });
      return null;
    }

    setIsCapturingLocation(true);
    setLocationError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: GhostLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            captured_at: new Date().toISOString(),
          };
          
          setLocation(loc);
          setIsCapturingLocation(false);
          
          // Haptic feedback on mobile
          if (navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
          }
          
          toast.success('📍 Location captured', {
            description: `Accuracy: ${Math.round(loc.accuracy)}m`,
          });
          
          resolve(loc);
        },
        (error) => {
          let errorMessage = 'Failed to capture location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable in settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Try moving to a better spot.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
          }
          
          setLocationError(errorMessage);
          setIsCapturingLocation(false);
          toast.error('Location capture failed', { description: errorMessage });
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  // =========================================================================
  // TOGGLE GHOST MODE
  // =========================================================================

  const toggleGhostMode = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Capture timestamp for KPI tracking
      setGhostStartTime(Date.now());
      
      // Start GPS capture immediately
      const loc = await captureLocation();
      
      if (loc) {
        setIsGhostMode(true);
        // Initialize empty store info
        setStoreInfo({
          type: 'thrift_store',
          name: '',
          shelf_price: 0,
        });
      } else {
        // If GPS fails, don't enable ghost mode
        setIsGhostMode(false);
      }
    } else {
      // Disable ghost mode
      setIsGhostMode(false);
      setLocation(null);
      setStoreInfo(null);
      setGhostStartTime(null);
      setLocationError(null);
    }
  }, [captureLocation]);

  // =========================================================================
  // BUILD GHOST DATA PAYLOAD
  // =========================================================================

  const buildGhostData = useCallback((estimatedValue: number): GhostData | null => {
    if (!isGhostMode || !location || !storeInfo) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + handlingHours * 60 * 60 * 1000);
    
    // Calculate estimated margin
    const shelfPrice = storeInfo.shelf_price || 0;
    const estimatedMargin = estimatedValue - shelfPrice;
    
    // Calculate velocity score
    const marginPercent = shelfPrice > 0 ? (estimatedMargin / shelfPrice) * 100 : 0;
    let velocityScore: 'low' | 'medium' | 'high' = 'low';
    if (marginPercent >= 500) velocityScore = 'high';
    else if (marginPercent >= 200) velocityScore = 'medium';

    return {
      is_ghost: true,
      location,
      store: storeInfo,
      timer: {
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        handling_hours: handlingHours,
      },
      kpis: {
        scan_to_toggle_ms: ghostStartTime ? Date.now() - ghostStartTime : 0,
        estimated_margin: estimatedMargin,
        velocity_score: velocityScore,
      },
    };
  }, [isGhostMode, location, storeInfo, handlingHours, ghostStartTime]);

  // =========================================================================
  // REFRESH LOCATION
  // =========================================================================

  const refreshLocation = useCallback(async () => {
    if (!isGhostMode) return;
    await captureLocation();
  }, [isGhostMode, captureLocation]);

  // =========================================================================
  // UPDATE STORE INFO
  // =========================================================================

  const updateStoreInfo = useCallback((updates: Partial<StoreInfo>) => {
    setStoreInfo(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  // =========================================================================
  // CLEANUP ON UNMOUNT
  // =========================================================================

  useEffect(() => {
    return () => {
      // Reset state on unmount
      setIsGhostMode(false);
      setLocation(null);
      setStoreInfo(null);
    };
  }, []);

  return {
    // State
    isGhostMode,
    location,
    storeInfo,
    isCapturingLocation,
    locationError,
    handlingHours,
    
    // Actions
    toggleGhostMode,
    captureLocation,
    refreshLocation,
    updateStoreInfo,
    setHandlingHours,
    buildGhostData,
    
    // Derived
    isGhostReady: isGhostMode && !!location && !!storeInfo?.name && storeInfo.shelf_price > 0,
  };
}

export default useGhostMode;