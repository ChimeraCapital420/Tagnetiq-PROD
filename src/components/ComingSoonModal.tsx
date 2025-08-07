import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({ isOpen, onClose, featureName }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Coming Soon
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="text-gray-600">
            <strong>{featureName}</strong> is part of our core engine and will be available soon!
          </div>
          
          <div className="text-sm text-gray-500">
            This feature is always running in the background to power your treasure hunting experience.
          </div>
          
          <Button onClick={onClose} className="w-full">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComingSoonModal;