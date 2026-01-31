// FILE: src/components/CameraSettingsModal.tsx
// Fully functional camera settings with real controls
// Mobile-first: touch-friendly, battery-conscious, graceful degradation

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  X,
  Zap,
  ZapOff,
  Sun,
  Video,
  Camera,
  Smartphone,
  Monitor,
  Bluetooth,
  Settings2,
  Grid3X3,
  RotateCw,
  Volume2,
  CheckCircle,
  AlertCircle,
  Maximize,
  Focus,
  Palette,
  RefreshCw,
  Moon,
  TreePine,
  FileText,
  Info
} from 'lucide-react';
import { useCameraControls } from '@/hooks/useCameraControls';
import { useGridOverlay } from '@/hooks/useGridOverlay';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import DevicePairingModal from './DevicePairingModal';

// =============================================================================
// TYPES
// =============================================================================

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDevices: MediaDeviceInfo[];
  onDeviceChange: (deviceId: string) => void;
  currentDeviceId: string | undefined;
  videoTrack?: MediaStreamTrack | null; // Pass the actual video track for controls
  onSettingsChange?: (settings: any) => void; // Callback for CSS filters
}

// =============================================================================
// RESOLUTION OPTIONS
// =============================================================================

const RESOLUTION_OPTIONS = [
  { value: '3840x2160', label: '4K Ultra HD (3840×2160)', width: 3840, height: 2160 },
  { value: '2560x1440', label: '2K QHD (2560×1440)', width: 2560, height: 1440 },
  { value: '1920x1080', label: '1080p Full HD (1920×1080)', width: 1920, height: 1080 },
  { value: '1280x720', label: '720p HD (1280×720)', width: 1280, height: 720 },
  { value: '854x480', label: '480p SD (854×480)', width: 854, height: 480 },
];

const FRAME_RATE_OPTIONS = [
  { value: '60', label: '60 FPS (Smooth)', fps: 60 },
  { value: '30', label: '30 FPS (Standard)', fps: 30 },
  { value: '24', label: '24 FPS (Cinema)', fps: 24 },
  { value: '15', label: '15 FPS (Battery Save)', fps: 15 },
];

const GRID_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'rule-of-thirds', label: 'Rule of Thirds' },
  { value: 'golden-ratio', label: 'Golden Ratio' },
  { value: 'center-cross', label: 'Center Cross' },
  { value: 'diagonal', label: 'Diagonal Guides' },
];

// =============================================================================
// COMPONENT
// =============================================================================

