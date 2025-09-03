// FILE: src/components/vault/VaultArenabridge.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Package, Trophy, TrendingUp, Shield } from 'lucide-react';
import { VaultItem } from '@/types/vault';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface VaultArenaBridgeProps {
  item: VaultItem;
  currentValue?: number;
  onListingCreated?: () => void;
}

export const VaultArenaBridge: React.FC<VaultArenaBridgeProps> = ({
  item,
  currentValue,
  onListingCreated
}) => {
  const navigate = useNavigate();
  const [showListingDialog, setShowListingDialog] = useState(false);
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [listingData, setListingData] = useState({
    title: item.name,
    description: '',
    price: currentValue || 0,
    condition: 'excellent',
    shipping_included: false,
    accepts_trades: false
  });

  const valuationStatus = currentValue && item.acquisition_price
    ? currentValue > item.acquisition_price
      ? { text: 'Profit Opportunity', color: 'text-green-500', icon: TrendingUp }
      : { text: 'Hold Asset', color: 'text-yellow-500', icon: Shield }
    : null;

  const handleCreateListing = async () => {
    if (!listingData.description || listingData.price <= 0) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsCreatingListing(true);

    try {
      const response = await fetch('/api/arena/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          vault_item_id: item.id,
          title: listingData.title,
          description: listingData.description,
          price: listingData.price,
          condition: listingData.condition,
          images: item.images || [],
          shipping_included: listingData.shipping_included,
          accepts_trades: listingData.accepts_trades
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create listing');
      }

      toast.success('Listing created successfully!');
      setShowListingDialog(false);
      onListingCreated?.();
      
      // Navigate to the new listing
      const listing = await response.json();
      navigate(`/arena/listing/${listing.id}`);
    } catch (error) {
      console.error('Error creating listing:', error);
      toast.error('Failed to create listing');
    } finally {
      setIsCreatingListing(false);
    }
  };

  const handleChallengeClick = () => {
    navigate('/arena/marketplace', { 
      state: { 
        openChallengeModal: true, 
        defaultCategory: item.category,
        vaultItemId: item.id 
      } 
    });
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Arena Integration
            </CardTitle>
            {valuationStatus && (
              <Badge variant="outline" className={valuationStatus.color}>
                <valuationStatus.icon className="mr-1 h-3 w-3" />
                {valuationStatus.text}
              </Badge>
            )}
          </div>
          <CardDescription>
            Take your asset to the Arena marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentValue && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Valuation</p>
              <p className="text-2xl font-bold">${currentValue.toLocaleString()}</p>
              {item.acquisition_price && (
                <p className={`text-sm ${currentValue > item.acquisition_price ? 'text-green-500' : 'text-red-500'}`}>
                  {currentValue > item.acquisition_price ? '+' : ''}
                  {((currentValue - item.acquisition_price) / item.acquisition_price * 100).toFixed(1)}%
                  from acquisition
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3">
            <Button 
              variant="default" 
              className="w-full justify-between"
              onClick={() => setShowListingDialog(true)}
            >
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                List for Sale
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={handleChallengeClick}
            >
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Create Challenge
              </span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="link"
              size="sm"
              onClick={() => navigate('/arena/marketplace')}
            >
              Browse Arena Marketplace
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showListingDialog} onOpenChange={setShowListingDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Arena Listing</DialogTitle>
            <DialogDescription>
              List "{item.name}" for sale in the Arena marketplace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="listing-title">Listing Title</Label>
              <Input
                id="listing-title"
                value={listingData.title}
                onChange={(e) => setListingData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Eye-catching title for your listing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="listing-description">Description</Label>
              <Textarea
                id="listing-description"
                value={listingData.description}
                onChange={(e) => setListingData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the item, its condition, and why it's special..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="listing-price">Price ($)</Label>
                <Input
                  id="listing-price"
                  type="number"
                  step="0.01"
                  value={listingData.price}
                  onChange={(e) => setListingData(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="listing-condition">Condition</Label>
                <Select 
                  value={listingData.condition}
                  onValueChange={(value) => setListingData(prev => ({ ...prev, condition: value }))}
                >
                  <SelectTrigger id="listing-condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mint">Mint</SelectItem>
                    <SelectItem value="near-mint">Near Mint</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="shipping-included" className="flex flex-col">
                  <span>Free Shipping</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Shipping cost included in price
                  </span>
                </Label>
                <Switch
                  id="shipping-included"
                  checked={listingData.shipping_included}
                  onCheckedChange={(checked) => setListingData(prev => ({ ...prev, shipping_included: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="accepts-trades" className="flex flex-col">
                  <span>Accept Trades</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Open to trade offers
                  </span>
                </Label>
                <Switch
                  id="accepts-trades"
                  checked={listingData.accepts_trades}
                  onCheckedChange={(checked) => setListingData(prev => ({ ...prev, accepts_trades: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateListing} disabled={isCreatingListing}>
              {isCreatingListing ? 'Creating...' : 'Create Listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};