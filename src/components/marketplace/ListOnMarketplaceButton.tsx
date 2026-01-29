// FILE: src/components/marketplace/ListOnMarketplaceButton.tsx
// Fixed: Don't spread entire item into valuation_data (causes 413 errors)

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

  // Only extract URL strings, not base64
  const primaryPhoto = analysisResult.imageUrl || analysisResult.imageUrls?.[0] || '';
  const additionalPhotos = analysisResult.imageUrls?.slice(1) || [];
  
  // Filter out any base64 images (they start with "data:")
  const cleanPhotos = [primaryPhoto, ...additionalPhotos].filter(
    url => url && typeof url === 'string' && !url.startsWith('data:')
  );

  const marketplaceItem = {
    id: '',
    item_name: analysisResult.itemName || 'Untitled Asset',
    asking_price: analysisResult.estimatedValue || 0,
    estimated_value: analysisResult.estimatedValue,
    primary_photo_url: cleanPhotos[0] || '',
    additional_photos: cleanPhotos.slice(1),
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
    authoritySource: analysisResult.authoritySource,
  };

  const fetchDefaultVault = async (accessToken: string): Promise<string> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
    if (!askingPrice || askingPrice <= 0) {
      throw new Error('Please enter a valid price greater than $0');
    }
    if (!description || description.length < 20) {
      throw new Error('Description must be at least 20 characters');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Please sign in to list items");

    const progressToast = toast.loading('Creating listing...', { duration: 30000 });

    try {
      // Step 1: Get or create vault
      toast.loading('Step 1/3: Preparing vault...', { id: progressToast });
      const vaultId = await fetchDefaultVault(session.access_token);

      // Step 2: Only use clean URL photos (no base64)
      const allPhotos = cleanPhotos.length > 0 ? cleanPhotos : [];

      // Step 3: Add to vault with MINIMAL valuation_data (no spreading entire object!)
      toast.loading('Step 2/3: Saving to vault...', { id: progressToast });
      const vaultController = new AbortController();
      const vaultTimeout = setTimeout(() => vaultController.abort(), 20000);

      // Only send essential fields - NOT the entire item object
      const minimalValuationData = {
        estimatedValue: askingPrice,
        summary_reasoning: description.slice(0, 2000), // Limit description size
        category: item.category,
        condition: item.condition,
        brand: item.brand || null,
        model: item.model || null,
        year: item.year || null,
        confidence: item.confidence_score || null,
        authoritySource: item.authoritySource || null,
      };

      const vaultResponse = await fetch('/api/vault/items', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vault_id: vaultId,
          asset_name: item.item_name.slice(0, 200), // Limit name size
          valuation_data: minimalValuationData,
          photos: allPhotos.slice(0, 10), // Max 10 photos
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
        ? description.slice(0, 2000)
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
          images: allPhotos.length > 0 ? allPhotos.slice(0, 10) : ['https://tagnetiq.com/placeholder.svg'],
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
      
      let errorMsg = error.message || 'Failed to create listing';
      
      if (error.name === 'AbortError') {
        errorMsg = 'Request timed out. Your connection may be slow. Please try again.';
      } else if (errorMsg.includes('fetch')) {
        errorMsg = 'Network error. Please check your internet connection.';
      } else if (errorMsg.includes('413') || errorMsg.includes('too large')) {
        errorMsg = 'Data too large. Try with fewer or smaller images.';
      }
      
      console.error('Listing error:', error);
      toast.error(errorMsg, { duration: 6000 });
      throw error;
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