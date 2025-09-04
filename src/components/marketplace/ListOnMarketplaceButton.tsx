// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Store, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ListOnMarketplaceButtonProps {
  analysisResult: any;
  onSuccess: () => void;
}

export const ListOnMarketplaceButton: React.FC<ListOnMarketplaceButtonProps> = ({ analysisResult, onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [askingPrice, setAskingPrice] = useState(analysisResult.estimatedValue?.toString() || '');
  const [description, setDescription] = useState('');
  const navigate = useNavigate();

  const handleList = async () => {
    setIsLoading(true);
    const toastId = toast.loading('Creating marketplace listing...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // First, add to vault if not already there
      const vaultResponse = await fetch('/api/vault/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          asset_name: analysisResult.itemName || 'Untitled Asset',
          valuation_data: analysisResult,
          photos: analysisResult.imageUrls || [analysisResult.imageUrl],
        }),
      });

      if (!vaultResponse.ok) {
        const errorData = await vaultResponse.json();
        throw new Error(errorData.error || 'Failed to add item to vault.');
      }

      const vaultItem = await vaultResponse.json();

      // Then create marketplace listing
      const listingPayload = {
        vault_item_id: vaultItem.id,
        asking_price: parseFloat(askingPrice),
        purchase_price: analysisResult.estimatedValue || 0,
        item_name: analysisResult.itemName,
        primary_photo_url: analysisResult.imageUrl,
        description: description || analysisResult.summary_reasoning,
        category: analysisResult.category || 'General Collectibles'
      };

      const listingResponse = await fetch('/api/arena/listings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listingPayload),
      });

      if (!listingResponse.ok) {
        const errorData = await listingResponse.json();
        throw new Error(errorData.error || 'Failed to create marketplace listing.');
      }

      toast.success('Listed on Tagnetiq Marketplace!', {
        id: toastId,
        action: {
          label: 'View Listing',
          onClick: () => navigate('/marketplace'),
        },
      });

      setIsOpen(false);
      onSuccess();

    } catch (error: any) {
      toast.error("Failed to create listing", {
        id: toastId,
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="secondary" 
        className="w-full" 
        onClick={() => setIsOpen(true)}
      >
        <Store className="mr-2 h-4 w-4" />
        List on Marketplace
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List on Tagnetiq Marketplace</DialogTitle>
            <DialogDescription>
              Set your asking price and add a description for your {analysisResult.itemName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="price">Asking Price (USD)</Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                AI Estimated Value: ${analysisResult.estimatedValue?.toFixed(2) || '0.00'}
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details about your item..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleList} disabled={isLoading || !askingPrice}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              List Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};