// FILE: src/pages/arena/marketplace/utils/helpers.ts
// Marketplace helper functions

import { Package } from 'lucide-react';
import { DEFAULT_CATEGORIES } from '../constants';

export function getCategoryLabel(id: string): string {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  if (found) return found.label;
  return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function getCategoryIcon(id: string): React.ComponentType<{ className?: string }> {
  const found = DEFAULT_CATEGORIES.find(c => c.id === id);
  return found?.icon || Package;
}

export function formatTimeAgo(dateStr?: string): string | null {
  if (!dateStr) return null;
  
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function calculatePriceRatio(askingPrice: number, estimatedValue?: number): number | null {
  if (!estimatedValue || estimatedValue === 0) return null;
  return askingPrice / estimatedValue;
}

export function generateListingText(item: {
  item_name: string;
  asking_price: number;
  condition?: string;
  description?: string;
}): string {
  return `${item.item_name}\n\nPrice: $${item.asking_price}\n${item.condition ? `Condition: ${item.condition}` : ''}\n${item.description || ''}\n\nListed on TagnetIQ`;
}