// FILE: src/pages/arena/marketplace/hooks/useListingActions.ts
// Actions hook for listing management (mark sold, delete, export)

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { MarketplaceItem, DialogState } from '../types';
import { PLATFORM_URLS } from '../constants';
import { generateListingText } from '../utils/helpers';

interface UseListingActionsOptions {
  currentUserId: string | null;
  onItemUpdated: (item: MarketplaceItem, status: 'sold') => void;
  onItemDeleted: (itemId: string) => void;
}

interface UseListingActionsReturn {
  // Dialog states
  soldDialog: DialogState<MarketplaceItem>;
  deleteDialog: DialogState<MarketplaceItem>;
  
  // Actions
  handleMarkSold: (item: MarketplaceItem) => void;
  confirmMarkSold: () => Promise<void>;
  handleDelete: (item: MarketplaceItem) => void;
  confirmDelete: () => Promise<void>;
  handleExport: (item: MarketplaceItem, platform: string) => Promise<void>;
  
  // Dialog controls
  closeSoldDialog: () => void;
  closeDeleteDialog: () => void;
}

export function useListingActions({
  currentUserId,
  onItemUpdated,
  onItemDeleted,
}: UseListingActionsOptions): UseListingActionsReturn {
  const [soldDialog, setSoldDialog] = useState<DialogState<MarketplaceItem>>({ 
    open: false, 
    item: null 
  });
  const [deleteDialog, setDeleteDialog] = useState<DialogState<MarketplaceItem>>({ 
    open: false, 
    item: null 
  });

  // Auth helper
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }, []);

  // Mark as Sold
  const handleMarkSold = useCallback((item: MarketplaceItem) => {
    if (!currentUserId) {
      toast.error('Please log in to manage your listings');
      return;
    }
    setSoldDialog({ open: true, item });
  }, [currentUserId]);

  const confirmMarkSold = useCallback(async () => {
    const item = soldDialog.item;
    if (!item) return;
    
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`/api/arena/listings/${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'mark_sold' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to mark as sold');
      }
      
      toast.success('Listing marked as sold! 🎉');
      onItemUpdated(item, 'sold');
    } catch (error: any) {
      if (error.message === 'Not authenticated') {
        toast.error('Please log in to manage your listings');
      } else {
        toast.error('Failed to mark as sold', { description: error.message });
      }
    } finally {
      setSoldDialog({ open: false, item: null });
    }
  }, [soldDialog.item, getAuthHeaders, onItemUpdated]);

  // Delete
  const handleDelete = useCallback((item: MarketplaceItem) => {
    if (!currentUserId) {
      toast.error('Please log in to manage your listings');
      return;
    }
    setDeleteDialog({ open: true, item });
  }, [currentUserId]);

  const confirmDelete = useCallback(async () => {
    const item = deleteDialog.item;
    if (!item) return;
    
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`/api/arena/listings/${item.id}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
      }
      
      toast.success('Listing deleted');
      onItemDeleted(item.id);
    } catch (error: any) {
      if (error.message === 'Not authenticated') {
        toast.error('Please log in to manage your listings');
      } else {
        toast.error('Failed to delete listing', { description: error.message });
      }
    } finally {
      setDeleteDialog({ open: false, item: null });
    }
  }, [deleteDialog.item, getAuthHeaders, onItemDeleted]);

  // Export
  const handleExport = useCallback(async (item: MarketplaceItem, platform: string) => {
    toast.loading(`Preparing ${platform} listing...`, { id: 'export' });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const listingText = generateListingText(item);
    await navigator.clipboard.writeText(listingText);
    
    toast.success(`Opening ${platform}`, {
      id: 'export',
      description: 'Listing details copied to clipboard',
    });
    
    window.open(PLATFORM_URLS[platform], '_blank');
  }, []);

  // Dialog controls
  const closeSoldDialog = useCallback(() => {
    setSoldDialog({ open: false, item: null });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, item: null });
  }, []);

  return {
    soldDialog,
    deleteDialog,
    handleMarkSold,
    confirmMarkSold,
    handleDelete,
    confirmDelete,
    handleExport,
    closeSoldDialog,
    closeDeleteDialog,
  };
}