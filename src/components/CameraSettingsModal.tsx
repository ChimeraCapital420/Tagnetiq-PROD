// FILE: src/components/CameraSettingsModal.tsx (POSITIONING FIXED)

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Zap, Sun, Wifi, Video, Camera, Smartphone, Monitor, Bluetooth, Settings2, Maximize, Minimize, RotateCw, Volume2, CheckCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useBluetoothManager } from '@/hooks/useBluetoothManager'; // PROJECT CERULEAN: Added import
import DevicePairingModal from './DevicePairingModal'; // PROJECT CERULEAN: Added import

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDevices: MediaDeviceInfo[];
  onDeviceChange: (deviceId: string) => void;
  currentDeviceId: string | undefined;
}

const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  availableDevices, 
  onDeviceChange, 
  currentDeviceId 
}) => {
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [hdrEnabled, setHdrEnabled] = useState(false);
  const [autoFocus, setAutoFocus] = useState(true);
  const [imageStabilization, setImageStabilization] = useState(true);
  const [brightness, setBrightness] = useState([50]);
  const [contrast, setContrast] = useState([50]);
  const [saturation, setSaturation] = useState([50]);
  const [zoom, setZoom] = useState([1]);
  const [resolution, setResolution] = useState('1920x1080');
  const [frameRate, setFrameRate] = useState('30');
  const [isScanning, setIsScanning] = useState(false);
  const [foundDevices, setFoundDevices] = useState<any[]>([]);
  const [showPairingModal, setShowPairingModal] = useState(false); // PROJECT CERULEAN: Added state
  
  // PROJECT CERULEAN: Bluetooth integration
  const { connectedDevice } = useBluetoothManager();
  const [combinedDevices, setCombinedDevices] = useState<MediaDeviceInfo[]>([]);

  // PROJECT CERULEAN: Merge available devices with Bluetooth device
  useEffect(() => {
    const devices = [...availableDevices];
    
    if (connectedDevice) {
      const bluetoothDevice: MediaDeviceInfo = {
        deviceId: `bluetooth-${connectedDevice.id}`,
        groupId: 'bluetooth',
        kind: 'videoinput',
        label: `${connectedDevice.name} (Bluetooth)`,
        toJSON: () => ({})
      };
      devices.push(bluetoothDevice);
    }
    
    setCombinedDevices(devices);
  }, [availableDevices, connectedDevice]);

  if (!isOpen) return null;

  const handleAdvancedFeature = (feature: string, enabled?: boolean) => {
    if (enabled !== undefined) {
      toast.success(`${feature} ${enabled ? 'enabled' : 'disabled'}`);
    } else {
      toast.info(`${feature} control activated`);
    }
  };

  const startBluetoothScan = async () => {
    setIsScanning(true);
    setFoundDevices([]);
    
    try {
      // Simulate Bluetooth scanning
      setTimeout(() => {
        const mockDevices = [
          { name: 'Ray-Ban Meta Smart Glasses', type: 'glasses', battery: 85, connected: false },
          { name: 'GoPro HERO12 Black', type: 'action-camera', battery: 92, connected: false },
          { name: 'DJI Pocket 2', type: 'handheld-camera', battery: 67, connected: false },
          { name: 'Insta360 GO 3', type: 'tiny-camera', battery: 78, connected: false }
        ];
        setFoundDevices(mockDevices);
        setIsScanning(false);
        toast.success(`Found ${mockDevices.length} compatible devices`);
      }, 3000);
    } catch (error) {
      setIsScanning(false);
      toast.error('Bluetooth scan failed. Ensure devices are in pairing mode.');
    }
  };

  const connectDevice = (device: any) => {
    toast.success(`Connecting to ${device.name}...`);
    setTimeout(() => {
      toast.success(`${device.name} connected successfully!`);
      setFoundDevices(prev => prev.map(d => 
        d.name === device.name ? { ...d, connected: true } : d
      ));
    }, 2000);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'glasses': return <Smartphone className="w-5 h-5" />;
      case 'action-camera': return <Camera className="w-5 h-5" />;
      case 'handheld-camera': return <Video className="w-5 h-5" />;
      case 'tiny-camera': return <Monitor className="w-5 h-5" />;
      default: return <Camera className="w-5 h-5" />;
    }
  };

  // PROJECT CERULEAN: Handle Bluetooth device connected
  const handleBluetoothDeviceConnected = () => {
    setShowPairingModal(false);
    toast.success('Device connected and available as camera source');
  };

  return (
    <>
      <div 
        className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" 
        style={{ zIndex: 9999 }}
        onClick={onClose}
      >
        <Card 
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Professional Camera Suite
                </CardTitle>
                <CardDescription>Advanced controls for professional scanning and recording</CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="camera" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="camera">Camera</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="devices">Devices</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="camera-select" className="flex items-center gap-2">
                      <Video className="w-4 h-4" /> Camera Source
                      {/* PROJECT CERULEAN: Bluetooth indicator */}
                      {connectedDevice && (
                        <span className="text-xs text-blue-500 flex items-center gap-1">
                          <Bluetooth className="w-3 h-3" />
                          Bluetooth device connected
                        </span>
                      )}
                    </Label>
                    <Select onValueChange={onDeviceChange} value={currentDeviceId}>
                      <SelectTrigger id="camera-select">
                        <SelectValue placeholder="Select a camera..." />
                      </SelectTrigger>
                      <SelectContent>
                        {combinedDevices.map((device, index) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {/* PROJECT CERULEAN: Show Bluetooth icon for Bluetooth devices */}
                            <span className="flex items-center gap-2">
                              {device.groupId === 'bluetooth' && <Bluetooth className="w-3 h-3 text-blue-500" />}
                              {device.label || `Camera ${index + 1}`}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* PROJECT CERULEAN: Add pairing button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowPairingModal(true)}
                    >
                      <Bluetooth className="w-4 h-4 mr-2" />
                      Pair New Bluetooth Device
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Resolution</Label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4096x2160">4K Ultra HD</SelectItem>
                          <SelectItem value="1920x1080">1080p Full HD</SelectItem>
                          <SelectItem value="1280x720">720p HD</SelectItem>
                          <SelectItem value="854x480">480p SD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Frame Rate</Label>
                      <Select value={frameRate} onValueChange={setFrameRate}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60">60 FPS</SelectItem>
                          <SelectItem value="30">30 FPS</SelectItem>
                          <SelectItem value="24">24 FPS (Cinema)</SelectItem>
                          <SelectItem value="15">15 FPS (Battery Save)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Digital Zoom: {zoom[0]}x</Label>
                    <Slider
                      value={zoom}
                      onValueChange={setZoom}
                      max={10}
                      min={1}
                      step={0.5}
                      className="w-full"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="quality" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Brightness: {brightness[0]}%</Label>
                    <Slider
                      value={brightness}
                      onValueChange={setBrightness}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contrast: {contrast[0]}%</Label>
                    <Slider
                      value={contrast}
                      onValueChange={setContrast}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Saturation: {saturation[0]}%</Label>
                    <Slider
                      value={saturation}
                      onValueChange={setSaturation}
                      max={100}
                      min={0}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="hdr-mode" className="flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        HDR Mode
                      </Label>
                      <Switch 
                        id="hdr-mode" 
                        checked={hdrEnabled}
                        onCheckedChange={(checked) => {
                          setHdrEnabled(checked);
                          handleAdvancedFeature('HDR Mode', checked);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="stabilization" className="flex items-center gap-2">
                        <RotateCw className="w-4 h-4" />
                        Stabilization
                      </Label>
                      <Switch 
                        id="stabilization" 
                        checked={imageStabilization}
                        onCheckedChange={(checked) => {
                          setImageStabilization(checked);
                          handleAdvancedFeature('Image Stabilization', checked);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="devices" className="mt-6 space-y-6">
                {/* PROJECT CERULEAN: Enhanced devices tab with actual Bluetooth status */}
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Bluetooth className="h-6 w-6 text-blue-500" />
                    <h3 className="font-semibold text-lg">Smart Device Management</h3>
                  </div>
                  
                  {connectedDevice ? (
                    <div className="space-y-4">
                      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="text-left">
                                <p className="font-medium">{connectedDevice.name}</p>
                                <p className="text-sm text-muted-foreground">Connected via Bluetooth</p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPairingModal(true)}
                            >
                              Manage
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <p className="text-sm text-muted-foreground">
                        This device is available as a camera source above.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No Bluetooth devices connected. Use the button in the Camera tab to pair a device.
                    </p>
                  )}
                  
                  <Button 
                    onClick={() => setShowPairingModal(true)}
                    size="lg"
                    className="w-full"
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Open Device Manager
                  </Button>
                  
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2 text-sm">Mock Devices (Legacy)</h4>
                    <Button 
                      onClick={startBluetoothScan} 
                      disabled={isScanning}
                      variant="outline"
                      className="w-full"
                    >
                      {isScanning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                          Scanning Mock Devices...
                        </>
                      ) : (
                        <>
                          <Bluetooth className="w-4 h-4 mr-2" />
                          Scan Mock Devices
                        </>
                      )}
                    </Button>

                    {foundDevices.length > 0 && (
                      <div className="space-y-3 mt-6">
                        <h4 className="font-medium">Found Devices:</h4>
                        {foundDevices.map((device, index) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              {getDeviceIcon(device.type)}
                              <div>
                                <p className="font-medium text-sm">{device.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Battery: {device.battery}% • {device.type.replace('-', ' ')}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={device.connected ? "secondary" : "default"}
                              onClick={() => connectDevice(device)}
                              disabled={device.connected}
                            >
                              {device.connected ? "Connected" : "Connect"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="mt-6 space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="torch-mode" className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Flashlight
                      </Label>
                      <Switch 
                        id="torch-mode" 
                        checked={flashEnabled}
                        onCheckedChange={(checked) => {
                          setFlashEnabled(checked);
                          handleAdvancedFeature('Flashlight', checked);
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-focus" className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        Auto Focus
                      </Label>
                      <Switch 
                        id="auto-focus" 
                        checked={autoFocus}
                        onCheckedChange={(checked) => {
                          setAutoFocus(checked);
                          handleAdvancedFeature('Auto Focus', checked);
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Professional Features</h4>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => handleAdvancedFeature('Manual White Balance')}
                    >
                      <Sun className="w-4 h-4 mr-2" />
                      Manual White Balance
                    </Button>

                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => handleAdvancedFeature('Focus Peaking')}
                    >
                      <Maximize className="w-4 h-4 mr-2" />
                      Focus Peaking & Zebras
                    </Button>

                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => handleAdvancedFeature('Audio Monitoring')}
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      Audio Level Monitoring
                    </Button>

                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => handleAdvancedFeature('Grid Lines')}
                    >
                      <Monitor className="w-4 h-4 mr-2" />
                      Grid Lines & Composition
                    </Button>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium mb-2">Quick Actions</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleAdvancedFeature('Reset to Defaults')}>
                        Reset Settings
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleAdvancedFeature('Export Profile')}>
                        Export Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* PROJECT CERULEAN: Device Pairing Modal */}
      <DevicePairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onDeviceConnected={handleBluetoothDeviceConnected}
      />
    </>
  );
};

export default CameraSettingsModal;