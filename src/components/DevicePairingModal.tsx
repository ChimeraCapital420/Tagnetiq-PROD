// FILE: src/components/DevicePairingModal.tsx
// PROJECT CERULEAN: Bluetooth Device Pairing UI

import React from 'react';
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
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { toast } from 'sonner';

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceConnected?: (device: any) => void;
}

const DevicePairingModal: React.FC<DevicePairingModalProps> = ({ 
  isOpen, 
  onClose,
  onDeviceConnected 
}) => {
  const {
    isScanning,
    availableDevices,  // Changed from discoveredDevices
    connectedDevices,  // Changed from connectedDevice (now array)
    isSupported,       // Changed from isBluetoothSupported
    isEnabled,         // Added for checking if Bluetooth is enabled
    startScan,
    stopScan,
    connectDevice,     // Changed from connectToDevice
    disconnectDevice,  // Changed from disconnect
  } = useBluetoothManager();

  // Since connectedDevices is now an array, get the first one for compatibility
  const connectedDevice = connectedDevices.length > 0 ? connectedDevices[0] : null;
  const error = !isEnabled && isSupported ? 'Bluetooth is disabled on this device' : null;

  const handleConnect = async (deviceId: string) => {
    await connectDevice(deviceId);
    if (onDeviceConnected) {
      const device = availableDevices.find(d => d.id === deviceId);
      if (device) {
        onDeviceConnected(device);
      }
    }
  };

  const handleDisconnect = async () => {
    if (connectedDevice) {
      await disconnectDevice(connectedDevice.id);
    }
  };

  const getDeviceIcon = (deviceName: string) => {
    const name = (deviceName || '').toLowerCase();
    if (name.includes('camera') || name.includes('gopro') || name.includes('dji')) {
      return <Camera className="w-5 h-5" />;
    }
    if (name.includes('glasses') || name.includes('ray-ban') || name.includes('meta')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Video className="w-5 h-5" />;
  };

  const getDeviceType = (deviceName: string) => {
    const name = (deviceName || '').toLowerCase();
    if (name.includes('glasses')) return 'Smart Glasses';
    if (name.includes('camera')) return 'Camera';
    if (name.includes('gopro')) return 'Action Camera';
    return 'Device';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bluetooth className="w-5 h-5 text-blue-500" />
            Pair Bluetooth Device
          </DialogTitle>
          <DialogDescription>
            Connect external cameras, smart glasses, and other devices to enhance your scanning capabilities.
          </DialogDescription>
        </DialogHeader>

        {!isSupported && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or Opera on desktop, or Chrome on Android.
            </AlertDescription>
          </Alert>
        )}

        {isSupported && !isEnabled && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Bluetooth is disabled on this device. Please enable Bluetooth to continue.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {connectedDevice && (
          <Card className="mb-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                    <Wifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {connectedDevice.name || 'Unknown Device'}
                      <Badge variant="default" className="bg-green-600">Connected</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getDeviceType(connectedDevice.name || '')}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {isSupported && isEnabled && (
            <div className="flex justify-center">
              <Button
                onClick={isScanning ? stopScan : startScan}
                disabled={!isSupported || !isEnabled}
                size="lg"
                className="w-full sm:w-auto"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Stop Scanning
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Scan for Devices
                  </>
                )}
              </Button>
            </div>
          )}

          {isScanning && (
            <div className="space-y-2">
              <Progress value={undefined} className="w-full animate-pulse" />
              <p className="text-sm text-center text-muted-foreground">
                Searching for nearby devices...
              </p>
            </div>
          )}

          {availableDevices && availableDevices.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Discovered Devices</h4>
                {availableDevices.map((device) => (
                  <Card key={device.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted rounded-full">
                            {getDeviceIcon(device.name || '')}
                          </div>
                          <div>
                            <p className="font-medium">{device.name || 'Unknown Device'}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {device.id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                        {connectedDevice?.id === device.id ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleConnect(device.id)}
                            disabled={!!connectedDevice}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {!isScanning && (!availableDevices || availableDevices.length === 0) && isSupported && isEnabled && (
            <div className="text-center py-8">
              <WifiOff className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                No devices found. Click "Scan for Devices" to search.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Make sure your device is in pairing mode.
              </p>
            </div>
          )}
        </div>

        <Separator className="mt-6" />
        
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-2">Supported Devices:</p>
          <ul className="space-y-1 text-xs">
            <li>• Ray-Ban Meta Smart Glasses</li>
            <li>• GoPro cameras with Bluetooth</li>
            <li>• DJI Pocket cameras</li>
            <li>• Bluetooth-enabled webcams</li>
            <li>• Other compatible video devices</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DevicePairingModal;