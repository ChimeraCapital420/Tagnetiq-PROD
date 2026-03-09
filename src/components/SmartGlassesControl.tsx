// FILE: src/components/SmartGlassesControl.tsx
// Smart Glasses Control Interface — capture, batch, and continuous modes.
//
// MOBILE FIRST:
//   - Frame capture + compression happens on device (Capacitor plugin)
//   - Only compressed JPEG base64 sent to server
//   - Batch mode accumulates on device, processes when user says "go"
//   - No video stream preview — Meta glasses return discrete frames
//
// ARCHITECTURE:
//   - Uses metaGlasses state from useBluetoothManager (Capacitor plugin bridge)
//   - captureGlassesFrame() → base64 JPEG from glasses camera
//   - Falls back gracefully in browser (shows "use mobile app" message)
//
// v12: Auto-requests camera permission before starting session.
//   The Meta SDK requires requestCameraPermission() before startSession().
//   handleStartSession now does both in sequence.

import React, { useCallback, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  VideoOff,
  Camera,
  Zap,
  Eye,
  Package,
  DollarSign,
  List,
  Upload,
  Glasses,
  Battery,
  Signal,
  Loader2,
  Smartphone,
  ImageIcon,
} from 'lucide-react';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface SmartGlassesControlProps {
  onCaptureItem?: (imageData: string) => void;
  onBatchCapture?: (images: string[]) => void;
}

