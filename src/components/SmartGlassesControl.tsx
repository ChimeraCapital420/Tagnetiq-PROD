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
//
// v13: FIX — Glasses capture now calls /api/oracle/hunt directly.
//   PROBLEM: onCaptureItem was an optional prop. No parent ever passed it.
//   Photos captured, displayed in preview, then went NOWHERE. Zero Vercel
//   function calls. "Unable to identify" was a client-side fallback message.
//
//   FIX: Component now calls /api/oracle/hunt directly with the base64 image
//   and displays the result (verdict, item name, estimated value) inline.
//   onCaptureItem prop is preserved for backward compatibility — if a parent
//   passes it, it still fires. But the API call happens regardless.
//
//   Hunt endpoint accepts: { image: "base64...", deviceType: "glasses" }
//   Hunt endpoint returns: { verdict, itemName, estimatedValue, reason, ... }
//
// v13.1: DIAGNOSTIC — Added safeCapture() wrapper with try/catch around
//   captureGlassesFrame(). v13 had NO catch block — if the Capacitor plugin
//   threw instead of returning null, the error was silently swallowed. Now
//   every capture failure shows the REAL error message in an 8-second toast.
//   Also extracted handleCommandCapture() to DRY up the Commands tab.

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
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { useAuth } from '@/contexts/AuthContext';
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

/** Result from /api/oracle/hunt */
interface HuntResult {
  verdict: 'BUY' | 'SELL' | 'HOLD' | 'SKIP' | 'SCAN';
  itemName?: string;
  estimatedValue?: {
    low?: number;
    mid?: number;
    high?: number;
  };
  reason?: string;
  category?: string;
  confidence?: number;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_BATCH_SIZE = 20;
const CONTINUOUS_INTERVAL_MS = 2000; // 1 frame every 2 seconds in continuous mode

// Verdict display config
const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle }> = {
  BUY: { color: 'text-green-400', bg: 'bg-green-900/50', icon: CheckCircle },
  SELL: { color: 'text-blue-400', bg: 'bg-blue-900/50', icon: DollarSign },
  HOLD: { color: 'text-yellow-400', bg: 'bg-yellow-900/50', icon: AlertTriangle },
  SKIP: { color: 'text-red-400', bg: 'bg-red-900/50', icon: XCircle },
  SCAN: { color: 'text-gray-400', bg: 'bg-gray-800/50', icon: Eye },
};

// =============================================================================
// COMPONENT
// =============================================================================

