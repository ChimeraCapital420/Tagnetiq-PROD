// FILE: src/components/vault/hooks/useVaultSelection.ts
// Selection state, filtering, and item helpers

import { useState, useMemo } from 'react';
import type { VaultItem } from '../types';

interface UseVaultSelectionProps {
  items: VaultItem[];
  selectedItemIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function useVaultSelection({
  items,
  selectedItemIds,
  onSelectionChange,
}: UseVaultSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactiveItems, setShowInactiveItems] = useState(true);

  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.asset_name.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.serial_number?.toLowerCase().includes(query)
      );
    }
    if (!showInactiveItems) {
      result = result.filter(item => !item.status || item.status === 'active');
    }
    return result;
  }, [items, searchQuery, showInactiveItems]);

  const inactiveCount = useMemo(
    () => items.filter(item => item.status && item.status !== 'active').length,
    [items]
  );

  const activeItems = useMemo(
    () => filteredItems.filter(item => !item.status || item.status === 'active'),
    [filteredItems]
  );

  const selectedItems = items.filter(item => selectedItemIds.includes(item.id));

  const totalValue = selectedItems.reduce((sum, item) => {
    const val = item.valuation_data?.estimatedValue || item.owner_valuation;
    if (val) {
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }
    return sum;
  }, 0);

  const selectAll = () => onSelectionChange(filteredItems.map(item => item.id));
  const selectNone = () => onSelectionChange([]);
  const selectActiveOnly = () => onSelectionChange(activeItems.map(item => item.id));

  const toggleItem = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      onSelectionChange(selectedItemIds.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItemIds, itemId]);
    }
  };

  return {
    searchQuery,
    setSearchQuery,
    showInactiveItems,
    setShowInactiveItems,
    filteredItems,
    inactiveCount,
    activeItems,
    selectedItems,
    totalValue,
    selectAll,
    selectNone,
    selectActiveOnly,
    toggleItem,
  };
}