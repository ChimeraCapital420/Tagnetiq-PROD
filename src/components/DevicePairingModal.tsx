import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bluetooth, Glasses } from 'lucide-react';

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DevicePairingModal: React.FC<DevicePairingModalProps> = ({ isOpen, onClose }) => {
  const devices = [
    { name: 'Ray-Ban Meta', status: 'Available', battery: '85%' },
    { name: 'Vuzix Blade 2', status: 'Connected', battery: '92%' },
    { name: 'NuEyes Pro', status: 'Available', battery: '67%' },
    { name: 'RealWear Navigator', status: 'Available', battery: '78%' }
  ];

  const handleConnect = (deviceName: string) => {
    // Simulate connection
    console.log(`Connecting to ${deviceName}`);
  };

  const handleBluetoothSearch = () => {
    // Simulate Bluetooth search
    console.log('Starting Bluetooth search...');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Device Pairing
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Compatible smart glasses devices
          </div>
          
          {devices.map((device, index) => (
            <Card key={index} className="p-3">
              <CardContent className="p-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-gray-500">
                      {device.status} • Battery: {device.battery}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={device.status === 'Connected' ? 'secondary' : 'default'}
                    onClick={() => handleConnect(device.name)}
                  >
                    {device.status === 'Connected' ? 'Connected' : 'Connect'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button
            className="w-full"
            variant="outline"
            onClick={handleBluetoothSearch}
          >
            <Bluetooth className="w-4 h-4 mr-2" />
            Connect New Device
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DevicePairingModal;