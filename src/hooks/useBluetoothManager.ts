// FILE: src/hooks/useBluetoothManager.ts
// Real Web Bluetooth API integration for external cameras and devices
// Mobile-first with battery optimization and connection persistence
//
// ENHANCED: Meta Smart Glasses support via Capacitor native plugin.
// When running in Capacitor shell -> MetaGlasses plugin is available.
// When running in browser (Vercel) -> graceful fallback, glasses show
// "use mobile app" message. ALL existing Bluetooth functionality is UNCHANGED.
//
// Sprint F: Added forgetMetaGlasses() — resets local + native state
//
// v11 FIX: React StrictMode race condition.
//   Old code used a boolean flag (metaGlassesLoaded). StrictMode mounts twice:
//   Mount 1: starts async load, sets flag=true, unmounts before it resolves.
//   Mount 2: sees flag=true, returns MetaGlasses (still null), pluginAvailable=false forever.
//   Fix: shared Promise. All callers await the same load. Second mount waits for
//   the first load to finish and gets the correct result.

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// --- Meta Glasses Plugin (lazy import - only loads in Capacitor) ------------

let MetaGlasses: any = null;
let metaGlassesLoadPromise: Promise<boolean> | null = null;

function loadMetaGlassesPlugin(): Promise<boolean> {
  // If already loading or loaded, return the same promise.
  // This way StrictMode's second mount waits for the first load to finish.
  if (metaGlassesLoadPromise) return metaGlassesLoadPromise;

  metaGlassesLoadPromise = (async () => {
    try {
      const { registerPlugin } = await import(/* @vite-ignore */ '@capacitor/core');
      MetaGlasses = registerPlugin('MetaGlasses');
      const result = await MetaGlasses.isAvailable();
      if (!result.available) MetaGlasses = null;
    } catch {
      // Not in Capacitor shell - plugin not available, that's fine
      MetaGlasses = null;
    }
    return MetaGlasses != null;
  })();

  return metaGlassesLoadPromise;
}

// =============================================================================
// TYPES
// =============================================================================

export interface BluetoothDevice {
  id: string;
  name: string;
  type: 'camera' | 'scanner' | 'glasses' | 'unknown';
  connected: boolean;
  batteryLevel?: number;
  device?: globalThis.BluetoothDevice;
  gatt?: BluetoothRemoteGATTServer;
}

export interface MetaGlassesState {
  /** Is the Capacitor Meta glasses plugin available? (false in browser) */
  pluginAvailable: boolean;
  /** Has user completed one-time Meta AI app registration? */
  isRegistered: boolean;
  /** Has user granted camera permission in Meta AI app? */
  cameraPermissionGranted: boolean;
  /** Are glasses currently connected? */
  isConnected: boolean;
  /** Is a camera session active? */
  isSessionActive: boolean;
  /** Connected glasses name */
  deviceName: string | null;
  /** Battery 0-100, null if unknown */
  batteryLevel: number | null;
  /** Is a setup step currently in progress? */
  isLoading: boolean;
  /** Current error, if any */
  error: string | null;
}

export interface UseBluetoothManagerReturn {
  // -- Existing Bluetooth (UNCHANGED) --
  isSupported: boolean;
  isEnabled: boolean;
  isScanning: boolean;
  availableDevices: BluetoothDevice[];
  connectedDevices: BluetoothDevice[];
  connectedDevice: BluetoothDevice | null;
  error: string | null;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  forgetDevice: (deviceId: string) => void;
  requestDevice: () => Promise<BluetoothDevice | null>;

