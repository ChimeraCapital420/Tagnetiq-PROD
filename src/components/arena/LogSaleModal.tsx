// FILE: src/components/arena/LogSaleModal.tsx

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface LogSaleModalProps {
  challengeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roi: number) => void;
}

export const LogSaleModal: React.FC<LogSaleModalProps> = ({ challengeId, isOpen, onClose, onSuccess }) => {
  const [salePrice, setSalePrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const price = parseFloat(salePrice);
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid sale price.");
      return;
    }

    setIsLoading(true);
    try {
        const response = await fetch('/api/arena/log-sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId, salePrice: price }),
        });

        if (!response.ok) {
            const { error } = await response.json();
            throw new Error(error || 'Failed to log sale.');
        }

        const { roi } = await response.json();
        toast.success("Challenge Completed!", { description: `You achieved a ${roi}% ROI.`});
        onSuccess(roi);
        onClose();
    } catch (error) {
        toast.error("Error", { description: (error as Error).message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Final Sale</DialogTitle>
          <DialogDescription>
            Enter the final sale price to complete this challenge. This action is irreversible.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="sale-price">Final Sale Price (USD)</Label>
          <Input 
            id="sale-price" 
            type="number" 
            placeholder="e.g., 125.50" 
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)} 
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!salePrice || isLoading}>
            {isLoading ? "Logging..." : "Confirm & Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};