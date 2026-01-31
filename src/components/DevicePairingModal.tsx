// FILE: src/components/DevicePairingModal.tsx
// Bluetooth Device Pairing UI - Real Web Bluetooth integration
// Mobile-first: touch-friendly, clear status, graceful degradation

import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bluetooth,
  Loader2,
  Smartphone,
  Camera,
  Video,
  Scan,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  BatteryMedium,
} from 'lucide-react';
import { useBluetoothManager, type BluetoothDevice } from '@/hooks/useBluetoothManager';

// =============================================================================
// TYPES
// =============================================================================

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceConnected?: (device: BluetoothDevice) => void;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDeviceIcon(device: BluetoothDevice) {
  switch (device.type) {
    case 'camera':
      return <Camera className="w-5 h-5" />;
    case 'glasses':
      return <Smartphone className="w-5 h-5" />;
    case 'scanner':
      return <Scan className="w-5 h-5" />;
    default:
      return <Video className="w-5 h-5" />;
  }
}

function getDeviceTypeLabel(type: BluetoothDevice['type']): string {
  switch (type) {
    case 'camera':
      return 'Camera';
    case 'glasses':
      return 'Smart Glasses';
    case 'scanner':
      return 'Scanner';
    default:
      return 'Device';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  isOpen,
  onClose,
  onDeviceConnected,
}) => {
  // ---------------------------------------------------------------------------
  // HOOKS
  // ---------------------------------------------------------------------------

  const {
    isSupported,
    isEnabled,
    isScanning,
    availableDevices,
    connectedDevices,
    error,
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    forgetDevice,
  } = useBluetoothManager();

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleScan = useCallback(async () => {
    if (isScanning) {
      stopScan();
    } else {
      await startScan();
    }
  }, [isScanning, startScan, stopScan]);

  const handleConnect = useCallback(async (deviceId: string) => {
    const success = await connectDevice(deviceId);
    if (success && onDeviceConnected) {
      const device = availableDevices.find(d => d.id === deviceId);
      if (device) {
        onDeviceConnected(device);
      }
    }
  }, [connectDevice, availableDevices, onDeviceConnected]);

  const handleDisconnect = useCallback(async (deviceId: string) => {
    await disconnectDevice(deviceId);
  }, [disconnectDevice]);

  const handleForget = useCallback((deviceId: string) => {
    forgetDevice(deviceId);
  }, [forgetDevice]);

  // ---------------------------------------------------------------------------
  // RENDER HELPERS
  // ---------------------------------------------------------------------------

  const renderSupportStatus = () => {
    if (!isSupported) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Web Bluetooth is not supported</strong> in this browser.
            <br />
            Please use <strong>Chrome</strong>, <strong>Edge</strong>, or{' '}
            <strong>Opera</strong> on desktop, or <strong>Chrome on Android</strong>.
          </AlertDescription>
        </Alert>
      );
    }

    if (!isEnabled) {
      return (
        <Alert variant="destructive" className="mb-4">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            <strong>Bluetooth is disabled</strong> on this device.
            <br />
            Please enable Bluetooth in your device settings to continue.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  const renderConnectedDevices = () => {
    if (connectedDevices.length === 0) return null;

    return (
      <div className="space-y-3 mb-4">
        <h4 className="font-medium text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Connected Devices
        </h4>
        {connectedDevices.map((device) => (
          <Card
            key={device.id}
            className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                    <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {device.name}
                      <Badge variant="default" className="bg-green-600">
                        Connected
                      </Badge>
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      {getDeviceTypeLabel(device.type)}
                      {device.batteryLevel !== undefined && (
                        <span className="flex items-center gap-1">
                          <BatteryMedium className="w-3 h-3" />
                          {device.batteryLevel}%
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(device.id)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderAvailableDevices = () => {
    // Filter out connected devices
    const unconnectedDevices = availableDevices.filter(
      (d) => !connectedDevices.some((c) => c.id === d.id)
    );

    if (unconnectedDevices.length === 0 && !isScanning) {
      return null;
    }

    return (
      <>
        {unconnectedDevices.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Available Devices</h4>
              {unconnectedDevices.map((device) => (
                <Card key={device.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-full">
                          {getDeviceIcon(device)}
                        </div>
                        <div>
                          <p className="font-medium">{device.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getDeviceTypeLabel(device.type)} •{' '}
                            {device.id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConnect(device.id)}
                        >
                          Connect
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleForget(device.id)}
                          title="Forget device"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </>
    );
  };

  const renderEmptyState = () => {
    if (
      isScanning ||
      availableDevices.length > 0 ||
      connectedDevices.length > 0
    ) {
      return null;
    }

    return (
      <div className="text-center py-8">
        <Bluetooth className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">No devices found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Click "Scan for Devices" to search for nearby Bluetooth devices.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Make sure your device is powered on and in pairing mode.
        </p>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-blue-500" />
            Bluetooth Devices
          </DialogTitle>
          <DialogDescription>
            Connect external cameras, smart glasses, and other devices to
            enhance your scanning.
          </DialogDescription>
        </DialogHeader>

        {/* Support/Enable Status Alerts */}
        {renderSupportStatus()}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Connected Devices */}
        {renderConnectedDevices()}

        {/* Scan Button */}
        {isSupported && isEnabled && (
          <div className="flex justify-center mb-4">
            <Button
              onClick={handleScan}
              size="lg"
              className="w-full sm:w-auto min-w-[200px]"
              variant={isScanning ? 'outline' : 'default'}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Stop Scanning
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan for Devices
                </>
              )}
            </Button>
          </div>
        )}

        {/* Scanning Progress */}
        {isScanning && (
          <div className="space-y-2 mb-4">
            <Progress value={undefined} className="w-full animate-pulse" />
            <p className="text-sm text-center text-muted-foreground">
              Searching for nearby Bluetooth devices...
            </p>
            <p className="text-xs text-center text-muted-foreground">
              A device picker will appear. Select your device to continue.
            </p>
          </div>
        )}

        {/* Available (Unconnected) Devices */}
        {renderAvailableDevices()}

        {/* Empty State */}
        {renderEmptyState()}

        <Separator className="my-4" />

        {/* Supported Devices Info */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Supported Devices:</p>
          <ul className="space-y-1 text-xs">
            <li className="flex items-center gap-2">
              <Camera className="w-3 h-3" /> GoPro cameras (HERO series)
            </li>
            <li className="flex items-center gap-2">
              <Smartphone className="w-3 h-3" /> Ray-Ban Meta Smart Glasses
            </li>
            <li className="flex items-center gap-2">
              <Video className="w-3 h-3" /> DJI Pocket / Osmo cameras
            </li>
            <li className="flex items-center gap-2">
              <Scan className="w-3 h-3" /> Bluetooth barcode scanners
            </li>
          </ul>
        </div>

        {/* Browser Compatibility Note */}
        {!isSupported && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Browser Support:</strong> Web Bluetooth works in Chrome
              79+, Edge 79+, and Opera 66+ on desktop. On mobile, only Chrome
              for Android is supported. Safari and Firefox do not support Web
              Bluetooth.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DevicePairingModal;