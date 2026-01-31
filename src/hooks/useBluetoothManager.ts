// FILE: src/hooks/useBluetoothManager.ts
// Real Web Bluetooth API integration for external cameras and devices
// Mobile-first with battery optimization and connection persistence

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

// =============================================================================
// DEVICE TYPE DETECTION
// =============================================================================

const CAMERA_DEVICE_PATTERNS = [
  'gopro', 'dji', 'insta360', 'camera', 'webcam',
  'ray-ban', 'meta', 'glasses', 'scanner', 'microscope',
];

function detectDeviceType(name: string): 'camera' | 'scanner' | 'glasses' | 'unknown' {
  const lower = (name || '').toLowerCase();
  if (lower.includes('gopro') || lower.includes('dji') || lower.includes('camera')) return 'camera';
  if (lower.includes('ray-ban') || lower.includes('meta') || lower.includes('glasses')) return 'glasses';
  if (lower.includes('scanner') || lower.includes('barcode')) return 'scanner';
  return 'unknown';
}

// =============================================================================
// TYPES
// =============================================================================

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
  device?: BluetoothDevice;
  gatt?: BluetoothRemoteGATTServer;
}

export interface UseBluetoothManagerReturn {
  // State
  isSupported: boolean;
  isEnabled: boolean;
  isScanning: boolean;
  availableDevices: BluetoothDeviceInfo[];
  connectedDevices: BluetoothDeviceInfo[];
  connectedDevice: BluetoothDeviceInfo | null; // Convenience for single device
  error: string | null;
  
