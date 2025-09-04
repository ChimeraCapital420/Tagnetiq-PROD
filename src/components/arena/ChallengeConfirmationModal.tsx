// FILE: src/components/arena/ChallengeConfirmationModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { VaultItem } from '@/pages/Vault';

interface ChallengeConfirmationModalProps {
  item: VaultItem | null;
  isOpen: boolean;
  onClose?: () => void; // Made optional with ?
  onConfirm: (purchasePrice: number, askingPrice: number) => void;
}

const ChallengeConfirmationModal: React.FC<ChallengeConfirmationModalProps> = ({ 
  item, 
  isOpen, 
  onClose = () => {}, // Provide default empty function
  onConfirm 
}) => {
  const [purchasePrice, setPurchasePrice] = useState('');
  const [askingPrice, setAskingPrice] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPurchasePrice('');
      setAskingPrice('');
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const handleConfirm = () => {
    const purchaseNum = parseFloat(purchasePrice);
    const askingNum = parseFloat(askingPrice);
    if (!isNaN(purchaseNum) && purchaseNum > 0 && !isNaN(askingNum) && askingNum > 0) {
      onConfirm(purchaseNum, askingNum);
    } else {
      alert('Please enter a valid, positive number for both prices.');
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start Public ROI Challenge?</DialogTitle>
          <DialogDescription>
            This will create a public listing for your "{item.asset_name}" in the Tagnetiq Arena. Enter the prices to begin.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="purchase-price">Original Purchase Price (USD)</Label>
            <Input 
              id="purchase-price" 
              type="number" 
              placeholder="e.g., 100.00" 
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asking-price">Public Asking Price (USD)</Label>
            <Input 
              id="asking-price" 
              type="number" 
              placeholder="e.g., 150.00" 
              value={askingPrice}
              onChange={(e) => setAskingPrice(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!purchasePrice || !askingPrice}>Confirm & Start Challenge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengeConfirmationModal;