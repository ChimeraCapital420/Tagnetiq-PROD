// FILE: src/components/scanner/hooks/useCapturedItems.ts
// State management for captured photos, videos, and documents

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { StoredImage } from '@/lib/image-storage';

// =============================================================================
// TYPES
// =============================================================================

export interface CapturedItem {
  id: string;
  type: 'photo' | 'video' | 'document';
  storedImage: StoredImage;
  name: string;
  selected: boolean;
  metadata?: {
    documentType?: 'certificate' | 'grading' | 'appraisal' | 'receipt' | 'authenticity' | 'other';
    barcodes?: string[];
    videoFrames?: string[];
  };
}

export interface UseCapturedItemsOptions {
  maxItems?: number;
}

export interface UseCapturedItemsReturn {
  items: CapturedItem[];
  selectedItems: CapturedItem[];
  selectedCount: number;
  totalCount: number;
  
  addItem: (item: Omit<CapturedItem, 'selected'>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  
  updateItemMetadata: (id: string, metadata: Partial<CapturedItem['metadata']>) => void;
  
  // For analysis - get compressed data
  getAnalysisPayload: () => Array<{
    type: string;
    name: string;
    data: string;
    metadata: CapturedItem['metadata'];
  }>;
  
  // For marketplace - get original URLs
  getOriginalUrls: () => string[];
}

// =============================================================================
// HOOK
// =============================================================================

export function useCapturedItems(
  options: UseCapturedItemsOptions = {}
): UseCapturedItemsReturn {
  const { maxItems = 15 } = options;
  
  const [items, setItems] = useState<CapturedItem[]>([]);

  // ========================================
  // ADD/REMOVE
  // ========================================

  const addItem = useCallback((item: Omit<CapturedItem, 'selected'>) => {
    setItems(prev => {
      if (prev.length >= maxItems) {
        toast.warning(`Maximum ${maxItems} items reached`);
        return prev;
      }
      return [...prev, { ...item, selected: true }];
    });
  }, [maxItems]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    toast.info('All items cleared');
  }, []);

  // ========================================
  // SELECTION
  // ========================================

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

  // ========================================
  // METADATA
  // ========================================

  const updateItemMetadata = useCallback((
    id: string,
    metadata: Partial<CapturedItem['metadata']>
  ) => {
    setItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, metadata: { ...item.metadata, ...metadata } }
        : item
    ));
  }, []);

  // ========================================
  // DATA EXTRACTION
  // ========================================

  const selectedItems = items.filter(item => item.selected);
  const selectedCount = selectedItems.length;
  const totalCount = items.length;

  const getAnalysisPayload = useCallback(() => {
    return selectedItems.map(item => {
      // Use compressed analysis data (NOT original)
      let data = item.storedImage.analysisData;
      
      // Strip data URL prefix if present
      if (data.includes(',')) {
        data = data.split(',')[1];
      }
      
      return {
        type: item.type,
        name: item.name,
        data,
        metadata: item.metadata || {},
      };
    });
  }, [selectedItems]);

  const getOriginalUrls = useCallback(() => {
    // Return full-quality URLs for marketplace
    return selectedItems.map(item => item.storedImage.originalUrl);
  }, [selectedItems]);

  return {
    items,
    selectedItems,
    selectedCount,
    totalCount,
    addItem,
    removeItem,
    clearAll,
    toggleSelection,
    selectAll,
    deselectAll,
    updateItemMetadata,
    getAnalysisPayload,
    getOriginalUrls,
  };
}

export default useCapturedItems;