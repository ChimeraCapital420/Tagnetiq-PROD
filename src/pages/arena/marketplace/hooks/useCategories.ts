// FILE: src/pages/arena/marketplace/hooks/useCategories.ts
// Dynamic category management with organic growth
// Categories grow automatically as new listings come in

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  CATEGORY_HIERARCHY, 
  classifyItem, 
  getMainCategory, 
  getSubCategory,
  getCategoryLabel,
  getCategoryIcon,
  type MainCategory,
  type SubCategory,
} from '../constants';
import type { LucideIcon } from 'lucide-react';
import { Package } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface DynamicCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  count: number;
  color?: string;
  parentId?: string; // For sub-categories
  isOrganic?: boolean; // true if this category was auto-created from listings
}

export interface CategoryHierarchyItem extends DynamicCategory {
  subCategories: DynamicCategory[];
  expanded?: boolean;
}

export interface UseCategoriesOptions {
  /** Include categories with 0 listings? */
  showEmpty?: boolean;
  /** Maximum number of categories to return */
  limit?: number;
  /** Refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Only show main categories (no sub-categories) */
  mainOnly?: boolean;
}

export interface UseCategoriesReturn {
  /** Flat list of categories with counts */
  categories: DynamicCategory[];
  /** Hierarchical category structure */
  hierarchy: CategoryHierarchyItem[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh categories from database */
  refresh: () => Promise<void>;
  /** Get category by ID */
  getCategory: (id: string) => DynamicCategory | undefined;
  /** Check if a category exists */
  hasCategory: (id: string) => boolean;
  /** Total listings across all categories */
  totalListings: number;
  /** Organic categories (auto-created from listings) */
  organicCategories: DynamicCategory[];
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesReturn {
  const {
    showEmpty = false,
    limit = 50,
    refreshInterval = 0,
    mainOnly = false,
  } = options;

  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [organicIds, setOrganicIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch category counts from database
  const fetchCategoryCounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query to get category counts from marketplace_items
      // This handles both main_category and sub_category if your schema supports it
      const { data, error: queryError } = await supabase
        .from('marketplace_items')
        .select('category, main_category, sub_category')
        .eq('status', 'active');

      if (queryError) throw queryError;

      // Count items per category
      const counts: Record<string, number> = {};
      const organic = new Set<string>();

      for (const item of data || []) {
        // Handle different category field configurations
        const mainCat = item.main_category || item.category || 'other';
        const subCat = item.sub_category;

        // Count main category
        counts[mainCat] = (counts[mainCat] || 0) + 1;

        // Count sub-category if exists
        if (subCat) {
          counts[subCat] = (counts[subCat] || 0) + 1;
        }

        // Check if this is an organic category (not in our predefined hierarchy)
        if (!getMainCategory(mainCat) && !getSubCategory(mainCat)) {
          organic.add(mainCat);
        }
        if (subCat && !getSubCategory(subCat)) {
          organic.add(subCat);
        }
      }

      setCategoryCounts(counts);
      setOrganicIds(organic);
    } catch (err) {
      console.error('[useCategories] Error fetching counts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCategoryCounts();
  }, [fetchCategoryCounts]);

  // Auto-refresh if interval is set
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchCategoryCounts, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchCategoryCounts]);

