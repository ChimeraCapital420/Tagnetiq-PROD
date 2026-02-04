// FILE: src/components/scanner/hooks/useCapturedItems.ts
// Manages captured items state with selection, compression, and removal
// Mobile-first: Device-side compression before upload

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import type { CapturedItem, CapturedItemMetadata, AnalysisPayloadItem } from '../types';
import { compressImage, formatBytes } from '../utils/compression';

// =============================================================================
// TYPES
// =============================================================================
export interface UseCapturedItemsOptions {
  maxItems?: number;
}

export interface UseCapturedItemsReturn {
  items: CapturedItem[];
  selectedCount: number;
  totalCount: number;
  isCompressing: boolean;
  
  // Actions
  addItem: (item: Omit<CapturedItem, 'id' | 'selected'>) => Promise<void>;
  removeItem: (id: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  clearAll: () => void;
  
  // Helpers
  getSelectedItems: () => CapturedItem[];
  getAnalysisPayload: () => AnalysisPayloadItem[];
  getOriginalUrls: () => string[];
}

// =============================================================================
// HOOK
// =============================================================================
export function useCapturedItems(options: UseCapturedItemsOptions = {}): UseCapturedItemsReturn {
  const { maxItems = 15 } = options;
  
  const [items, setItems] = useState<CapturedItem[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);

  // ==========================================================================
  // ADD ITEM (with compression)
  // ==========================================================================
  const addItem = useCallback(async (item: Omit<CapturedItem, 'id' | 'selected'>) => {
    if (items.length >= maxItems) {
      toast.error(`Maximum ${maxItems} items reached`);
      return;
    }

    setIsCompressing(true);

    try {
      let processedData = item.data;
      let originalData = item.data;
      let metadata: CapturedItemMetadata = { ...item.metadata };

      // Compress images on device (mobile-first approach)
      if (item.type === 'photo' || item.type === 'document') {
        const result = await compressImage(item.data);
        processedData = result.compressed;
        metadata.originalSize = result.originalSize;
        metadata.compressedSize = result.compressedSize;

        // Show compression toast if significant savings
        if (result.originalSize > 1024 * 1024 && result.compressedSize < result.originalSize * 0.7) {
          toast.info(`Compressed: ${formatBytes(result.originalSize)} → ${formatBytes(result.compressedSize)}`);
        }
      }

      const newItem: CapturedItem = {
        ...item,
        id: uuidv4(),
        selected: true,
        data: processedData,
        originalData,
        thumbnail: item.type === 'document' ? item.thumbnail : processedData,
        metadata,
      };

      setItems(prev => [...prev, newItem].slice(-maxItems));

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

    } catch (error) {
      console.error('[CAPTURE] Error processing item:', error);
      toast.error('Failed to process image');
    } finally {
      setIsCompressing(false);
    }
  }, [items.length, maxItems]);

  // ==========================================================================
  // REMOVE ITEM
  // ==========================================================================
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // ==========================================================================
  // SELECTION MANAGEMENT
  // ==========================================================================
  const toggleSelection = useCallback((id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, selected: !item.selected } : item
    ));
  }, []);

  const selectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setItems(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    toast.info('All items cleared');
  }, []);

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  const getSelectedItems = useCallback(() => {
    return items.filter(item => item.selected);
  }, [items]);

  const getAnalysisPayload = useCallback((): AnalysisPayloadItem[] => {
    return items
      .filter(item => item.selected)
      .map(item => ({
        type: item.type,
        name: item.name,
        data: item.data,
        additionalFrames: item.metadata?.videoFrames,
        metadata: {
          documentType: item.metadata?.documentType,
          extractedText: item.metadata?.extractedText || '',
          barcodes: item.metadata?.barcodes || [],
        },
      }));
  }, [items]);

  const getOriginalUrls = useCallback(() => {
    return items
      .filter(item => item.selected)
      .map(item => item.originalData || item.data)
      .filter(url => !url.startsWith('blob:'));
  }, [items]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================
  const selectedCount = items.filter(item => item.selected).length;
  const totalCount = items.length;

  return {
    items,
    selectedCount,
    totalCount,
    isCompressing,
    addItem,
    removeItem,
    toggleSelection,
    selectAll,
    deselectAll,
    clearAll,
    getSelectedItems,
    getAnalysisPayload,
    getOriginalUrls,
  };
}

export default useCapturedItems;