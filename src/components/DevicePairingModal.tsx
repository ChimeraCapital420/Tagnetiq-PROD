// FILE: src/components/DevicePairingModal.tsx
// Bluetooth Device Pairing UI - Real Web Bluetooth integration
// Mobile-first: touch-friendly, clear status, graceful degradation
//
// ENHANCED: Meta Smart Glasses section. When the Capacitor plugin is available,
// shows a guided multi-step setup flow (Register → Permission → Connect).
// When in browser (no plugin), shows "use mobile app" message.
// ALL existing Bluetooth UI is UNCHANGED.

import React, { useCallback, useEffect } from 'react';
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
  Glasses,
  ArrowRight,
  Eye,
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

    // Meta Glasses (NEW)
    metaGlasses,
    registerMetaGlasses,
    requestGlassesCameraPermission,
    startGlassesSession,
    stopGlassesSession,
    refreshGlassesStatus,
  } = useBluetoothManager();

  // Refresh glasses status when modal opens
  useEffect(() => {
    if (isOpen) refreshGlassesStatus();
  }, [isOpen, refreshGlassesStatus]);

  // ---------------------------------------------------------------------------
  // HANDLERS (existing — UNCHANGED)
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
  // META GLASSES SECTION (NEW)
  // ---------------------------------------------------------------------------

  const renderMetaGlassesSection = () => {
    // ── Already connected and active ──
    if (metaGlasses.isConnected && metaGlasses.isSessionActive) {
      return (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                  <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    {metaGlasses.deviceName || 'Smart Glasses'}
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    Camera session active
                    {metaGlasses.batteryLevel !== null && (
                      <span className="flex items-center gap-1">
                        <BatteryMedium className="w-3 h-3" />
                        {metaGlasses.batteryLevel}%
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={stopGlassesSession}>
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // ── Connected but session not started ──
    if (metaGlasses.isConnected && !metaGlasses.isSessionActive) {
      return (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-medium">{metaGlasses.deviceName || 'Smart Glasses'}</p>
                  <p className="text-sm text-muted-foreground">Connected — ready to start</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={startGlassesSession}
                disabled={metaGlasses.isLoading}
              >
                {metaGlasses.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Start Camera'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // ── Plugin available but not fully set up — show setup steps ──
    if (metaGlasses.pluginAvailable) {
      const currentStep = !metaGlasses.isRegistered ? 1
        : !metaGlasses.cameraPermissionGranted ? 2
        : 3; // Ready to connect

      return (
        <Card className="mb-4 border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <h4 className="font-semibold">Meta Smart Glasses</h4>
              {metaGlasses.isLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {metaGlasses.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{metaGlasses.error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Register with Meta AI */}
            <SetupStep
              step={1}
              currentStep={currentStep}
              title="Register with Meta AI"
              description="One-time setup — connects TagnetIQ to your glasses through the Meta AI app"
              completed={metaGlasses.isRegistered}
              onAction={registerMetaGlasses}
              actionLabel="Register"
              isLoading={metaGlasses.isLoading && currentStep === 1}
            />

            {/* Step 2: Camera Permission */}
            <SetupStep
              step={2}
              currentStep={currentStep}
              title="Camera Permission"
              description="Allow TagnetIQ to see through your glasses camera"
              completed={metaGlasses.cameraPermissionGranted}
              onAction={requestGlassesCameraPermission}
              actionLabel="Allow Camera"
              isLoading={metaGlasses.isLoading && currentStep === 2}
              disabled={!metaGlasses.isRegistered}
            />

            {/* Step 3: Connect */}
            <SetupStep
              step={3}
              currentStep={currentStep}
              title="Connect & Start"
              description="Start receiving camera frames from your glasses"
              completed={metaGlasses.isSessionActive}
              onAction={startGlassesSession}
              actionLabel="Connect Glasses"
              isLoading={metaGlasses.isLoading && currentStep === 3}
              disabled={!metaGlasses.cameraPermissionGranted}
            />
          </CardContent>
        </Card>
      );
    }

    // ── Plugin not available (browser) — show info message ──
    return (
      <Card className="mb-4 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-full">
              <Eye className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">Meta Smart Glasses</p>
              <p className="text-xs text-muted-foreground">
                Smart glasses require the TagnetIQ mobile app.
                Open TagnetIQ on your phone to pair glasses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ---------------------------------------------------------------------------
  // EXISTING RENDER HELPERS (UNCHANGED)
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
    const unconnectedDevices = availableDevices.filter(
      (d) => !connectedDevices.some((c) => c.id === d.id)
    );

    if (unconnectedDevices.length === 0 && !isScanning) return null;

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
                        <Button size="sm" onClick={() => handleConnect(device.id)}>
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
    if (isScanning || availableDevices.length > 0 || connectedDevices.length > 0) return null;

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

        {/* ═══ META SMART GLASSES SECTION (NEW) ═══ */}
        {renderMetaGlassesSection()}

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
              <Eye className="w-3 h-3" /> Ray-Ban Meta Smart Glasses
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

// =============================================================================
// SETUP STEP SUB-COMPONENT (for Meta glasses multi-step flow)
// =============================================================================

interface SetupStepProps {
  step: number;
  currentStep: number;
  title: string;
  description: string;
  completed: boolean;
  onAction: () => Promise<boolean>;
  actionLabel: string;
  isLoading?: boolean;
  disabled?: boolean;
}

const SetupStep: React.FC<SetupStepProps> = ({
  step,
  currentStep,
  title,
  description,
  completed,
  onAction,
  actionLabel,
  isLoading = false,
  disabled = false,
}) => {
  const isActive = step === currentStep;
  const isPast = step < currentStep || completed;
  const isFuture = step > currentStep && !completed;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
      isActive ? 'bg-primary/5 border border-primary/20' :
      isPast ? 'bg-green-50 dark:bg-green-950/30' :
      'opacity-50'
    }`}>
      {/* Step indicator */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        isPast ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' :
        isActive ? 'bg-primary/10 text-primary' :
        'bg-muted text-muted-foreground'
      }`}>
        {isPast ? <CheckCircle className="w-4 h-4" /> : step}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {/* Action */}
      {isActive && !completed && (
        <Button
          size="sm"
          onClick={onAction}
          disabled={disabled || isLoading}
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {actionLabel}
              <ArrowRight className="w-3 h-3 ml-1" />
            </>
          )}
        </Button>
      )}

      {isPast && (
        <Badge variant="outline" className="text-green-600 border-green-300 shrink-0">
          Done
        </Badge>
      )}
    </div>
  );
};

export default DevicePairingModal;