  // -- Meta Glasses (NEW) --
  metaGlasses: MetaGlassesState;
  registerMetaGlasses: () => Promise<boolean>;
  forgetMetaGlasses: () => Promise<void>;
  requestGlassesCameraPermission: () => Promise<boolean>;
  startGlassesSession: () => Promise<boolean>;
  stopGlassesSession: () => Promise<void>;
  captureGlassesFrame: () => Promise<{ base64: string; width: number; height: number } | null>;
  refreshGlassesStatus: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BLUETOOTH_SERVICES = [
  'generic_access',
  'device_information',
];

const STORAGE_KEY = 'bluetooth_paired_devices';

// Module-level flag - persists across StrictMode remounts
let hasCheckedBluetoothAvailability = false;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function checkBluetoothSupport(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

function detectDeviceType(name: string): 'camera' | 'scanner' | 'glasses' | 'unknown' {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gopro') || lower.includes('dji') || lower.includes('camera')) return 'camera';
  if (lower.includes('ray-ban') || lower.includes('meta') || lower.includes('glasses')) return 'glasses';
  if (lower.includes('scanner') || lower.includes('barcode')) return 'scanner';
  return 'unknown';
}

function loadRememberedDevices(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRememberedDevice(deviceId: string, deviceName: string): void {
  try {
    const stored = loadRememberedDevices();
    const devices = stored.filter(id => id !== deviceId);
    devices.unshift(deviceId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices.slice(0, 10)));

    const names = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_names`) || '{}');
    names[deviceId] = deviceName;
    localStorage.setItem(`${STORAGE_KEY}_names`, JSON.stringify(names));
  } catch {
    // Silent fail
  }
}

function removeRememberedDevice(deviceId: string): void {
  try {
    const stored = loadRememberedDevices();
    const devices = stored.filter(id => id !== deviceId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));

    const names = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_names`) || '{}');
    delete names[deviceId];
    localStorage.setItem(`${STORAGE_KEY}_names`, JSON.stringify(names));
  } catch {
    // Silent fail
  }
}

// =============================================================================
// INITIAL META GLASSES STATE
// =============================================================================

const INITIAL_META_STATE: MetaGlassesState = {
  pluginAvailable: false,
  isRegistered: false,
  cameraPermissionGranted: false,
  isConnected: false,
  isSessionActive: false,
  deviceName: null,
  batteryLevel: null,
  isLoading: false,
  error: null,
};

// =============================================================================
// HOOK
// =============================================================================

