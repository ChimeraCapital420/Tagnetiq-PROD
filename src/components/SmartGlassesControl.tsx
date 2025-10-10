// FILE: src/components/SmartGlassesControl.tsx
// PROJECT CERULEAN: Smart Glasses Control Interface

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Camera,
  Zap,
  Eye,
  Package,
  DollarSign,
  List,
  Download,
  Upload,
  Glasses,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { toast } from 'sonner';

interface SmartGlassesControlProps {
  onCaptureItem?: (imageData: string) => void;
  onBatchCapture?: (images: string[]) => void;
}

const SmartGlassesControl: React.FC<SmartGlassesControlProps> = ({
  onCaptureItem,
  onBatchCapture
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [captureMode, setCaptureMode] = useState<'single' | 'batch' | 'continuous'>('single');
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [signalStrength, setSignalStrength] = useState(4);
  
  const {
    connectedDevice,
    smartGlassesStream,
    startSmartGlassesStream,
    stopSmartGlassesStream,
    sendCommandToGlasses
  } = useBluetoothManager();

  useEffect(() => {
    if (smartGlassesStream?.videoStream && videoRef.current) {
      videoRef.current.srcObject = smartGlassesStream.videoStream;
      setIsStreaming(true);
    }
  }, [smartGlassesStream]);

  const handleStartStream = async () => {
    await startSmartGlassesStream();
  };

  const handleStopStream = () => {
    stopSmartGlassesStream();
    setIsStreaming(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.95);
  };

  const handleSingleCapture = () => {
    const imageData = captureFrame();
    if (imageData) {
      onCaptureItem?.(imageData);
      sendCommandToGlasses('CAPTURE_SINGLE');
      toast.success('Item captured');
    }
  };

  const handleBatchCapture = () => {
    const imageData = captureFrame();
    if (imageData) {
      setBatchImages(prev => [...prev, imageData]);
      sendCommandToGlasses('CAPTURE_BATCH');
      toast.info(`Batch capture: ${batchImages.length + 1} items`);
    }
  };

  const handleFinishBatch = () => {
    if (batchImages.length > 0) {
      onBatchCapture?.(batchImages);
      setBatchImages([]);
      sendCommandToGlasses('BATCH_COMPLETE');
      toast.success(`Processed ${batchImages.length} items`);
    }
  };

  const handleVoiceCommand = (command: string) => {
    sendCommandToGlasses(`VOICE:${command}`);
  };

  if (!connectedDevice || connectedDevice.deviceType !== 'smart-glasses') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Glasses className="w-5 h-5" />
            Smart Glasses Control
          </CardTitle>
          <CardDescription>
            No smart glasses connected. Pair your device to continue.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Glasses className="w-5 h-5" />
              {connectedDevice.name}
            </CardTitle>
            <CardDescription>
              Smart glasses control panel
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Signal className="w-4 h-4" />
              <span className="text-sm">{signalStrength}/5</span>
            </div>
            <div className="flex items-center gap-1">
              <Battery className="w-4 h-4" />
              <span className="text-sm">{batteryLevel}%</span>
            </div>
            <Badge variant={isStreaming ? 'default' : 'secondary'}>
              {isStreaming ? 'Live' : 'Idle'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isStreaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={handleStartStream} size="lg">
                <Video className="w-4 h-4 mr-2" />
                Start Stream
              </Button>
            </div>
          )}
          
          {isStreaming && (
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                size="icon"
                variant="secondary"
                onClick={handleStopStream}
              >
                <VideoOff className="w-4 h-4" />
              </Button>
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

          <TabsContent value="capture" className="space-y-4">
            {/* Capture Mode Selection */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={captureMode === 'single' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('single')}
              >
                <Camera className="w-4 h-4 mr-2" />
                Single
              </Button>
              <Button
                variant={captureMode === 'batch' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('batch')}
              >
                <Package className="w-4 h-4 mr-2" />
                Batch
              </Button>
              <Button
                variant={captureMode === 'continuous' ? 'default' : 'outline'}
                onClick={() => setCaptureMode('continuous')}
              >
                <Zap className="w-4 h-4 mr-2" />
                Continuous
              </Button>
            </div>

            {/* Capture Actions */}
            <div className="space-y-2">
              {captureMode === 'single' && (
                <Button 
                  onClick={handleSingleCapture}
                  className="w-full"
                  size="lg"
                  disabled={!isStreaming}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture Item
                </Button>
              )}
              
              {captureMode === 'batch' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleBatchCapture}
                      className="flex-1"
                      disabled={!isStreaming}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Add to Batch ({batchImages.length})
                    </Button>
                    <Button 
                      onClick={handleFinishBatch}
                      variant="secondary"
                      disabled={batchImages.length === 0}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Process Batch
                    </Button>
                  </div>
                  {batchImages.length > 0 && (
                    <Progress value={(batchImages.length / 20) * 100} />
                  )}
                </div>
              )}
              
              {captureMode === 'continuous' && (
                <Button 
                  onClick={() => setIsRecording(!isRecording)}
                  className="w-full"
                  size="lg"
                  variant={isRecording ? 'destructive' : 'default'}
                  disabled={!isStreaming}
                >
                  {isRecording ? (
                    <>Stop Recording</>
                  ) : (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="commands" className="space-y-2">
            <Button 
              onClick={() => handleVoiceCommand('IDENTIFY_ITEM')}
              className="w-full justify-start"
              variant="outline"
            >
              <Eye className="w-4 h-4 mr-2" />
              Identify Item
            </Button>
            <Button 
              onClick={() => handleVoiceCommand('ESTIMATE_VALUE')}
              className="w-full justify-start"
              variant="outline"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Estimate Value
            </Button>
            <Button 
              onClick={() => handleVoiceCommand('CREATE_LISTING')}
              className="w-full justify-start"
              variant="outline"
            >
              <List className="w-4 h-4 mr-2" />
              Create Listing
            </Button>
            <Button 
              onClick={() => handleVoiceCommand('ROOM_SCAN')}
              className="w-full justify-start"
              variant="outline"
            >
              <Package className="w-4 h-4 mr-2" />
              Room Inventory
            </Button>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-2">
              <Label>Video Quality</Label>
              <Select defaultValue="1080p">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4k">4K (2160p)</SelectItem>
                  <SelectItem value="1080p">Full HD (1080p)</SelectItem>
                  <SelectItem value="720p">HD (720p)</SelectItem>
                  <SelectItem value="480p">SD (480p)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>AI Processing</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Real-time Analysis</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Voice Feedback</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Auto-capture Valuable Items</span>
                <Switch />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SmartGlassesControl;