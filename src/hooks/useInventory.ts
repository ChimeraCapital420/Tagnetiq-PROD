// FILE: src/hooks/useInventory.ts
// RH-009 — React hook for inventory operations
// Drop-in hook for any component that needs inventory access

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  condition: string;
  quantity: number;
  purchase_price: number | null;
  hydra_value: number | null;
  listed_price: number | null;
  status: 'in_inventory' | 'listed' | 'sold' | 'donated' | 'returned';
  location_name: string | null;
  is_ghost: boolean;
  primary_image_url: string | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface InventoryKPIs {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  unrealizedGain: number;
  itemsListed: number;
  itemsSold30d: number;
  revenue30d: number;
  profit30d: number;
  ghostItems: number;
  roi: number;
}

interface AddItemPayload {
  itemName: string;
  category?: string;
  condition?: string;
  purchasePrice?: number;
  hydraValue?: number;
  analysisId?: string;
  primaryImageUrl?: string;
  locationName?: string;
  isGhost?: boolean;
  ghostStore?: string;
  notes?: string;
}

export function useInventory() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id;

  const fetchItems = useCallback(async (status?: string) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ userId });
      if (status) params.set('status', status);
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      if (data.success) setItems(data.items);
      else setError(data.error);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchKPIs = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/inventory?userId=${userId}&mode=kpis`);
      const data = await res.json();
      if (data.success) setKpis(data.kpis);
    } catch { /* silent */ }
  }, [userId]);

  const addItem = useCallback(async (payload: AddItemPayload): Promise<InventoryItem | null> => {
    if (!userId) return null;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', userId, ...payload }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => [data.item, ...prev]);
        return data.item;
      }
      return null;
    } catch { return null; }
  }, [userId]);

  const sellItem = useCallback(async (
    id: string,
    salePrice: number,
    platform?: string
  ): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sell', userId, id, salePrice, platform }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.map(item =>
          item.id === id ? { ...item, status: 'sold' as const } : item
        ));
        return true;
      }
      return false;
    } catch { return false; }
  }, [userId]);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId, id }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(item => item.id !== id));
        return true;
      }
      return false;
    } catch { return false; }
  }, [userId]);

  // Add item directly from a scan result — one-tap workflow
  const addFromScan = useCallback(async (scanResult: any): Promise<InventoryItem | null> => {
    return addItem({
      itemName:        scanResult.itemName || 'Unknown Item',
      category:        scanResult.category,
      condition:       scanResult.condition || 'good',
      hydraValue:      scanResult.estimatedValue,
      analysisId:      scanResult.analysisId,
      primaryImageUrl: scanResult.thumbnailUrl || scanResult.imageUrls?.[0],
    });
  }, [addItem]);

  useEffect(() => {
    fetchItems();
    fetchKPIs();
  }, [fetchItems, fetchKPIs]);

  return {
    items,
    kpis,
    loading,
    error,
    fetchItems,
    fetchKPIs,
    addItem,
    addFromScan,    // ← use this on scan result cards
    sellItem,
    deleteItem,
    inInventory:  items.filter(i => i.status === 'in_inventory' && !i.is_ghost),
    listed:       items.filter(i => i.status === 'listed'),
    ghostItems:   items.filter(i => i.is_ghost),
  };
}