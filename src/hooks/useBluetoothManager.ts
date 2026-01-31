// FILE: src/hooks/useBluetoothManager.ts
// Real Web Bluetooth API integration for external cameras and devices
// Mobile-first with battery optimization and connection persistence

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

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

export interface UseBluetoothManagerReturn {
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
// HOOK
// =============================================================================

export function useBluetoothManager(): UseBluetoothManagerReturn {
  const [isSupported] = useState<boolean>(checkBluetoothSupport());
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const scanAbortController = useRef<AbortController | null>(null);
  const deviceRefs = useRef<Map<string, globalThis.BluetoothDevice>>(new Map());

  // ---------------------------------------------------------------------------
  // Check Bluetooth availability on mount (runs once per page load)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!isSupported) {
      return;
    }

    // Guard: Only check once per page load (module-level)
    if (hasCheckedBluetoothAvailability) {
      return;
    }
    hasCheckedBluetoothAvailability = true;

    const checkAvailability = async () => {
      try {
        // @ts-ignore - getAvailability is not in all TypeScript definitions
        if (navigator.bluetooth.getAvailability) {
          // @ts-ignore
          const available = await navigator.bluetooth.getAvailability();
          if (isMountedRef.current) {
            setIsEnabled(available);
          }
        }
      } catch {
        // Silent fail - assume available
      }
    };

    checkAvailability();

    // Listen for availability changes
    // @ts-ignore
    if (navigator.bluetooth?.addEventListener) {
      const handleAvailabilityChange = (event: any) => {
        if (isMountedRef.current) {
          setIsEnabled(event.value);
        }
      };
      // @ts-ignore
      navigator.bluetooth.addEventListener('availabilitychanged', handleAvailabilityChange);
      
      return () => {
        isMountedRef.current = false;
        // @ts-ignore
        navigator.bluetooth.removeEventListener('availabilitychanged', handleAvailabilityChange);
      };
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [isSupported]);

  // ---------------------------------------------------------------------------
  // Handle device disconnection events
  // ---------------------------------------------------------------------------
  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    if (!isMountedRef.current) return;
    
    setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setAvailableDevices(prev => 
      prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)
    );
    
    toast.info('Bluetooth device disconnected');
  }, []);

  // ---------------------------------------------------------------------------
  // Request device (opens browser's Bluetooth picker)
  // ---------------------------------------------------------------------------
  const requestDevice = useCallback(async (): Promise<BluetoothDevice | null> => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser');
      toast.error('Bluetooth not supported', {
        description: 'Please use Chrome, Edge, or Opera'
      });
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
          if (exists) {
            return prev.map(d => d.id === device.id ? deviceInfo : d);
          }
          return [...prev, deviceInfo];
        });
      }

      device.addEventListener('gattserverdisconnected', () => {
        handleDeviceDisconnected(device.id);
      });

      saveRememberedDevice(device.id, device.name || 'Unknown Device');

      return deviceInfo;

    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        // User cancelled - not an error
        return null;
      }
      
      if (isMountedRef.current) {
        setError(e.message || 'Failed to request device');
      }
      toast.error('Bluetooth error', { description: e.message });
      return null;
    }
  }, [isSupported, handleDeviceDisconnected]);

  // ---------------------------------------------------------------------------
  // Start scanning
  // ---------------------------------------------------------------------------
  const startScan = useCallback(async (): Promise<void> => {
    setIsScanning(true);
    setError(null);

    const device = await requestDevice();
    
    if (isMountedRef.current) {
      setIsScanning(false);
    }
    
    if (device) {
      toast.success(`Found: ${device.name}`);
    }
  }, [requestDevice]);

  // ---------------------------------------------------------------------------
  // Stop scanning
  // ---------------------------------------------------------------------------
  const stopScan = useCallback((): void => {
    setIsScanning(false);
    
    if (scanAbortController.current) {
      scanAbortController.current.abort();
      scanAbortController.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Connect to device
  // ---------------------------------------------------------------------------
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
      
      if (!gatt) {
        throw new Error('Could not connect to device');
      }

      const connectedInfo: BluetoothDevice = {
        ...deviceInfo,
        connected: true,
        gatt,
      };

      if (isMountedRef.current) {
        setConnectedDevices(prev => [...prev.filter(d => d.id !== deviceId), connectedInfo]);
        setAvailableDevices(prev => 
          prev.map(d => d.id === deviceId ? connectedInfo : d)
        );
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }

      toast.success(`Connected to ${deviceInfo.name}`);
      return true;

    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e.message || 'Failed to connect');
      }
      toast.error('Connection failed', { description: e.message });
      return false;
    }
  }, [availableDevices]);

  // ---------------------------------------------------------------------------
  // Disconnect from device
  // ---------------------------------------------------------------------------
  const disconnectDevice = useCallback(async (deviceId: string): Promise<void> => {
    const deviceInfo = connectedDevices.find(d => d.id === deviceId);
    if (deviceInfo?.gatt?.connected) {
      deviceInfo.gatt.disconnect();
    }

    if (isMountedRef.current) {
      setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
      setAvailableDevices(prev => 
        prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)
      );
    }

    toast.info('Device disconnected');
  }, [connectedDevices]);

  // ---------------------------------------------------------------------------
  // Forget device
  // ---------------------------------------------------------------------------
  const forgetDevice = useCallback((deviceId: string): void => {
    disconnectDevice(deviceId);
    
    if (isMountedRef.current) {
      setAvailableDevices(prev => prev.filter(d => d.id !== deviceId));
    }
    
    removeRememberedDevice(deviceId);
    deviceRefs.current.delete(deviceId);

    toast.info('Device forgotten');
  }, [disconnectDevice]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      connectedDevices.forEach(device => {
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      });
    };
  }, [connectedDevices]);

  return {
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
  };
}

export default useBluetoothManager;