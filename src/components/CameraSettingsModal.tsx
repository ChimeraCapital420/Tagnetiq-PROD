// FILE: src/components/CameraSettingsModal.tsx (RE-ENGINEERED)

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Zap, Sun, Wifi, Video } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDevices: MediaDeviceInfo[];
  onDeviceChange: (deviceId: string) => void;
  currentDeviceId: string | undefined;
}

const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({ isOpen, onClose, availableDevices, onDeviceChange, currentDeviceId }) => {
  if (!isOpen) return null;

  const handlePlaceholderClick = (feature: string) => {
    toast.info(`${feature} control coming soon!`);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pro Camera & Device Settings</CardTitle>
              <CardDescription>Fine-tune your capture experience.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="camera">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera">Camera Controls</TabsTrigger>
              <TabsTrigger value="glasses">Smart Devices</TabsTrigger>
            </TabsList>
            <TabsContent value="camera" className="mt-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="camera-select" className="flex items-center gap-3"><Video className="w-5 h-5" /> Camera Source</Label>
                    <Select onValueChange={onDeviceChange} value={currentDeviceId}>
                        <SelectTrigger id="camera-select">
                            <SelectValue placeholder="Select a camera..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableDevices.map((device, index) => (
                                <SelectItem key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Camera ${index + 1}`}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="torch-mode" className="flex items-center gap-3">
                        <Zap className="w-5 h-5" />
                        <span>Flashlight / Torch</span>
                    </Label>
                    <Switch id="torch-mode" onClick={() => handlePlaceholderClick('Flashlight')} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="hdr-mode" className="flex items-center gap-3">
                        <Sun className="w-5 h-5" />
                        <span>HDR Mode</span>
                    </Label>
                    <Switch id="hdr-mode" onClick={() => handlePlaceholderClick('HDR')} />
                </div>
            </TabsContent>
            <TabsContent value="glasses" className="mt-4 text-center">
                <Wifi className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="font-semibold mt-4">Pair External Device</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    Connect smart glasses, a GoPro, or other Bluetooth cameras for advanced scanning scenarios.
                </p>
                <Button className="mt-4" onClick={() => handlePlaceholderClick('Smart Device Pairing')}>
                    Begin Pairing
                </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CameraSettingsModal;