const SmartGlassesControl: React.FC<SmartGlassesControlProps> = ({
  onCaptureItem,
  onBatchCapture,
}) => {
  // — Hooks ——————————————————————————————————————————————————
  const {
    metaGlasses,
    requestGlassesCameraPermission,
    startGlassesSession,
    stopGlassesSession,
    captureGlassesFrame,
    refreshGlassesStatus,
  } = useBluetoothManager();

  const { session } = useAuth();

  // — Local state ————————————————————————————————————————————
  const [captureMode, setCaptureMode] = useState<'single' | 'batch' | 'continuous'>('single');
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [lastCapture, setLastCapture] = useState<CapturedFrame | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const continuousRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // v13: Scan results displayed inline
  const [scanResult, setScanResult] = useState<HuntResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanHistory, setScanHistory] = useState<HuntResult[]>([]);

  // — Settings (stored on device, not server) ————————————————
  const [imageQuality, setImageQuality] = useState<'720p' | '1080p' | '480p'>('720p');
  const [realtimeAnalysis, setRealtimeAnalysis] = useState(true);
  const [voiceFeedback, setVoiceFeedback] = useState(true);
  const [autoCapture, setAutoCapture] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // v13: Call /api/oracle/hunt directly — the actual fix
  // ═══════════════════════════════════════════════════════════

  const analyzeImage = useCallback(async (base64: string): Promise<HuntResult | null> => {
    if (!session?.access_token) {
      toast.error('Not authenticated');
      return null;
    }

    setIsAnalyzing(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/oracle/hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image: base64,
          deviceType: 'glasses',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.message || `Server error: ${response.status}`;
        toast.error('Scan failed', { description: errorMsg });
        console.error('[Glasses] Hunt API error:', response.status, errorData);
        return null;
      }

      const result: HuntResult = await response.json();
      setScanResult(result);

      // Add to scan history (keep last 10)
      setScanHistory(prev => [result, ...prev].slice(0, 10));

      // Toast with verdict
      if (result.verdict === 'BUY') {
        const value = result.estimatedValue?.mid
          ? `$${result.estimatedValue.mid.toFixed(0)}`
          : '';
        toast.success(`${result.verdict}: ${result.itemName || 'Item found'} ${value}`, {
          duration: 5000,
        });
      } else if (result.verdict === 'SCAN') {
        toast.info('Need a clearer look \u2014 try a full scan', { duration: 3000 });
      } else {
        toast.info(`${result.verdict}: ${result.itemName || 'Item scanned'}`, {
          duration: 4000,
        });
      }

      return result;

    } catch (error: any) {
      console.error('[Glasses] Hunt API call failed:', error);
      toast.error('Connection error', {
        description: 'Could not reach the server. Check your connection.',
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [session?.access_token]);

  // ═══════════════════════════════════════════════════════════
  // v13.1: Safe capture wrapper — shows REAL errors
  //
  // v13 had NO catch block around captureGlassesFrame(). If the
  // Capacitor plugin threw (instead of returning null), the error
  // was silently swallowed. This wrapper catches, logs, and shows
  // the actual error message in an 8-second toast for diagnosis.
  // ═══════════════════════════════════════════════════════════

  const safeCapture = useCallback(async (): Promise<CapturedFrame | null> => {
    try {
      console.log('[Glasses v13.1] captureGlassesFrame() calling...');
      const frame = await captureGlassesFrame();
      if (frame) {
        console.log('[Glasses v13.1] Got frame:', frame.width, 'x', frame.height, 'base64 length:', frame.base64?.length);
      } else {
        console.warn('[Glasses v13.1] captureGlassesFrame() returned null/undefined');
      }
      return frame;
    } catch (err: any) {
      // THIS is the v13.1 diagnostic. v13 had no catch here.
      const msg = err?.message || err?.toString?.() || 'Unknown capture error';
      console.error('[Glasses v13.1] captureGlassesFrame() THREW:', msg, err);
      toast.error('Capture error', { description: msg, duration: 8000 });
      return null;
    }
  }, [captureGlassesFrame]);

  // ═══════════════════════════════════════════════════════════
  // Capture + Analyze handlers (v13 wired, v13.1 safe)
  // ═══════════════════════════════════════════════════════════

  // v12 FIX: Request camera permission THEN start session.
  const handleStartSession = useCallback(async () => {
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

    const success = await startGlassesSession();
    if (success) {
      toast.success('Glasses camera active');
    }
  }, [metaGlasses.cameraPermissionGranted, requestGlassesCameraPermission, startGlassesSession]);

  const handleStopSession = useCallback(async () => {
    if (continuousRef.current) {
      clearInterval(continuousRef.current);
      continuousRef.current = null;
      setIsContinuous(false);
    }
    await stopGlassesSession();
  }, [stopGlassesSession]);

  // v13.1: Single capture uses safeCapture() wrapper
  const handleSingleCapture = useCallback(async () => {
    if (isCapturing || isAnalyzing) return;
    setIsCapturing(true);

    try {
      const frame = await safeCapture();
      if (frame) {
        setLastCapture({ ...frame, timestamp: Date.now() });

        // v13: Call the hunt API directly — this is the fix
        await analyzeImage(frame.base64);

        // Also fire parent callback if provided (backward compat)
        onCaptureItem?.(frame.base64);
      } else {
        // safeCapture already showed a toast if it threw.
        // This branch = returned null without throwing (plugin said "no frame").
        toast.error('Capture returned empty \u2014 try again');
      }
    } catch (err: any) {
      // Catch anything analyzeImage or onCaptureItem might throw
      console.error('[Glasses v13.1] handleSingleCapture outer error:', err);
      toast.error('Capture pipeline error', { description: err?.message || 'Unknown' });
    } finally {
      setIsCapturing(false);
    }
  }, [safeCapture, analyzeImage, onCaptureItem, isCapturing, isAnalyzing]);

  // v13.1: Batch capture uses safeCapture() wrapper
  const handleBatchCapture = useCallback(async () => {
    if (isCapturing || batchImages.length >= MAX_BATCH_SIZE) return;
    setIsCapturing(true);

    try {
      const frame = await safeCapture();
      if (frame) {
        setBatchImages(prev => [...prev, frame.base64]);
        setLastCapture({ ...frame, timestamp: Date.now() });
        toast.info(`Batch: ${batchImages.length + 1} items`);
      } else {
        toast.error('Batch capture returned empty');
      }
    } catch (err: any) {
      console.error('[Glasses v13.1] handleBatchCapture error:', err);
      toast.error('Batch capture error', { description: err?.message || 'Unknown' });
    } finally {
      setIsCapturing(false);
    }
  }, [safeCapture, batchImages.length, isCapturing]);

  // v13: Batch process calls hunt with images array
  const handleFinishBatch = useCallback(async () => {
    if (batchImages.length === 0) return;

    setIsAnalyzing(true);
    toast.info(`Processing ${batchImages.length} items...`);

    try {
      const response = await fetch('/api/oracle/hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          images: batchImages,
          deviceType: 'glasses',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Processed ${data.count || batchImages.length} items`);

        // Add batch results to history
        if (Array.isArray(data.results)) {
          setScanHistory(prev => [...data.results, ...prev].slice(0, 20));
          if (data.results.length > 0) {
            setScanResult(data.results[0]); // Show first result
          }
        }
      } else {
        toast.error('Batch processing failed');
      }

      // Also fire parent callback if provided
      onBatchCapture?.(batchImages);

    } catch (error: any) {
      console.error('[Glasses] Batch hunt failed:', error);
      toast.error('Connection error during batch processing');
    } finally {
      setIsAnalyzing(false);
      setBatchImages([]);
      setLastCapture(null);
    }
  }, [batchImages, session?.access_token, onBatchCapture]);

  const handleClearBatch = useCallback(() => {
    setBatchImages([]);
    setLastCapture(null);
  }, []);

  // v13.1: Continuous mode uses safeCapture() wrapper
  const handleToggleContinuous = useCallback(() => {
    if (isContinuous) {
      if (continuousRef.current) {
        clearInterval(continuousRef.current);
        continuousRef.current = null;
      }
      setIsContinuous(false);
      toast.info('Continuous capture stopped');
    } else {
      setIsContinuous(true);
      toast.success('Continuous capture started');

      continuousRef.current = setInterval(async () => {
        const frame = await safeCapture();
        if (frame) {
          setLastCapture({ ...frame, timestamp: Date.now() });
          // v13: Each frame goes to hunt API
          await analyzeImage(frame.base64);
          onCaptureItem?.(frame.base64);
        }
      }, CONTINUOUS_INTERVAL_MS);
    }
  }, [isContinuous, safeCapture, analyzeImage, onCaptureItem]);

  // v13.1: Extracted shared handler for Commands tab (DRY)
  const handleCommandCapture = useCallback(async () => {
    const frame = await safeCapture();
    if (frame) {
      setLastCapture({ ...frame, timestamp: Date.now() });
      await analyzeImage(frame.base64);
      onCaptureItem?.(frame.base64);
    }
  }, [safeCapture, analyzeImage, onCaptureItem]);

  // — Not connected / not available states ————————————————————

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
              ? `${metaGlasses.deviceName || 'Glasses'} connected \u2014 start a camera session to begin scanning.`
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

  // v13: Verdict display helper
  const verdictDisplay = scanResult && VERDICT_CONFIG[scanResult.verdict];
  const VerdictIcon = verdictDisplay?.icon || Eye;

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

          {(isCapturing || isAnalyzing) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
                <p className="text-white text-xs mt-2">
                  {isAnalyzing ? 'Analyzing...' : 'Capturing...'}
                </p>
              </div>
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

        {/* v13: Scan Result Display */}
        {scanResult && (
          <div className={`rounded-lg p-3 ${verdictDisplay?.bg || 'bg-gray-800/50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <VerdictIcon className={`w-5 h-5 ${verdictDisplay?.color || 'text-gray-400'}`} />
              <span className={`font-bold text-lg ${verdictDisplay?.color || 'text-gray-400'}`}>
                {scanResult.verdict}
              </span>
              {scanResult.estimatedValue?.mid && (
                <span className="ml-auto text-green-400 font-bold text-lg">
                  ${scanResult.estimatedValue.mid.toFixed(0)}
                </span>
              )}
            </div>
            {scanResult.itemName && (
              <p className="text-white text-sm font-medium">{scanResult.itemName}</p>
            )}
            {scanResult.reason && (
              <p className="text-gray-300 text-xs mt-1">{scanResult.reason}</p>
            )}
            {scanResult.estimatedValue?.low && scanResult.estimatedValue?.high && (
              <p className="text-gray-400 text-xs mt-1">
                Range: ${scanResult.estimatedValue.low.toFixed(0)} \u2013 ${scanResult.estimatedValue.high.toFixed(0)}
              </p>
            )}
          </div>
        )}

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
                disabled={isCapturing || isAnalyzing}
              >
                {isCapturing || isAnalyzing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Capture Item'}
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
                    disabled={batchImages.length === 0 || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
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

            {/* v13: Recent scan history */}
            {scanHistory.length > 1 && (
              <div className="space-y-1 pt-2 border-t border-gray-700">
                <p className="text-xs text-muted-foreground">Recent scans</p>
                {scanHistory.slice(1, 4).map((result, i) => {
                  const cfg = VERDICT_CONFIG[result.verdict];
                  return (
                    <div key={i} className="flex items-center justify-between text-xs py-1">
                      <span className={`font-medium ${cfg?.color || 'text-gray-400'}`}>
                        {result.verdict}
                      </span>
                      <span className="text-gray-400 truncate max-w-[60%]">
                        {result.itemName || 'Unknown'}
                      </span>
                      {result.estimatedValue?.mid && (
                        <span className="text-green-400">
                          ${result.estimatedValue.mid.toFixed(0)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* — Commands Tab (v13.1: uses handleCommandCapture) ——— */}
          <TabsContent value="commands" className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">
              Quick actions \u2014 capture + send to analysis pipeline.
            </p>
            <Button
              onClick={handleCommandCapture}
              className="w-full justify-start"
              variant="outline"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Identify Item
            </Button>
            <Button
              onClick={handleCommandCapture}
              className="w-full justify-start"
              variant="outline"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4 mr-2" />
              )}
              Estimate Value
            </Button>
            <Button
              onClick={handleCommandCapture}
              className="w-full justify-start"
              variant="outline"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <List className="w-4 h-4 mr-2" />
              )}
              Create Listing
            </Button>
            <Button
              onClick={() => {
                setCaptureMode('continuous');
                if (!isContinuous) handleToggleContinuous();
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
                  <SelectItem value="720p">HD (720p) \u2014 recommended</SelectItem>
                  <SelectItem value="480p">SD (480p) \u2014 fast</SelectItem>
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