interface CapturedFrame {
  base64: string;
  width: number;
  height: number;
  timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BATCH_SIZE = 20;
const CONTINUOUS_INTERVAL_MS = 2000; // 1 frame every 2 seconds in continuous mode

// =============================================================================
// COMPONENT
// =============================================================================

const SmartGlassesControl: React.FC<SmartGlassesControlProps> = ({
  onCaptureItem,
  onBatchCapture,
}) => {
  // — Hook ———————————————————————————————————————————————————
  const {
    metaGlasses,
    requestGlassesCameraPermission,
    startGlassesSession,
    stopGlassesSession,
    captureGlassesFrame,
    refreshGlassesStatus,
  } = useBluetoothManager();

  // — Local state ————————————————————————————————————————————
  const [captureMode, setCaptureMode] = useState<'single' | 'batch' | 'continuous'>('single');
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [lastCapture, setLastCapture] = useState<CapturedFrame | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const continuousRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // — Settings (stored on device, not server) ————————————————
  const [imageQuality, setImageQuality] = useState<'720p' | '1080p' | '480p'>('720p');
  const [realtimeAnalysis, setRealtimeAnalysis] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [autoCapture, setAutoCapture] = useState(false);

  // — Handlers ———————————————————————————————————————————————

  // v12 FIX: Request camera permission THEN start session.
  // Meta SDK requires requestCameraPermission() before startSession().
  const handleStartSession = useCallback(async () => {
    // Step 1: Request camera permission if not already granted
    if (!metaGlasses.cameraPermissionGranted) {
      toast.info('Requesting camera permission...');
      const granted = await requestGlassesCameraPermission();
      if (!granted) {
        toast.error('Camera permission denied', {
          description: 'Grant camera access in the Meta AI app settings.',
        });
        return;
      }
    }

    // Step 2: Start the session
    const success = await startGlassesSession();
    if (success) {
      toast.success('Glasses camera active');
    }
  }, [metaGlasses.cameraPermissionGranted, requestGlassesCameraPermission, startGlassesSession]);

  const handleStopSession = useCallback(async () => {
    // Stop continuous mode if running
    if (continuousRef.current) {
      clearInterval(continuousRef.current);
      continuousRef.current = null;
      setIsContinuous(false);
    }
    await stopGlassesSession();
  }, [stopGlassesSession]);

  const handleSingleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const frame = await captureGlassesFrame();
      if (frame) {
        setLastCapture({ ...frame, timestamp: Date.now() });
        onCaptureItem?.(frame.base64);
        toast.success('Item captured');
      } else {
        toast.error('Capture failed — try again');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [captureGlassesFrame, onCaptureItem, isCapturing]);

  const handleBatchCapture = useCallback(async () => {
    if (isCapturing || batchImages.length >= MAX_BATCH_SIZE) return;
    setIsCapturing(true);

    try {
      const frame = await captureGlassesFrame();
      if (frame) {
        setBatchImages(prev => [...prev, frame.base64]);
        setLastCapture({ ...frame, timestamp: Date.now() });
        toast.info(`Batch: ${batchImages.length + 1} items`);
      }
    } finally {
      setIsCapturing(false);
    }
  }, [captureGlassesFrame, batchImages.length, isCapturing]);

  const handleFinishBatch = useCallback(() => {
    if (batchImages.length > 0) {
      onBatchCapture?.(batchImages);
      toast.success(`Processing ${batchImages.length} items`);
      setBatchImages([]);
      setLastCapture(null);
    }
  }, [batchImages, onBatchCapture]);

  const handleClearBatch = useCallback(() => {
    setBatchImages([]);
    setLastCapture(null);
  }, []);

  const handleToggleContinuous = useCallback(() => {
    if (isContinuous) {
      // Stop
      if (continuousRef.current) {
        clearInterval(continuousRef.current);
        continuousRef.current = null;
      }
      setIsContinuous(false);
      toast.info('Continuous capture stopped');
    } else {
      // Start — capture a frame every CONTINUOUS_INTERVAL_MS
      setIsContinuous(true);
      toast.success('Continuous capture started');

      continuousRef.current = setInterval(async () => {
        const frame = await captureGlassesFrame();
        if (frame) {
          onCaptureItem?.(frame.base64);
          setLastCapture({ ...frame, timestamp: Date.now() });
        }
      }, CONTINUOUS_INTERVAL_MS);
    }
  }, [isContinuous, captureGlassesFrame, onCaptureItem]);

  // — Not connected / not available states ————————————————————

  // Plugin not available (browser)
  if (!metaGlasses.pluginAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Smart Glasses Control
          </CardTitle>
          <CardDescription>
            Smart glasses require the TagnetIQ mobile app. Open TagnetIQ on your phone to use glasses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Download the mobile app</p>
              <p className="text-xs text-muted-foreground">
                Camera access requires native Capacitor bridge
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Plugin available but no session active
  if (!metaGlasses.isSessionActive) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Smart Glasses Control
          </CardTitle>
          <CardDescription>
            {metaGlasses.isConnected
              ? `${metaGlasses.deviceName || 'Glasses'} connected — start a camera session to begin scanning.`
              : 'Connect your glasses through the Device Pairing modal to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metaGlasses.isConnected ? (
            <Button onClick={handleStartSession} disabled={metaGlasses.isLoading} className="w-full">
              {metaGlasses.isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Start Camera Session
            </Button>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Open Device Pairing to connect your glasses first.
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // — Active session ————————————————————————————————————————

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Glasses className="w-5 h-5" />
              {metaGlasses.deviceName || 'Smart Glasses'}
            </CardTitle>
            <CardDescription>Camera session active</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {metaGlasses.batteryLevel !== null && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Battery className="w-4 h-4" />
                {metaGlasses.batteryLevel}%
              </div>
            )}
            <Badge variant="default" className="bg-green-600">Live</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last Captured Frame Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          {lastCapture ? (
            <img
              src={`data:image/jpeg;base64,${lastCapture.base64}`}
              alt="Last captured frame"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
              <ImageIcon className="w-10 h-10 mb-2" />
              <p className="text-sm">Capture a frame to preview</p>
            </div>
          )}

          {/* Overlay controls */}
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-black/50 hover:bg-black/70"
              onClick={handleStopSession}
              title="Stop session"
            >
              <VideoOff className="w-4 h-4 text-white" />
            </Button>
          </div>

          {isCapturing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}

          {isContinuous && (
            <div className="absolute top-3 left-3">
              <Badge variant="destructive" className="animate-pulse">
                REC
              </Badge>
            </div>
          )}
        </div>

        {/* Control Tabs */}
        <Tabs defaultValue="capture" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="capture">Capture</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* — Capture Tab ———————————————————————————— */}
          <TabsContent value="capture" className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={captureMode === 'single' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('single')}
                size="sm"
              >
                <Camera className="w-4 h-4 mr-1" />
                Single
              </Button>
              <Button
                variant={captureMode === 'batch' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('batch')}
                size="sm"
              >
                <Package className="w-4 h-4 mr-1" />
                Batch
              </Button>
              <Button
                variant={captureMode === 'continuous' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('continuous')}
                size="sm"
              >
                <Zap className="w-4 h-4 mr-1" />
                Hunt
              </Button>
            </div>

            {captureMode === 'single' && (
              <Button
                onClick={handleSingleCapture}
                className="w-full"
                size="lg"
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                Capture Item
              </Button>
            )}

            {captureMode === 'batch' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    onClick={handleBatchCapture}
                    className="flex-1"
                    disabled={isCapturing || batchImages.length >= MAX_BATCH_SIZE}
                  >
                    {isCapturing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 mr-2" />
                    )}
                    Add ({batchImages.length}/{MAX_BATCH_SIZE})
                  </Button>
                  <Button
                    onClick={handleFinishBatch}
                    variant="secondary"
                    disabled={batchImages.length === 0}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Process
                  </Button>
                </div>
                {batchImages.length > 0 && (
                  <>
                    <Progress value={(batchImages.length / MAX_BATCH_SIZE) * 100} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={handleClearBatch}
                    >
                      Clear batch
                    </Button>
                  </>
                )}
              </div>
            )}