  // Actions
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  forgetDevice: (deviceId: string) => void;
  requestDevice: () => Promise<BluetoothDeviceInfo | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Bluetooth services we're interested in (cameras, video devices)
const BLUETOOTH_SERVICES = [
  // Generic services
  'generic_access',
  'device_information',
  // Camera-related (custom UUIDs vary by manufacturer)
  // GoPro uses custom services
  // '0000fea6-0000-1000-8000-00805f9b34fb', // GoPro WiFi AP service
];

// Storage key for remembered devices
const STORAGE_KEY = 'bluetooth_paired_devices';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if Web Bluetooth API is supported
 */
function checkBluetoothSupport(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Load remembered devices from localStorage
 */
function loadRememberedDevices(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save device to remembered devices
 */
function saveRememberedDevice(deviceId: string, deviceName: string): void {
  try {
    const stored = loadRememberedDevices();
    const devices = stored.filter(id => id !== deviceId);
    devices.unshift(deviceId); // Most recent first
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices.slice(0, 10))); // Keep last 10
    
    // Also store device names for display
    const names = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_names`) || '{}');
    names[deviceId] = deviceName;
    localStorage.setItem(`${STORAGE_KEY}_names`, JSON.stringify(names));
  } catch (e) {
    console.warn('📶 [BLUETOOTH] Could not save device:', e);
  }
}

/**
 * Remove device from remembered devices
 */
function removeRememberedDevice(deviceId: string): void {
  try {
    const stored = loadRememberedDevices();
    const devices = stored.filter(id => id !== deviceId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
    
    const names = JSON.parse(localStorage.getItem(`${STORAGE_KEY}_names`) || '{}');
    delete names[deviceId];
    localStorage.setItem(`${STORAGE_KEY}_names`, JSON.stringify(names));
  } catch (e) {
    console.warn('📶 [BLUETOOTH] Could not remove device:', e);
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useBluetoothManager(): UseBluetoothManagerReturn {
  // State
  const [isSupported] = useState<boolean>(checkBluetoothSupport());
  const [isEnabled, setIsEnabled] = useState<boolean>(true); // Assume enabled until we know otherwise
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [availableDevices, setAvailableDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const scanAbortController = useRef<AbortController | null>(null);
  const deviceRefs = useRef<Map<string, BluetoothDevice>>(new Map());

  // ---------------------------------------------------------------------------
  // Check Bluetooth availability on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupported) {
      console.log('📶 [BLUETOOTH] Web Bluetooth not supported in this browser');
      return;
    }

    // Check if Bluetooth is available
    const checkAvailability = async () => {
      try {
        // @ts-ignore - getAvailability is not in all TypeScript definitions
        if (navigator.bluetooth.getAvailability) {
          // @ts-ignore
          const available = await navigator.bluetooth.getAvailability();
          setIsEnabled(available);
          console.log(`📶 [BLUETOOTH] Availability: ${available}`);
        }
      } catch (e) {
        console.log('📶 [BLUETOOTH] Could not check availability:', e);
      }
    };

    checkAvailability();

    // Listen for availability changes
    // @ts-ignore
    if (navigator.bluetooth.addEventListener) {
      const handleAvailabilityChange = (event: any) => {
        setIsEnabled(event.value);
        console.log(`📶 [BLUETOOTH] Availability changed: ${event.value}`);
      };
      // @ts-ignore
      navigator.bluetooth.addEventListener('availabilitychanged', handleAvailabilityChange);
      return () => {
        // @ts-ignore
        navigator.bluetooth.removeEventListener('availabilitychanged', handleAvailabilityChange);
      };
    }
  }, [isSupported]);

  // ---------------------------------------------------------------------------
  // Handle device disconnection events
  // ---------------------------------------------------------------------------
  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    console.log(`📶 [BLUETOOTH] Device disconnected: ${deviceId}`);
    
    setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setAvailableDevices(prev => 
      prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)
    );
    
    toast.info('Bluetooth device disconnected');
  }, []);

  // ---------------------------------------------------------------------------
  // Request device (opens browser's Bluetooth picker)
  // ---------------------------------------------------------------------------
  const requestDevice = useCallback(async (): Promise<BluetoothDeviceInfo | null> => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser');
      toast.error('Bluetooth not supported', {
        description: 'Please use Chrome, Edge, or Opera'
      });
      return null;
    }

    console.log('📶 [BLUETOOTH] Requesting device...');
    setError(null);

    try {
      // Request device with filters
      // Using acceptAllDevices for broader compatibility
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BLUETOOTH_SERVICES,
      });

      console.log(`📶 [BLUETOOTH] Device selected: ${device.name} (${device.id})`);

      // Store device reference
      deviceRefs.current.set(device.id, device);

      // Create device info
      const deviceInfo: BluetoothDeviceInfo = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false,
        device,
      };

      // Add to available devices if not already there
      setAvailableDevices(prev => {
        const exists = prev.some(d => d.id === device.id);
        if (exists) {
          return prev.map(d => d.id === device.id ? deviceInfo : d);
        }
        return [...prev, deviceInfo];
      });

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        handleDeviceDisconnected(device.id);
      });

      // Save for reconnection
      saveRememberedDevice(device.id, device.name || 'Unknown Device');

      return deviceInfo;

    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        // User cancelled the picker
        console.log('📶 [BLUETOOTH] User cancelled device selection');
        return null;
      }
      
      console.error('📶 [BLUETOOTH] Request device error:', e);
      setError(e.message || 'Failed to request device');
      toast.error('Bluetooth error', { description: e.message });
      return null;
    }
  }, [isSupported, handleDeviceDisconnected]);

  // ---------------------------------------------------------------------------
  // Start scanning (uses requestDevice since Web Bluetooth doesn't have passive scan)
  // ---------------------------------------------------------------------------
  const startScan = useCallback(async (): Promise<void> => {
    console.log('📶 [BLUETOOTH] Starting scan...');
    setIsScanning(true);
    setError(null);

    // Web Bluetooth doesn't support passive scanning
    // We use requestDevice which opens the browser picker
    const device = await requestDevice();
    
    setIsScanning(false);
    
    if (device) {
      toast.success(`Found: ${device.name}`);
    }
  }, [requestDevice]);

  // ---------------------------------------------------------------------------
  // Stop scanning
  // ---------------------------------------------------------------------------
  const stopScan = useCallback((): void => {
    console.log('📶 [BLUETOOTH] Stopping scan...');
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
    console.log(`📶 [BLUETOOTH] Connecting to device: ${deviceId}`);
    setError(null);

    // Find device in available devices
    const deviceInfo = availableDevices.find(d => d.id === deviceId);
    if (!deviceInfo?.device) {
      setError('Device not found');
      toast.error('Device not found');
      return false;
    }

    try {
      // Connect to GATT server
      console.log('📶 [BLUETOOTH] Connecting to GATT server...');
      const gatt = await deviceInfo.device.gatt?.connect();
      
      if (!gatt) {
        throw new Error('Could not connect to device');
      }

      console.log('📶 [BLUETOOTH] Connected to GATT server');

      // Update device info
      const connectedInfo: BluetoothDeviceInfo = {
        ...deviceInfo,
        connected: true,
        gatt,
      };

      // Update state
      setConnectedDevices(prev => [...prev.filter(d => d.id !== deviceId), connectedInfo]);
      setAvailableDevices(prev => 
        prev.map(d => d.id === deviceId ? connectedInfo : d)
      );

      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 50, 50]);
      }

      toast.success(`Connected to ${deviceInfo.name}`);
      return true;

    } catch (e: any) {
      console.error('📶 [BLUETOOTH] Connect error:', e);
      setError(e.message || 'Failed to connect');
      toast.error('Connection failed', { description: e.message });
      return false;
    }
  }, [availableDevices]);

  // ---------------------------------------------------------------------------
  // Disconnect from device
  // ---------------------------------------------------------------------------
  const disconnectDevice = useCallback(async (deviceId: string): Promise<void> => {
    console.log(`📶 [BLUETOOTH] Disconnecting from device: ${deviceId}`);

    const deviceInfo = connectedDevices.find(d => d.id === deviceId);
    if (deviceInfo?.gatt?.connected) {
      deviceInfo.gatt.disconnect();
    }

    setConnectedDevices(prev => prev.filter(d => d.id !== deviceId));
    setAvailableDevices(prev => 
      prev.map(d => d.id === deviceId ? { ...d, connected: false } : d)
    );

    toast.info('Device disconnected');
  }, [connectedDevices]);

  // ---------------------------------------------------------------------------
  // Forget device (remove from remembered devices)
  // ---------------------------------------------------------------------------
  const forgetDevice = useCallback((deviceId: string): void => {
    console.log(`📶 [BLUETOOTH] Forgetting device: ${deviceId}`);
    
    // Disconnect if connected
    disconnectDevice(deviceId);
    
    // Remove from available devices
    setAvailableDevices(prev => prev.filter(d => d.id !== deviceId));
    
    // Remove from storage
    removeRememberedDevice(deviceId);
    
    // Remove from refs
    deviceRefs.current.delete(deviceId);

    toast.info('Device forgotten');
  }, [disconnectDevice]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      // Disconnect all devices on unmount
      connectedDevices.forEach(device => {
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      });
    };
  }, [connectedDevices]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    // State
    isSupported,
    isEnabled,
    isScanning,
    availableDevices,
    connectedDevices,
    connectedDevice: connectedDevices.length > 0 ? connectedDevices[0] : null,
    error,
    
    // Actions
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    forgetDevice,
    requestDevice,
  };
}

export default useBluetoothManager;