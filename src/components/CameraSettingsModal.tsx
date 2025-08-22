// FILE: src/components/CameraSettingsModal.tsx (CREATE THIS NEW FILE)

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Zap, Sun, ZoomIn } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handlePlaceholderClick = (feature: string) => {
    toast.info(`${feature} feature coming soon!`);
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Camera Settings</CardTitle>
              <CardDescription>Adjust camera options.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
                <Label htmlFor="torch-mode" className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    <span>Flashlight / Torch</span>
                </Label>
                <Switch id="torch-mode" onClick={() => handlePlaceholderClick('Flashlight')} />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="hdr-mode" className="flex items-center gap-2">
                    <Sun className="w-5 h-5" />
                    <span>HDR Mode</span>
                </Label>
                <Switch id="hdr-mode" onClick={() => handlePlaceholderClick('HDR')} />
            </div>
            <div className="flex items-center justify-between">
                <Label htmlFor="zoom-mode" className="flex items-center gap-2">
                    <ZoomIn className="w-5 h-5" />
                    <span>Enable Zoom Controls</span>
                </Label>
                <Switch id="zoom-mode" onClick={() => handlePlaceholderClick('Zoom')} />
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CameraSettingsModal;
