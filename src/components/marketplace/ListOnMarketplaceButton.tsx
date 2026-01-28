// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Fixed to match arena/listings API schema

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

// Map our condition strings to API enum values
const mapCondition = (condition?: string): string => {
  const conditionMap: Record<string, string> = {
    'mint': 'mint',
    'near mint': 'near-mint',
    'near-mint': 'near-mint',
    'nearmint': 'near-mint',
    'excellent': 'excellent',
    'good': 'good',
    'fair': 'fair',
    'poor': 'poor',
  };
  const normalized = (condition || 'good').toLowerCase().trim();
  return conditionMap[normalized] || 'good';
};

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
          name: 'Marketplace Listings',
          description: 'Items listed on the marketplace',
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

    // Step 1: Get or create default vault
    const vaultId = await fetchDefaultVault(session.access_token);

    // Step 2: Collect all image URLs
    const allPhotos = [
      item.primary_photo_url,
      ...(item.additional_photos || [])
    ].filter(Boolean) as string[];

    // Step 3: Add item to vault
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
        photos: allPhotos,
        category: item.category,
      }),
    });

    if (!vaultResponse.ok) {
      const errorData = await vaultResponse.json();
      throw new Error(errorData.error || 'Failed to add item to vault.');
    }

    const vaultItem = await vaultResponse.json();

    // Step 4: Create marketplace listing with CORRECT field names
    // Ensure description meets 20 char minimum
    const finalDescription = description && description.length >= 20 
      ? description 
      : `${item.item_name}. ${description || 'Listed on TagnetIQ Marketplace.'}`.slice(0, 2000);

    const listingPayload = {
      vault_item_id: vaultItem.id,
      title: item.item_name.slice(0, 100), // API expects 'title', max 100 chars
      description: finalDescription,        // min 20, max 2000 chars
      price: askingPrice,                   // API expects 'price', not 'asking_price'
      condition: mapCondition(item.condition), // Must be enum value
      images: allPhotos.length > 0 ? allPhotos : ['https://tagnetiq.com/placeholder.svg'], // API expects array
      shipping_included: false,             // Required field
      accepts_trades: false,                // Required field
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
      console.error('Listing error:', errorData);
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