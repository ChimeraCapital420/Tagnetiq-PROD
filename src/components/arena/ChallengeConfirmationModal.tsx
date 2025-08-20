import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VaultItem } from '@/pages/Vault';

interface ChallengeConfirmationModalProps {
  item: VaultItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (askingPrice: number) => void;
}

export const ChallengeConfirmationModal: React.FC<ChallengeConfirmationModalProps> = ({ item, isOpen, onClose, onConfirm }) => {
  const [askingPrice, setAskingPrice] = useState('');
  
  if (!isOpen) return null;

  const handleConfirm = () => {
    const price = parseFloat(askingPrice);
    if (!isNaN(price) && price > 0) {
      onConfirm(price);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Public ROI Challenge?</DialogTitle>
          <DialogDescription>
            This will create a public listing for your "{item.asset_name}" in the Tagnetiq Arena. Please set an asking price.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="asking-price">Asking Price (USD)</Label>
          <Input 
            id="asking-price" 
            type="number" 
            placeholder="e.g., 150.00" 
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)} 
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!askingPrice}>Confirm & Start Challenge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};