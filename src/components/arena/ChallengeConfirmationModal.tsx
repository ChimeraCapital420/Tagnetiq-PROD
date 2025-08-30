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
  onClose: () => void;
  onConfirm: (purchasePrice: number, askingPrice: number) => void;
}

// HEPHAESTUS NOTE: Changed from a named export to a constant.
const ChallengeConfirmationModal: React.FC<ChallengeConfirmationModalProps> = ({ item, isOpen, onClose, onConfirm }) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!purchasePrice || !askingPrice}>Confirm & Start Challenge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// HEPHAESTUS NOTE: Added a default export to match the import in Vault.tsx.
export default ChallengeConfirmationModal;