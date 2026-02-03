// FILE: src/pages/arena/marketplace/components/CategoryPills.tsx
// Category filter pills with hierarchical support and organic growth
// FIXED: Mobile visibility, touch targets, sub-category expansion
// Supports $400B+ resale market categories

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Package, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  CATEGORY_HIERARCHY, 
  getCategoryLabel, 
  getCategoryIcon,
  getMainCategory,
} from '../constants';
import type { DynamicCategory } from '../types';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface CategoryPillsProps {
  selected: string;
  onSelect: (category: string) => void;
  dynamicCategories: DynamicCategory[];
  /** Show sub-categories inline (mobile) or in popover (desktop) */
  expandMode?: 'inline' | 'popover';
  /** Show organic/new category badge */
  showOrganicBadge?: boolean;
}

interface CategoryWithMeta {
  id: string;
  label: string;
  icon: LucideIcon;
  count: number;
  color?: string;
  isMain?: boolean;
  parentId?: string;
  isOrganic?: boolean;
  subCategories?: CategoryWithMeta[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export const CategoryPills: React.FC<CategoryPillsProps> = ({ 
  selected, 
  onSelect, 
  dynamicCategories,
  expandMode = 'popover',
  showOrganicBadge = true,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Build categories with hierarchy and counts
  const categories = useMemo((): CategoryWithMeta[] => {
    // Create a map of counts from dynamic categories
    const countMap = new Map<string, number>();
    const organicSet = new Set<string>();
    
    for (const dc of dynamicCategories) {
      countMap.set(dc.id, dc.count);
      // Track organic categories (not in predefined hierarchy)
      if (!getMainCategory(dc.id)) {
        const found = CATEGORY_HIERARCHY.some(m => 
          m.subCategories.some(s => s.id === dc.id)
        );
        if (!found && dc.id !== 'all') {
          organicSet.add(dc.id);
        }
      }
    }

    const result: CategoryWithMeta[] = [];

    // "All Items" first
    const totalCount = Array.from(countMap.values()).reduce((sum, c) => sum + c, 0);
    result.push({
      id: 'all',
      label: 'All Items',
      icon: Package,
      count: totalCount,
      isMain: true,
    });

    // Add main categories with their sub-categories
    for (const main of CATEGORY_HIERARCHY) {
      // Calculate total count for main category (direct + sub-categories)
      let mainTotal = countMap.get(main.id) || 0;
      const subs: CategoryWithMeta[] = [];

      for (const sub of main.subCategories) {
        const subCount = countMap.get(sub.id) || 0;
        mainTotal += subCount;
        
        if (subCount > 0) {
          subs.push({
            id: sub.id,
            label: sub.label,
            icon: main.icon,
            count: subCount,
            parentId: main.id,
          });
        }
      }

      // Only show main categories with listings
      if (mainTotal > 0) {
        result.push({
          id: main.id,
          label: main.label,
          icon: main.icon,
          count: mainTotal,
          color: main.color,
          isMain: true,
          subCategories: subs.sort((a, b) => b.count - a.count),
        });
      }
    }

    // Add organic categories (auto-discovered from listings)
    for (const organicId of organicSet) {
      const count = countMap.get(organicId) || 0;
      if (count > 0) {
        result.push({
          id: organicId,
          label: getCategoryLabel(organicId),
          icon: getCategoryIcon(organicId),
          count,
          isMain: true,
          isOrganic: true,
        });
      }
    }

    // Sort by count (keeping "All" first)
    return [
      result[0],
      ...result.slice(1).sort((a, b) => b.count - a.count),
    ];
  }, [dynamicCategories]);

  // Auto-scroll to selected category
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const button = selectedRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      
      const scrollLeft = button.offsetLeft - (containerRect.width / 2) + (buttonRect.width / 2);
      
      container.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth'
      });
    }
  }, [selected]);

  // Haptic feedback on selection
  const handleSelect = (categoryId: string) => {
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
    onSelect(categoryId);
    setExpandedCategory(null);
  };

  // Check if a category or its sub-categories are selected
  const isActiveCategory = (cat: CategoryWithMeta): boolean => {
    if (cat.id === selected) return true;
    if (cat.subCategories?.some(sub => sub.id === selected)) return true;
    return false;
  };

  return (
    <div className="relative">
      {/* Gradient fade indicators */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      
      <ScrollArea className="w-full whitespace-nowrap" ref={scrollRef}>
        <div className="flex gap-2 pb-3 px-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = cat.id === selected;
            const isActive = isActiveCategory(cat);
            const hasSubCategories = cat.subCategories && cat.subCategories.length > 0;
            
            // Main category pill
            const pill = (
              <Button
                key={cat.id}
                ref={isSelected ? selectedRef : undefined}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => !hasSubCategories && handleSelect(cat.id)}
                className={cn(
                  'rounded-full px-3 sm:px-4 h-10 sm:h-9 flex-shrink-0 transition-all gap-1.5',
                  'touch-manipulation select-none min-w-[4rem]',
                  isActive 
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-white/10' 
                    : 'bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600',
                  cat.color && !isActive && cat.color
                )}
                aria-pressed={isSelected}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate max-w-[6rem] sm:max-w-none">
                  {cat.label}
                </span>
                
                {/* Count badge */}
                {cat.count > 0 && (
                  <span 
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center',
                      isActive 
                        ? 'bg-black/10 text-black/70' 
                        : 'bg-zinc-700 text-zinc-300'
                    )}
                  >
                    {cat.count > 999 ? '999+' : cat.count}
                  </span>
                )}
                
                {/* Organic badge */}
                {showOrganicBadge && cat.isOrganic && (
                  <Sparkles className="h-3 w-3 text-amber-400" />
                )}
                
                {/* Sub-category indicator */}
                {hasSubCategories && expandMode === 'popover' && (
                  <ChevronDown className={cn(
                    'h-3 w-3 ml-0.5 transition-transform',
                    expandedCategory === cat.id && 'rotate-180'
                  )} />
                )}
              </Button>
            );

            // Wrap with popover if has sub-categories
            if (hasSubCategories && expandMode === 'popover') {
              return (
                <Popover 
                  key={cat.id} 
                  open={expandedCategory === cat.id}
                  onOpenChange={(open) => setExpandedCategory(open ? cat.id : null)}
                >
                  <PopoverTrigger asChild>
                    <div className="relative">
                      {pill}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-56 p-2 bg-zinc-900 border-zinc-800"
                    align="start"
                  >
                    <div className="space-y-1">
                      {/* Show all in this category */}
                      <Button
                        variant={selected === cat.id ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start h-9"
                        onClick={() => handleSelect(cat.id)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        All {cat.label}
                        <span className="ml-auto text-xs text-zinc-500">
                          {cat.count}
                        </span>
                      </Button>
                      
                      <div className="h-px bg-zinc-800 my-1" />
                      
                      {/* Sub-categories */}
                      {cat.subCategories?.map((sub) => (
                        <Button
                          key={sub.id}
                          variant={selected === sub.id ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start h-9 pl-6"
                          onClick={() => handleSelect(sub.id)}
                        >
                          {sub.label}
                          <span className="ml-auto text-xs text-zinc-500">
                            {sub.count}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return pill;
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
      
      {/* Inline sub-categories for mobile */}
      {expandMode === 'inline' && expandedCategory && (
        <div className="px-2 pb-2">
          <ScrollArea className="w-full">
            <div className="flex gap-1.5 pt-1">
              {categories
                .find(c => c.id === expandedCategory)
                ?.subCategories?.map((sub) => (
                  <Button
                    key={sub.id}
                    variant={selected === sub.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelect(sub.id)}
                    className={cn(
                      'rounded-full px-3 h-8 text-xs',
                      'touch-manipulation',
                      selected === sub.id
                        ? 'bg-zinc-200 text-black'
                        : 'bg-zinc-800/50 border-zinc-700'
                    )}
                  >
                    {sub.label}
                    <span className="ml-1.5 text-[10px] opacity-60">
                      {sub.count}
                    </span>
                  </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SKELETON LOADER
// ============================================================================

export const CategoryPillsSkeleton: React.FC = () => (
  <div className="flex gap-2 pb-3 px-2 overflow-hidden">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div
        key={i}
        className="h-10 sm:h-9 rounded-full bg-zinc-800/50 animate-pulse flex-shrink-0"
        style={{ width: `${60 + Math.random() * 40}px` }}
      />
    ))}
  </div>
);

// ============================================================================
// COMPACT VERSION (for mobile filter sheet)
// ============================================================================

interface CategoryListProps {
  selected: string;
  onSelect: (category: string) => void;
  dynamicCategories: DynamicCategory[];
}

export const CategoryList: React.FC<CategoryListProps> = ({
  selected,
  onSelect,
  dynamicCategories,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build count map
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const dc of dynamicCategories) {
      map.set(dc.id, dc.count);
    }
    return map;
  }, [dynamicCategories]);

  return (
    <div className="space-y-1">
      {/* All Items */}
      <Button
        variant={selected === 'all' ? 'secondary' : 'ghost'}
        className="w-full justify-start h-10"
        onClick={() => onSelect('all')}
      >
        <Package className="h-4 w-4 mr-2" />
        All Items
      </Button>

      {/* Main categories with sub-categories */}
      {CATEGORY_HIERARCHY.map((main) => {
        const Icon = main.icon;
        const isExpanded = expanded.has(main.id);
        const mainCount = countMap.get(main.id) || 0;
        const subCounts = main.subCategories.reduce((sum, s) => sum + (countMap.get(s.id) || 0), 0);
        const totalCount = mainCount + subCounts;
        
        if (totalCount === 0) return null;

        return (
          <div key={main.id}>
            <div className="flex items-center">
              <Button
                variant={selected === main.id ? 'secondary' : 'ghost'}
                className="flex-1 justify-start h-10"
                onClick={() => onSelect(main.id)}
              >
                <Icon className={cn('h-4 w-4 mr-2', main.color)} />
                {main.label}
                <span className="ml-auto text-xs text-zinc-500 mr-2">
                  {totalCount}
                </span>
              </Button>
              {main.subCategories.length > 0 && subCounts > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => toggleExpand(main.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            
            {/* Sub-categories */}
            {isExpanded && (
              <div className="ml-6 space-y-0.5 mt-0.5">
                {main.subCategories.map((sub) => {
                  const subCount = countMap.get(sub.id) || 0;
                  if (subCount === 0) return null;
                  
                  return (
                    <Button
                      key={sub.id}
                      variant={selected === sub.id ? 'secondary' : 'ghost'}
                      className="w-full justify-start h-9 text-sm"
                      onClick={() => onSelect(sub.id)}
                    >
                      {sub.label}
                      <span className="ml-auto text-xs text-zinc-500">
                        {subCount}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CategoryPills;