const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({
  isOpen,
  onClose,
  availableDevices,
  onDeviceChange,
  currentDeviceId,
  videoTrack,
  onSettingsChange,
}) => {
  // ---------------------------------------------------------------------------
  // HOOKS
  // ---------------------------------------------------------------------------
  
  const {
    capabilities,
    settings: cameraSettings,
    isApplying,
    setTorch,
    setZoom,
    setFocusMode,
    setBrightness,
    setContrast,
    setSaturation,
    setResolution,
    setFrameRate,
    resetToDefaults,
    applyPreset,
  } = useCameraControls(videoTrack || null);

  const gridOverlay = useGridOverlay();
  
  const {
    isSupported: btSupported,
    isEnabled: btEnabled,
    connectedDevices: btConnectedDevices,
  } = useBluetoothManager();

  const btConnectedDevice = btConnectedDevices.length > 0 ? btConnectedDevices[0] : null;

  // ---------------------------------------------------------------------------
  // LOCAL STATE
  // ---------------------------------------------------------------------------

  const [showPairingModal, setShowPairingModal] = useState(false);
  const [activeTab, setActiveTab] = useState('camera');

  // Track local slider values for smooth UI (debounce actual changes)
  const [localBrightness, setLocalBrightness] = useState([cameraSettings.brightness]);
  const [localContrast, setLocalContrast] = useState([cameraSettings.contrast]);
  const [localSaturation, setLocalSaturation] = useState([cameraSettings.saturation]);
  const [localZoom, setLocalZoom] = useState([cameraSettings.zoom]);

  // Sync local values with camera settings
  useEffect(() => {
    setLocalBrightness([cameraSettings.brightness]);
    setLocalContrast([cameraSettings.contrast]);
    setLocalSaturation([cameraSettings.saturation]);
    setLocalZoom([cameraSettings.zoom]);
  }, [cameraSettings]);

  // ---------------------------------------------------------------------------
  // COMBINED DEVICES (Camera + Bluetooth)
  // ---------------------------------------------------------------------------

  const combinedDevices = useMemo(() => {
    const devices = [...availableDevices];
    
    if (btConnectedDevice) {
      const bluetoothDevice: MediaDeviceInfo = {
        deviceId: `bluetooth-${btConnectedDevice.id}`,
        groupId: 'bluetooth',
        kind: 'videoinput',
        label: `${btConnectedDevice.name} (Bluetooth)`,
        toJSON: () => ({}),
      };
      devices.push(bluetoothDevice);
    }
    
    return devices;
  }, [availableDevices, btConnectedDevice]);

  // ---------------------------------------------------------------------------
  // CSS FILTER STRING (for features not natively supported)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (onSettingsChange) {
      // Generate CSS filter string for video element
      const filters = [];
      
      // Brightness: 50 = 100% (normal), 0 = 0%, 100 = 200%
      const brightnessValue = localBrightness[0] / 50;
      if (brightnessValue !== 1) {
        filters.push(`brightness(${brightnessValue})`);
      }
      
      // Contrast: 50 = 100% (normal)
      const contrastValue = localContrast[0] / 50;
      if (contrastValue !== 1) {
        filters.push(`contrast(${contrastValue})`);
      }
      
      // Saturation: 50 = 100% (normal)
      const saturationValue = localSaturation[0] / 50;
      if (saturationValue !== 1) {
        filters.push(`saturate(${saturationValue})`);
      }

      onSettingsChange({
        filter: filters.length > 0 ? filters.join(' ') : 'none',
        grid: gridOverlay.settings,
      });
    }
  }, [localBrightness, localContrast, localSaturation, gridOverlay.settings, onSettingsChange]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleResolutionChange = (value: string) => {
    const option = RESOLUTION_OPTIONS.find(o => o.value === value);
    if (option) {
      setResolution(option.width, option.height);
    }
  };

  const handleFrameRateChange = (value: string) => {
    const option = FRAME_RATE_OPTIONS.find(o => o.value === value);
    if (option) {
      setFrameRate(option.fps);
    }
  };

  const handleBrightnessCommit = (value: number[]) => {
    setBrightness(value[0]);
  };

  const handleContrastCommit = (value: number[]) => {
    setContrast(value[0]);
  };

  const handleSaturationCommit = (value: number[]) => {
    setSaturation(value[0]);
  };

  const handleZoomCommit = (value: number[]) => {
    setZoom(value[0]);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  const currentResolution = `${cameraSettings.resolution.width}x${cameraSettings.resolution.height}`;
  const currentFrameRate = String(cameraSettings.frameRate);

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
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Camera Settings
                  {isApplying && (
                    <Badge variant="secondary" className="ml-2">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Applying...
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure camera, quality, and connected devices
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="camera">Camera</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="devices">Devices</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              {/* ============================================================= */}
              {/* CAMERA TAB */}
              {/* ============================================================= */}
              
              <TabsContent value="camera" className="space-y-6">
                {/* Camera Source */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Camera Source
                    {btConnectedDevice && (
                      <Badge variant="outline" className="text-blue-500 border-blue-500">
                        <Bluetooth className="w-3 h-3 mr-1" />
                        BT Connected
                      </Badge>
                    )}
                  </Label>
                  <Select value={currentDeviceId} onValueChange={onDeviceChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a camera..." />
                    </SelectTrigger>
                    <SelectContent>
                      {combinedDevices.map((device, index) => (
                        <SelectItem key={device.deviceId} value={device.deviceId}>
                          <span className="flex items-center gap-2">
                            {device.groupId === 'bluetooth' && (
                              <Bluetooth className="w-3 h-3 text-blue-500" />
                            )}
                            {device.label || `Camera ${index + 1}`}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowPairingModal(true)}
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Pair Bluetooth Device
                  </Button>
                </div>

                <Separator />

                {/* Resolution & Frame Rate */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <Select value={currentResolution} onValueChange={handleResolutionChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RESOLUTION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Frame Rate</Label>
                    <Select value={currentFrameRate} onValueChange={handleFrameRateChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FRAME_RATE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Zoom */}
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Digital Zoom: {localZoom[0].toFixed(1)}x</span>
                    {!capabilities?.zoom && (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Info className="w-3 h-3 mr-1" />
                        Not supported
                      </Badge>
                    )}
                  </Label>
                  <Slider
                    value={localZoom}
                    onValueChange={setLocalZoom}
                    onValueCommit={handleZoomCommit}
                    min={capabilities?.zoom?.min || 1}
                    max={capabilities?.zoom?.max || 10}
                    step={capabilities?.zoom?.step || 0.1}
                    disabled={!capabilities?.zoom}
                    className="w-full"
                  />
                </div>
              </TabsContent>

              {/* ============================================================= */}
              {/* QUALITY TAB */}
              {/* ============================================================= */}
              
              <TabsContent value="quality" className="space-y-6">
                {/* Brightness */}
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Brightness: {localBrightness[0]}%
                    </span>
                    {capabilities?.brightness && (
                      <Badge variant="secondary">Native</Badge>
                    )}
                  </Label>
                  <Slider
                    value={localBrightness}
                    onValueChange={setLocalBrightness}
                    onValueCommit={handleBrightnessCommit}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Contrast: {localContrast[0]}%
                    </span>
                  </Label>
                  <Slider
                    value={localContrast}
                    onValueChange={setLocalContrast}
                    onValueCommit={handleContrastCommit}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Saturation: {localSaturation[0]}%</span>
                  </Label>
                  <Slider
                    value={localSaturation}
                    onValueChange={setLocalSaturation}
                    onValueCommit={handleSaturationCommit}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                <Separator />

                {/* Quick Presets */}
                <div className="space-y-3">
                  <Label>Quick Presets</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('default')}
                      className="justify-start"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Default
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('lowLight')}
                      className="justify-start"
                    >
                      <Moon className="w-4 h-4 mr-2" />
                      Low Light
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('outdoor')}
                      className="justify-start"
                    >
                      <TreePine className="w-4 h-4 mr-2" />
                      Outdoor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset('document')}
                      className="justify-start"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Document
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================= */}
              {/* DEVICES TAB */}
              {/* ============================================================= */}
              
              <TabsContent value="devices" className="space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Bluetooth className="h-6 w-6 text-blue-500" />
                    <h3 className="font-semibold text-lg">Bluetooth Devices</h3>
                  </div>

                  {!btSupported && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Web Bluetooth is not supported in this browser. Use Chrome, Edge, or Opera.
                      </AlertDescription>
                    </Alert>
                  )}

                  {btSupported && !btEnabled && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bluetooth is disabled. Please enable it in your device settings.
                      </AlertDescription>
                    </Alert>
                  )}

                  {btConnectedDevice ? (
                    <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium">{btConnectedDevice.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Connected via Bluetooth
                                {btConnectedDevice.batteryLevel && (
                                  <> • Battery: {btConnectedDevice.batteryLevel}%</>
                                )}
                              </p>
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No Bluetooth devices connected.
                    </p>
                  )}

                  <Button
                    onClick={() => setShowPairingModal(true)}
                    size="lg"
                    className="w-full"
                    disabled={!btSupported || !btEnabled}
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    {btConnectedDevice ? 'Manage Devices' : 'Pair New Device'}
                  </Button>

                  <Separator />

                  <div className="text-left space-y-2">
                    <Label className="text-sm font-medium">Supported Devices</Label>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        <Camera className="w-4 h-4" /> GoPro cameras
                      </li>
                      <li className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Ray-Ban Meta Smart Glasses
                      </li>
                      <li className="flex items-center gap-2">
                        <Video className="w-4 h-4" /> DJI Pocket cameras
                      </li>
                      <li className="flex items-center gap-2">
                        <Monitor className="w-4 h-4" /> Bluetooth webcams
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              {/* ============================================================= */}
              {/* ADVANCED TAB */}
              {/* ============================================================= */}
              
              <TabsContent value="advanced" className="space-y-6">
                {/* Torch / Flashlight */}
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    {cameraSettings.torch ? (
                      <Zap className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <ZapOff className="w-4 h-4" />
                    )}
                    Flashlight / Torch
                    {!capabilities?.torch && (
                      <Badge variant="outline" className="text-muted-foreground ml-2">
                        Not available
                      </Badge>
                    )}
                  </Label>
                  <Switch
                    checked={cameraSettings.torch}
                    onCheckedChange={setTorch}
                    disabled={!capabilities?.torch}
                  />
                </div>

                {/* Focus Mode */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Focus className="w-4 h-4" />
                    Focus Mode
                    {capabilities?.focusMode.length === 0 && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not available
                      </Badge>
                    )}
                  </Label>
                  <Select
                    value={cameraSettings.focusMode}
                    onValueChange={(v) => setFocusMode(v as any)}
                    disabled={!capabilities?.focusMode.length}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(capabilities?.focusMode.length ? capabilities.focusMode : ['continuous']).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Grid Overlay */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Grid3X3 className="w-4 h-4" />
                      Grid Overlay
                    </Label>
                    <Switch
                      checked={gridOverlay.settings.enabled}
                      onCheckedChange={gridOverlay.setEnabled}
                    />
                  </div>

                  {gridOverlay.settings.enabled && (
                    <div className="space-y-3 pl-6">
                      <Select
                        value={gridOverlay.settings.type}
                        onValueChange={(v) => gridOverlay.setType(v as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRID_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="space-y-1">
                        <Label className="text-sm">Opacity: {gridOverlay.settings.opacity}%</Label>
                        <Slider
                          value={[gridOverlay.settings.opacity]}
                          onValueChange={([v]) => gridOverlay.setOpacity(v)}
                          min={10}
                          max={100}
                          step={10}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Capabilities Info */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <h5 className="font-medium flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Camera Capabilities
                  </h5>
                  {capabilities ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        {capabilities.torch ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        Torch
                      </div>
                      <div className="flex items-center gap-2">
                        {capabilities.zoom ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        Zoom
                        {capabilities.zoom && (
                          <span className="text-muted-foreground">
                            ({capabilities.zoom.min}-{capabilities.zoom.max}x)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {capabilities.focusMode.length > 0 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        Focus Control
                      </div>
                      <div className="flex items-center gap-2">
                        {capabilities.brightness ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground" />
                        )}
                        Native Brightness
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Camera capabilities will be detected when a camera is active.
                    </p>
                  )}
                </div>

                {/* Reset */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={resetToDefaults}
                >
                  <RotateCw className="w-4 h-4 mr-2" />
                  Reset All to Defaults
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Device Pairing Modal */}
      <DevicePairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onDeviceConnected={() => {
          setShowPairingModal(false);
          toast.success('Device connected and available as camera source');
        }}
      />
    </>
  );
};

export default CameraSettingsModal;