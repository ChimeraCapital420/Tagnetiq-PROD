// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Updated to fetch vault_id before creating listing
// All listings go to TagnetIQ by default (future: user preference to opt-out)

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Store } from 'lucide-react';
import { toast } from 'sonner';

import { ExportListingModal } from './ExportListingModal';

interface AnalysisResult {
  itemName?: string;
  estimatedValue?: number;
  imageUrl?: string;
  imageUrls?: string[];
  category?: string;
  condition?: string;
  summary_reasoning?: string;
  confidence?: number;
  is_verified?: boolean;
  brand?: string;
  model?: string;
  year?: string;
  dimensions?: string;
  color?: string;
}

interface ListOnMarketplaceButtonProps {
  analysisResult: AnalysisResult;
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const ListOnMarketplaceButton: React.FC<ListOnMarketplaceButtonProps> = ({
  analysisResult,
  onSuccess,
  variant = 'secondary',
  size = 'default',
  className = 'w-full',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const marketplaceItem = {
    id: '',
    item_name: analysisResult.itemName || 'Untitled Asset',
    asking_price: analysisResult.estimatedValue || 0,
    estimated_value: analysisResult.estimatedValue,
    primary_photo_url: analysisResult.imageUrl || analysisResult.imageUrls?.[0],
    additional_photos: analysisResult.imageUrls?.slice(1),
    is_verified: analysisResult.is_verified || false,
    confidence_score: analysisResult.confidence,
    category: analysisResult.category || 'General Collectibles',
    condition: analysisResult.condition || 'Good',
    description: analysisResult.summary_reasoning || '',
    brand: analysisResult.brand,
    model: analysisResult.model,
    year: analysisResult.year,
    dimensions: analysisResult.dimensions,
    color: analysisResult.color,
  };

  const fetchDefaultVault = async (accessToken: string): Promise<string> => {
    const response = await fetch('/api/vault', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!response.ok) throw new Error('Failed to fetch vaults');

    const vaults = await response.json();
    
    if (!vaults || vaults.length === 0) {
      const createResponse = await fetch('/api/vault', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'My Collection',
          description: 'Default vault for marketplace listings',
        }),
      });

      if (!createResponse.ok) throw new Error('Failed to create default vault');

      const newVault = await createResponse.json();
      return newVault.id;
    }

    return vaults[0].id;
  };

  const handleListOnTagnetiq = async (
    item: typeof marketplaceItem,
    askingPrice: number,
    description: string
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const vaultId = await fetchDefaultVault(session.access_token);

    const vaultResponse = await fetch('/api/vault/items', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vault_id: vaultId,
        asset_name: item.item_name,
        valuation_data: analysisResult,
        photos: item.additional_photos
          ? [item.primary_photo_url, ...item.additional_photos].filter(Boolean)
          : [item.primary_photo_url].filter(Boolean),
        category: item.category,
      }),
    });

    if (!vaultResponse.ok) {
      const errorData = await vaultResponse.json();
      throw new Error(errorData.error || 'Failed to add item to vault.');
    }

    const vaultItem = await vaultResponse.json();

    const listingResponse = await fetch('/api/arena/listings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vault_item_id: vaultItem.id,
        asking_price: askingPrice,
        purchase_price: item.estimated_value || 0,
        item_name: item.item_name,
        primary_photo_url: item.primary_photo_url,
        description: description,
        category: item.category,
        condition: item.condition,
        is_verified: item.is_verified,
        confidence_score: item.confidence_score,
        estimated_value: item.estimated_value,
      }),
    });

    if (!listingResponse.ok) {
      const errorData = await listingResponse.json();
      throw new Error(errorData.error || 'Failed to create marketplace listing.');
    }

    toast.success('Listed on TagnetIQ Marketplace!', {
      action: {
        label: 'View Listing',
        onClick: () => navigate('/arena/marketplace'),
      },
    });

    onSuccess?.();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <Store className="mr-2 h-4 w-4" />
        List & Export
      </Button>

      <ExportListingModal
        open={isOpen}
        onOpenChange={setIsOpen}
        item={marketplaceItem}
        onListOnTagnetiq={handleListOnTagnetiq}
      />
    </>
  );
};

export default ListOnMarketplaceButton;