            {captureMode === 'continuous' && (
              <Button
                onClick={handleToggleContinuous}
                className="w-full"
                size="lg"
                variant={isContinuous ? 'destructive' : 'default'}
              >
                {isContinuous ? (
                  <>
                    <VideoOff className="w-4 h-4 mr-2" />
                    Stop Hunt Mode
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 mr-2" />
                    Start Hunt Mode
                  </>
                )}
              </Button>
            )}
          </TabsContent>

          {/* — Commands Tab ———————————————————————————— */}
          <TabsContent value="commands" className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Quick actions — capture + send to specific analysis pipeline.
            </p>
            <Button
              onClick={async () => {
                const frame = await captureGlassesFrame();
                if (frame) onCaptureItem?.(frame.base64);
                toast.info('Identifying item...');
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <Eye className="w-4 h-4 mr-2" />
              Identify Item
            </Button>
            <Button
              onClick={async () => {
                const frame = await captureGlassesFrame();
                if (frame) onCaptureItem?.(frame.base64);
                toast.info('Estimating value...');
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Estimate Value
            </Button>
            <Button
              onClick={async () => {
                const frame = await captureGlassesFrame();
                if (frame) onCaptureItem?.(frame.base64);
                toast.info('Creating listing...');
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <List className="w-4 h-4 mr-2" />
              Create Listing
            </Button>
            <Button
              onClick={() => {
                setCaptureMode('continuous');
                if (!isContinuous) handleToggleContinuous();
                toast.info('Starting room inventory...');
              }}
              className="w-full justify-start"
              variant="outline"
            >
              <Package className="w-4 h-4 mr-2" />
              Room Inventory
            </Button>
          </TabsContent>

          {/* — Settings Tab ——————————————————————————— */}
          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-2">
              <Label>Capture Quality</Label>
              <Select value={imageQuality} onValueChange={(v) => setImageQuality(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080p">Full HD (1080p)</SelectItem>
                  <SelectItem value="720p">HD (720p) — recommended</SelectItem>
                  <SelectItem value="480p">SD (480p) — fast</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>AI Processing</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Real-time Analysis</span>
                <Switch checked={realtimeAnalysis} onCheckedChange={setRealtimeAnalysis} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Voice Feedback</span>
                <Switch checked={voiceFeedback} onCheckedChange={setVoiceFeedback} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-capture Valuable Items</span>
                <Switch checked={autoCapture} onCheckedChange={setAutoCapture} />
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={refreshGlassesStatus}
              >
                Refresh Glasses Status
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SmartGlassesControl;