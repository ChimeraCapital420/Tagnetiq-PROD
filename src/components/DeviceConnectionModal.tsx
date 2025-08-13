import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Bluetooth, Loader2, CheckCircle, Glasses } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: string;
  connected: boolean;
}

interface DeviceConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceConnected: (device: Device) => void;
}

const DeviceConnectionModal: React.FC<DeviceConnectionModalProps> = ({
  open,
  onOpenChange,
  onDeviceConnected
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  const deviceFamilies = [
    { name: 'Ray-Ban Meta', icon: '🕶️' },
    { name: 'Vuzix', icon: '👓' },
    { name: 'RealWear', icon: '🥽' },
    { name: 'NuEyes', icon: '👁️' }
  ];

  const mockDevices: Device[] = [
    { id: '1', name: 'Ray-Ban Meta Glasses', type: 'Ray-Ban Meta', connected: false },
    { id: '2', name: 'Vuzix Blade 2', type: 'Vuzix', connected: false },
    { id: '3', name: 'RealWear Navigator 520', type: 'RealWear', connected: false },
    { id: '4', name: 'NuEyes Pro 3e', type: 'NuEyes', connected: false }
  ];

  const startScanning = () => {
    setIsScanning(true);
    setDevices([]);
    
    // Simulate device discovery
    setTimeout(() => {
      setDevices(mockDevices);
      setIsScanning(false);
    }, 3000);
  };

  const connectDevice = (device: Device) => {
    const updatedDevice = { ...device, connected: true };
    setConnectedDevice(updatedDevice);
    onDeviceConnected(updatedDevice);
    
    setTimeout(() => {
      onOpenChange(false);
    }, 1500);
  };

  useEffect(() => {
    if (open) {
      setDevices([]);
      setConnectedDevice(null);
      setIsScanning(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Glasses className="h-5 w-5" />
            Connect a Device
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Compatible Hardware Families</h4>
            <div className="grid grid-cols-2 gap-2">
              {deviceFamilies.map((family) => (
                <Badge key={family.name} variant="outline" className="p-2 justify-center">
                  <span className="mr-1">{family.icon}</span>
                  {family.name}
                </Badge>
              ))}
            </div>
          </div>

          {!isScanning && devices.length === 0 && (
            <Button onClick={startScanning} className="w-full">
              <Bluetooth className="mr-2 h-4 w-4" />
              Scan for Devices
            </Button>
          )}

          {isScanning && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Scanning for nearby devices...</p>
            </div>
          )}

          {devices.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Devices</h4>
              {devices.map((device) => (
                <Card key={device.id} className="cursor-pointer hover:bg-accent/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{device.name}</p>
                        <p className="text-sm text-muted-foreground">{device.type}</p>
                      </div>
                      {connectedDevice?.id === device.id ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => connectDevice(device)}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceConnectionModal;