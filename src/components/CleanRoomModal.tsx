import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Sparkles, Download, RotateCcw } from 'lucide-react';

interface CleanRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
}

const CleanRoomModal: React.FC<CleanRoomModalProps> = ({
  open,
  onOpenChange,
  imageUrl
}) => {
  const [brightness, setBrightness] = useState([50]);
  const [contrast, setContrast] = useState([50]);
  const [saturation, setSaturation] = useState([50]);
  const [sharpness, setSharpness] = useState([50]);
  const [isProcessing, setIsProcessing] = useState(false);

  const resetSettings = () => {
    setBrightness([50]);
    setContrast([50]);
    setSaturation([50]);
    setSharpness([50]);
  };

  const applyEnhancements = () => {
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

  const downloadImage = () => {
    // Simulate download
    const link = document.createElement('a');
    link.href = imageUrl || 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png';
    link.download = 'enhanced-image.jpg';
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Clean Room - Image Enhancement
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="Item to enhance" 
                      className="max-w-full max-h-full object-contain rounded-lg"
                      style={{
                        filter: `brightness(${brightness[0]}%) contrast(${contrast[0]}%) saturate(${saturation[0]}%) blur(${sharpness[0] < 50 ? (50 - sharpness[0]) / 10 : 0}px)`
                      }}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-2" />
                      <p>No image selected</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Badge variant="secondary">AI Enhanced</Badge>
                  <Badge variant="outline">High Quality</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhancement Controls */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Brightness: {brightness[0]}%</Label>
                <Slider
                  value={brightness}
                  onValueChange={setBrightness}
                  max={200}
                  step={1}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label>Contrast: {contrast[0]}%</Label>
                <Slider
                  value={contrast}
                  onValueChange={setContrast}
                  max={200}
                  step={1}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label>Saturation: {saturation[0]}%</Label>
                <Slider
                  value={saturation}
                  onValueChange={setSaturation}
                  max={200}
                  step={1}
                  className="mt-2"
                />
              </div>
              
              <div>
                <Label>Sharpness: {sharpness[0]}%</Label>
                <Slider
                  value={sharpness}
                  onValueChange={setSharpness}
                  max={100}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetSettings}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={applyEnhancements}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Enhance
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={downloadImage}
              variant="secondary"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Enhanced Image
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CleanRoomModal;