  // Build flat category list
  const categories = useMemo((): DynamicCategory[] => {
    const result: DynamicCategory[] = [];

    // Add "All Items" first
    const totalCount = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    result.push({
      id: 'all',
      label: 'All Items',
      icon: Package,
      count: totalCount,
    });

    // Add main categories from hierarchy
    for (const main of CATEGORY_HIERARCHY) {
      const mainCount = categoryCounts[main.id] || 0;
      
      // Calculate total including sub-categories
      let totalMainCount = mainCount;
      for (const sub of main.subCategories) {
        totalMainCount += categoryCounts[sub.id] || 0;
      }

      // Skip empty categories if showEmpty is false
      if (!showEmpty && totalMainCount === 0) continue;

      result.push({
        id: main.id,
        label: main.label,
        icon: main.icon,
        count: totalMainCount,
        color: main.color,
      });

      // Add sub-categories if not mainOnly
      if (!mainOnly) {
        for (const sub of main.subCategories) {
          const subCount = categoryCounts[sub.id] || 0;
          if (!showEmpty && subCount === 0) continue;

          result.push({
            id: sub.id,
            label: sub.label,
            icon: main.icon,
            count: subCount,
            parentId: main.id,
          });
        }
      }
    }

    // Add organic categories (auto-discovered)
    for (const organicId of organicIds) {
      if (result.find(c => c.id === organicId)) continue;

      const count = categoryCounts[organicId] || 0;
      if (!showEmpty && count === 0) continue;

      result.push({
        id: organicId,
        label: getCategoryLabel(organicId),
        icon: getCategoryIcon(organicId),
        count,
        isOrganic: true,
      });
    }

    // Sort by count (descending), keeping "All" first
    const sorted = [
      result[0], // "All Items"
      ...result.slice(1).sort((a, b) => b.count - a.count),
    ];

    return sorted.slice(0, limit);
  }, [categoryCounts, organicIds, showEmpty, mainOnly, limit]);

  // Build hierarchical category structure
  const hierarchy = useMemo((): CategoryHierarchyItem[] => {
    const result: CategoryHierarchyItem[] = [];

    for (const main of CATEGORY_HIERARCHY) {
      const mainCount = categoryCounts[main.id] || 0;
      
      // Build sub-category list
      const subCategories: DynamicCategory[] = [];
      let totalSubCount = 0;

      for (const sub of main.subCategories) {
        const subCount = categoryCounts[sub.id] || 0;
        totalSubCount += subCount;

        if (showEmpty || subCount > 0) {
          subCategories.push({
            id: sub.id,
            label: sub.label,
            icon: main.icon,
            count: subCount,
            parentId: main.id,
          });
        }
      }

      const totalMainCount = mainCount + totalSubCount;

      if (showEmpty || totalMainCount > 0) {
        result.push({
          id: main.id,
          label: main.label,
          icon: main.icon,
          count: totalMainCount,
          color: main.color,
          subCategories: subCategories.sort((a, b) => b.count - a.count),
        });
      }
    }

    // Sort by total count
    return result.sort((a, b) => b.count - a.count);
  }, [categoryCounts, showEmpty]);

  // Get category by ID
  const getCategory = useCallback((id: string): DynamicCategory | undefined => {
    return categories.find(c => c.id === id);
  }, [categories]);

  // Check if category exists
  const hasCategory = useCallback((id: string): boolean => {
    return categories.some(c => c.id === id);
  }, [categories]);

  // Total listings
  const totalListings = useMemo(() => {
    return Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  }, [categoryCounts]);

  // Organic categories only
  const organicCategories = useMemo(() => {
    return categories.filter(c => c.isOrganic);
  }, [categories]);

  return {
    categories,
    hierarchy,
    loading,
    error,
    refresh: fetchCategoryCounts,
    getCategory,
    hasCategory,
    totalListings,
    organicCategories,
  };
}

// ============================================================================
// HELPER: Auto-classify and potentially create new category
// ============================================================================

/**
 * Classify an item and optionally register a new organic category
 * Call this when creating listings to enable organic category growth
 */
export async function classifyAndRegister(
  itemName: string,
  description: string = '',
  suggestedCategory?: string
): Promise<{ mainCategory: string; subCategory: string }> {
  // First try HYDRA classification
  const classification = classifyItem(itemName, description, suggestedCategory);
  
  // If we got "other/general", this might be a new category opportunity
  // In a real implementation, you might want to:
  // 1. Use AI to suggest a new sub-category
  // 2. Track frequently uncategorized items
  // 3. Automatically create new sub-categories when threshold is met
  
  // For now, return the classification
  return classification;
}

export default useCategories;