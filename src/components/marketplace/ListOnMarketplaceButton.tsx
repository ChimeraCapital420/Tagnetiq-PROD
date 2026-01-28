// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Updated to use the new ExportListingModal with multi-platform support

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Store, ExternalLink, Loader2 } from 'lucide-react';
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
  // Authority data
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

  // Convert analysis result to marketplace item format
  const marketplaceItem = {
    id: '', // Will be created on list
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

  // Handle listing on TagnetIQ
  const handleListOnTagnetiq = async (
    item: typeof marketplaceItem,
    askingPrice: number,
    description: string
  ) => {
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
        asset_name: item.item_name,
        valuation_data: analysisResult,
        photos: item.additional_photos 
          ? [item.primary_photo_url, ...item.additional_photos]
          : [item.primary_photo_url],
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