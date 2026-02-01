// FILE: src/pages/arena/marketplace/components/CategoryPills.tsx
// Category filter pills with counts

import React, { useMemo } from 'react';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DEFAULT_CATEGORIES } from '../constants';
import { getCategoryLabel, getCategoryIcon } from '../utils/helpers';
import type { DynamicCategory } from '../types';

interface CategoryPillsProps {
  selected: string;
  onSelect: (category: string) => void;
  dynamicCategories: DynamicCategory[];
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({ 
  selected, 
  onSelect, 
  dynamicCategories 
}) => {
  const categories = useMemo(() => {
    const allCat = { id: 'all', label: 'All Items', icon: Package, count: 0 };
    
    if (dynamicCategories.length === 0) {
      return [allCat, ...DEFAULT_CATEGORIES.slice(1).map(c => ({ ...c, count: 0 }))];
    }
    
    const dynamicWithLabels = dynamicCategories.map(dc => ({
      id: dc.id,
      label: getCategoryLabel(dc.id),
      icon: getCategoryIcon(dc.id),
      count: dc.count
    }));
    
    // Calculate total for "All" category
    allCat.count = dynamicWithLabels.reduce((sum, c) => sum + c.count, 0);
    
    return [allCat, ...dynamicWithLabels];
  }, [dynamicCategories]);

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <Button
              key={cat.id}
              variant={selected === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect(cat.id)}
              className={cn(
                'rounded-full px-4 h-9 flex-shrink-0 transition-all gap-1.5',
                selected === cat.id 
                  ? 'bg-white text-black hover:bg-zinc-200' 
                  : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
              {cat.count > 0 && (
                <span className="text-[10px] opacity-60">({cat.count})</span>
              )}
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};