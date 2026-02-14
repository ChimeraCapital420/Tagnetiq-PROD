// FILE: src/components/analysis/hooks/useListingSubmit.ts
// Handles inserting a listing into arena_listings from a scan result.
// Extracted from AnalysisResult.tsx monolith.

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { safeNumber } from '../utils/safe-helpers.js';
import { mapConditionToEnum } from '../utils/condition-mapper.js';
import type { MarketplaceItem } from '@/components/marketplace/platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';
import type { NormalizedAnalysis } from '../types.js';

export function useListingSubmit(analysis: NormalizedAnalysis | null) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleListOnTagnetiq = useCallback(async (
    listingItem: MarketplaceItem,
    price: number,
    description: string,
    ghost?: GhostData,
  ) => {
    if (!user) {
      toast.error('Please log in to create a listing');
      return;
    }

    if (!analysis) return;

    try {
      const listingImages = analysis.allImageUrls.length > 0
        ? analysis.allImageUrls
        : (listingItem.imageUrl ? [listingItem.imageUrl] : []);

      // Build metadata from available authority + consensus data
      const metadata: Record<string, any> = {};
      if (analysis.authorityData) {
        metadata.authority_source = analysis.authorityData.source;
        metadata.authority_data = analysis.authorityData;
      }
      if (analysis.hydraConsensus) {
        metadata.hydra_consensus = analysis.hydraConsensus;
      }
      if (analysis.valuationFactors.length > 0) {
        metadata.valuation_factors = analysis.valuationFactors;
      }
      if (ghost) {
        metadata.ghost_protocol = ghost;
      }

      const insertPayload: Record<string, any> = {
        seller_id: user.id,
        title: listingItem.item_name || listingItem.title || analysis.itemName,
        description,
        price,
        original_price: analysis.estimatedValue,
        condition: mapConditionToEnum(listingItem.condition || 'good'),
        images: listingImages,
        category: listingItem.category || analysis.category,
        status: 'active',
        offers_shipping: true,
        offers_local_pickup: true,
        shipping_available: true,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        analysis_id: analysis.id || null,
        confidence_score: analysis.confidenceNormalized,
        is_verified: !!analysis.authorityData,
        estimated_value: analysis.estimatedValue,
      };

      // Ghost Mode fields
      if (ghost) {
        insertPayload.is_ghost = true;
        insertPayload.handling_time_hours = ghost.handling_time_hours || 48;
        if (ghost.store?.location?.lat) {
          insertPayload.ghost_location_lat = ghost.store.location.lat;
        }
        if (ghost.store?.location?.lng) {
          insertPayload.ghost_location_lng = ghost.store.location.lng;
        }
      }

      const { error } = await supabase
        .from('arena_listings')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Listing creation error:', error);
        throw new Error(error.message || 'Failed to create listing');
      }

      toast.success('Listed on TagnetIQ Marketplace!', {
        action: {
          label: 'View Listing',
          onClick: () => navigate('/arena/marketplace'),
        },
      });
    } catch (err: any) {
      console.error('Marketplace listing failed:', err);
      toast.error('Listing failed', { description: err.message || 'Please try again' });
      throw err;
    }
  }, [user, analysis, navigate]);

  return handleListOnTagnetiq;
}