export function useBluetoothManager(): UseBluetoothManagerReturn {
  // -- Existing Bluetooth state (UNCHANGED) --
  const [isSupported] = useState<boolean>(checkBluetoothSupport());
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const scanAbortController = useRef<AbortController | null>(null);
  const deviceRefs = useRef<Map<string, globalThis.BluetoothDevice>>(new Map());

  // -- Meta Glasses state (NEW) --
  const [metaGlasses, setMetaGlasses] = useState<MetaGlassesState>(INITIAL_META_STATE);

  // ---------------------------------------------------------------------------
  // Check Bluetooth availability + Meta plugin on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;

    // Check Meta glasses plugin availability
    // v11: loadMetaGlassesPlugin returns a shared Promise — safe in StrictMode
    loadMetaGlassesPlugin().then(async (available) => {
      if (!isMountedRef.current) return;
      if (available && MetaGlasses) {
        try {
          const status = await MetaGlasses.getStatus();
          setMetaGlasses({
            pluginAvailable: true,
            isRegistered: status.isRegistered,
            cameraPermissionGranted: status.cameraPermissionGranted,
            isConnected: status.isConnected,
            isSessionActive: status.isSessionActive,
            deviceName: status.deviceName,
            batteryLevel: status.batteryLevel,
            isLoading: false,
            error: null,
          });
        } catch {
          setMetaGlasses(prev => ({ ...prev, pluginAvailable: true }));
        }
      }
    });

    if (!isSupported) return;

    // Guard: Only check Bluetooth once per page load
    if (hasCheckedBluetoothAvailability) return;
    hasCheckedBluetoothAvailability = true;

    const checkAvailability = async () => {
      try {
        // @ts-ignore
        if (navigator.bluetooth.getAvailability) {
          // @ts-ignore
          const available = await navigator.bluetooth.getAvailability();
          if (isMountedRef.current) setIsEnabled(available);
        }
      } catch {
        // Silent fail - assume available
      }
    };

    checkAvailability();

    // @ts-ignore
    if (navigator.bluetooth?.addEventListener) {
      const handleAvailabilityChange = (event: any) => {
        if (isMountedRef.current) setIsEnabled(event.value);
      };
      // @ts-ignore
      navigator.bluetooth.addEventListener('availabilitychanged', handleAvailabilityChange);
      return () => {
        isMountedRef.current = false;
        // @ts-ignore
        navigator.bluetooth.removeEventListener('availabilitychanged', handleAvailabilityChange);
      };
    }

    return () => { isMountedRef.current = false; };
  }, [isSupported]);

  // ---------------------------------------------------------------------------
  // Meta Glasses listeners (connection changes)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!metaGlasses.pluginAvailable || !MetaGlasses) return;

    let removeListener: (() => void) | null = null;

    MetaGlasses.addListener('onConnectionChanged', (data: any) => {
      if (!isMountedRef.current) return;
      setMetaGlasses(prev => ({
        ...prev,
        isConnected: data.connected,
        deviceName: data.deviceName || null,
        isSessionActive: data.connected ? prev.isSessionActive : false,
      }));
    }).then((handle: any) => {
      removeListener = handle?.remove || null;
    });

    return () => { removeListener?.(); };
  }, [metaGlasses.pluginAvailable]);

  // ---------------------------------------------------------------------------
  // Existing Bluetooth handlers (ALL UNCHANGED below this line)
  // ---------------------------------------------------------------------------
  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    if (!isMountedRef.current) return;
    setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setAvailableDevices(prev =>
      prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)
    );
    toast.info('Bluetooth device disconnected');
  }, []);

  const requestDevice = useCallback(async (): Promise<BluetoothDevice | null> => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser');
      toast.error('Bluetooth not supported', { description: 'Please use Chrome, Edge, or Opera' });
      return null;
    }
    setError(null);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_SERVICES,
      });
      deviceRefs.current.set(device.id, device);
      const deviceInfo: BluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        type: detectDeviceType(device.name || ''),
        connected: false,
        device,
      };
      if (isMountedRef.current) {
        setAvailableDevices(prev => {
          const exists = prev.some(d => d.id === device.id);
          if (exists) return prev.map(d => d.id === device.id ? deviceInfo : d);
          return [...prev, deviceInfo];
        });
      }
      device.addEventListener('gattserverdisconnected', () => {
        handleDeviceDisconnected(device.id);
      });
      saveRememberedDevice(device.id, device.name || 'Unknown Device');
      return deviceInfo;
    } catch (e: any) {
      if (e.name === 'NotFoundError') return null;
      if (isMountedRef.current) setError(e.message || 'Failed to request device');
      toast.error('Bluetooth error', { description: e.message });
      return null;
    }
  }, [isSupported, handleDeviceDisconnected]);

  const startScan = useCallback(async (): Promise<void> => {
    setIsScanning(true);
    setError(null);
    const device = await requestDevice();
    if (isMountedRef.current) setIsScanning(false);
    if (device) toast.success(`Found: ${device.name}`);
  }, [requestDevice]);

  const stopScan = useCallback((): void => {
    setIsScanning(false);
    if (scanAbortController.current) {
      scanAbortController.current.abort();
      scanAbortController.current = null;
    }
  }, []);

  const connectDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    setError(null);
    const deviceInfo = availableDevices.find(d => d.id === deviceId);
    if (!deviceInfo?.device) {
      setError('Device not found');
      toast.error('Device not found');
      return false;
    }
    try {
      const gatt = await deviceInfo.device.gatt?.connect();
      if (!gatt) throw new Error('Could not connect to device');
      const connectedInfo: BluetoothDevice = { ...deviceInfo, connected: true, gatt };
      if (isMountedRef.current) {
        setConnectedDevices(prev => [...prev.filter(d => d.id !== deviceId), connectedInfo]);
        setAvailableDevices(prev => prev.map(d => d.id === deviceId ? connectedInfo : d));
      }
      if ('vibrate' in navigator) navigator.vibrate([50, 50, 50]);
      toast.success(`Connected to ${deviceInfo.name}`);
      return true;
    } catch (e: any) {
      if (isMountedRef.current) setError(e.message || 'Failed to connect');
      toast.error('Connection failed', { description: e.message });
      return false;
    }
  }, [availableDevices]);

  const disconnectDevice = useCallback(async (deviceId: string): Promise<void> => {
    const deviceInfo = connectedDevices.find(d => d.id === deviceId);
    if (deviceInfo?.gatt?.connected) deviceInfo.gatt.disconnect();
    if (isMountedRef.current) {
      setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
      setAvailableDevices(prev => prev.map(d => d.id === deviceId ? { ...d, connected: false } : d));
    }
    toast.info('Device disconnected');
  }, [connectedDevices]);

  const forgetDevice = useCallback((deviceId: string): void => {
    disconnectDevice(deviceId);
    if (isMountedRef.current) setAvailableDevices(prev => prev.filter(d => d.id !== deviceId));
    removeRememberedDevice(deviceId);
    deviceRefs.current.delete(deviceId);
    toast.info('Device forgotten');
  }, [disconnectDevice]);

  // ---------------------------------------------------------------------------
  // Meta Glasses methods (NEW)
  // ---------------------------------------------------------------------------

  const registerMetaGlasses = useCallback(async (): Promise<boolean> => {
    if (!MetaGlasses) return false;
    setMetaGlasses(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await MetaGlasses.register();
      setMetaGlasses(prev => ({
        ...prev,
        isRegistered: result.success,
        isLoading: false,
        error: result.success ? null : (result.error || 'Registration failed'),
      }));
      if (result.success) toast.success('Registered with Meta AI');
      else toast.error(result.error || 'Registration failed');
      return result.success;
    } catch (e: any) {
      setMetaGlasses(prev => ({ ...prev, isLoading: false, error: e.message }));
      toast.error('Registration error', { description: e.message });
      return false;
    }
  }, []);

  const forgetMetaGlasses = useCallback(async (): Promise<void> => {
    if (!MetaGlasses) {
      // Not in Capacitor — just reset local state
      setMetaGlasses(INITIAL_META_STATE);
      return;
    }
    setMetaGlasses(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await MetaGlasses.unregister();
      setMetaGlasses({
        ...INITIAL_META_STATE,
        pluginAvailable: true, // SDK is still available, just reset
      });
      toast.info('Glasses disconnected from TagnetIQ', {
        description: 'To fully unregister, use the Meta AI app',
      });
    } catch (e: any) {
      setMetaGlasses(prev => ({ ...prev, isLoading: false, error: e.message }));
      toast.error('Failed to disconnect glasses');
    }
  }, []);

  const requestGlassesCameraPermission = useCallback(async (): Promise<boolean> => {
    if (!MetaGlasses) return false;
    setMetaGlasses(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await MetaGlasses.requestCameraPermission();
      setMetaGlasses(prev => ({
        ...prev,
        cameraPermissionGranted: result.granted,
        isLoading: false,
        error: result.granted ? null : (result.error || 'Permission denied'),
      }));
      if (result.granted) toast.success('Camera permission granted');
      return result.granted;
    } catch (e: any) {
      setMetaGlasses(prev => ({ ...prev, isLoading: false, error: e.message }));
      return false;
    }
  }, []);

  const startGlassesSession = useCallback(async (): Promise<boolean> => {
    if (!MetaGlasses) return false;
    setMetaGlasses(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await MetaGlasses.startSession({ resolution: '720p', frameRate: 30 });
      if (result.success) {
        const status = await MetaGlasses.getStatus();
        setMetaGlasses(prev => ({
          ...prev,
          isConnected: true,
          isSessionActive: true,
          deviceName: status.deviceName,
          isLoading: false,
        }));
        toast.success('Glasses camera active');
      } else {
        setMetaGlasses(prev => ({ ...prev, isLoading: false, error: result.error }));
      }
      return result.success;
    } catch (e: any) {
      setMetaGlasses(prev => ({ ...prev, isLoading: false, error: e.message }));
      return false;
    }
  }, []);

  const stopGlassesSession = useCallback(async (): Promise<void> => {
    if (!MetaGlasses) return;
    try {
      await MetaGlasses.stopSession();
      setMetaGlasses(prev => ({ ...prev, isSessionActive: false }));
    } catch {
      // Best effort
    }
  }, []);

  const captureGlassesFrame = useCallback(async () => {
    if (!MetaGlasses) return null;
    try {
      return await MetaGlasses.captureFrame({ quality: 75, maxWidth: 1280 });
    } catch {
      return null;
    }
  }, []);

  const refreshGlassesStatus = useCallback(async () => {
    if (!MetaGlasses) return;
    try {
      const status = await MetaGlasses.getStatus();
      setMetaGlasses(prev => ({
        ...prev,
        isRegistered: status.isRegistered,
        cameraPermissionGranted: status.cameraPermissionGranted,
        isConnected: status.isConnected,
        isSessionActive: status.isSessionActive,
        deviceName: status.deviceName,
        batteryLevel: status.batteryLevel,
      }));
    } catch {
      // Silent
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      connectedDevices.forEach(device => {
        if (device.gatt?.connected) device.gatt.disconnect();
      });
    };
  }, [connectedDevices]);

  return {
    // Existing (UNCHANGED)
    isSupported,
    isEnabled,
    isScanning,
    availableDevices,
    connectedDevices,
    connectedDevice: connectedDevices.length > 0 ? connectedDevices[0] : null,
    error,
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    forgetDevice,
    requestDevice,

    // Meta Glasses (NEW)
    metaGlasses,
    registerMetaGlasses,
    forgetMetaGlasses,
    requestGlassesCameraPermission,
    startGlassesSession,
    stopGlassesSession,
    captureGlassesFrame,
    refreshGlassesStatus,
  };
}

export default useBluetoothManager;