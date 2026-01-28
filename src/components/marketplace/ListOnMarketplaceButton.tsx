// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Enhanced with better error handling for mobile + detailed error messages

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
  // Authority source data
  authoritySource?: string;
  authorityData?: any;
}

interface ListOnMarketplaceButtonProps {
  analysisResult: AnalysisResult;
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

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
    // Pass authority info for AI distinction
    authoritySource: analysisResult.authoritySource,
    authorityData: analysisResult.authorityData,
  };

  const fetchDefaultVault = async (accessToken: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch('/api/vault', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Vault fetch failed: ${response.status}`);
      }

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

        if (!createResponse.ok) {
          const errData = await createResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create default vault');
        }

        const newVault = await createResponse.json();
        return newVault.id;
      }

      return vaults[0].id;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      throw error;
    }
  };

  const handleListOnTagnetiq = async (
    item: typeof marketplaceItem,
    askingPrice: number,
    description: string
  ) => {
    // Validate inputs
    if (!askingPrice || askingPrice <= 0) {
      throw new Error('Please enter a valid price greater than $0');
    }
    if (!description || description.length < 20) {
      throw new Error('Description must be at least 20 characters');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Please sign in to list items");

    // Show progress toast for mobile users
    const progressToast = toast.loading('Creating listing...', { duration: 30000 });

    try {
      // Step 1: Get or create vault
      toast.loading('Step 1/3: Preparing vault...', { id: progressToast });
      const vaultId = await fetchDefaultVault(session.access_token);

      // Step 2: Collect photos
      const allPhotos = [
        item.primary_photo_url,
        ...(item.additional_photos || [])
      ].filter(Boolean) as string[];

      // Step 3: Add to vault
      toast.loading('Step 2/3: Saving to vault...', { id: progressToast });
      const vaultController = new AbortController();
      const vaultTimeout = setTimeout(() => vaultController.abort(), 20000);

      const vaultResponse = await fetch('/api/vault/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_id: vaultId,
          asset_name: item.item_name,
          valuation_data: {
            ...item,
            estimatedValue: askingPrice,
            summary_reasoning: description,
          },
          photos: allPhotos,
          category: item.category,
        }),
        signal: vaultController.signal,
      });
      clearTimeout(vaultTimeout);

      if (!vaultResponse.ok) {
        const errorData = await vaultResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Vault save failed: ${vaultResponse.status}`);
      }

      const vaultItem = await vaultResponse.json();

      // Step 4: Create marketplace listing
      toast.loading('Step 3/3: Publishing listing...', { id: progressToast });
      
      const finalDescription = description.length >= 20 
        ? description 
        : `${item.item_name}. ${description || 'Listed on TagnetIQ Marketplace.'}`.slice(0, 2000);

      const listingController = new AbortController();
      const listingTimeout = setTimeout(() => listingController.abort(), 20000);

      const listingResponse = await fetch('/api/arena/listings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_item_id: vaultItem.id,
          title: item.item_name.slice(0, 100),
          description: finalDescription,
          price: askingPrice,
          condition: mapCondition(item.condition),
          images: allPhotos.length > 0 ? allPhotos : ['https://tagnetiq.com/placeholder.svg'],
          shipping_included: false,
          accepts_trades: false,
        }),
        signal: listingController.signal,
      });
      clearTimeout(listingTimeout);

      if (!listingResponse.ok) {
        const errorData = await listingResponse.json().catch(() => ({}));
        console.error('Listing error details:', errorData);
        throw new Error(errorData.error || `Listing failed: ${listingResponse.status}`);
      }

      const listing = await listingResponse.json();

      toast.dismiss(progressToast);
      toast.success('Listed on TagnetIQ Marketplace!', {
        duration: 5000,
        action: {
          label: 'View Listing',
          onClick: () => navigate(`/arena/challenge/${listing.id}`),
        },
      });

      onSuccess?.();
    } catch (error: any) {
      toast.dismiss(progressToast);
      
      // Detailed error message
      let errorMsg = error.message || 'Failed to create listing';
      
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Your connection may be slow. Please try again.';
      } else if (errorMsg.includes('fetch')) {
        errorMsg = 'Network error. Please check your internet connection.';
      }
      
      console.error('Listing error:', error);
      toast.error(errorMsg, { duration: 6000 });
      throw error; // Re-throw so modal knows it failed
    }
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