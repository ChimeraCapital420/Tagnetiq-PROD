// FILE: src/pages/arena/marketplace/components/FilterPanel.tsx
// Filter sidebar panel

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SORT_OPTIONS, CONDITION_OPTIONS, DEFAULT_FILTERS, MAX_PRICE } from '../constants';
import type { FilterState } from '../types';

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  maxPrice?: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filters, 
  onChange, 
  maxPrice = MAX_PRICE 
}) => {
  const handleReset = () => {
    onChange({
      ...DEFAULT_FILTERS,
      priceRange: [0, maxPrice],
    });
  };

  return (
    <div className="space-y-6">
      {/* Sort By */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Sort By
        </Label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onChange({ ...filters, sortBy: value })}
        >
          <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Price Range */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Price Range
          </Label>
          <span className="text-sm text-zinc-300">
            ${filters.priceRange[0]} - ${filters.priceRange[1] >= maxPrice ? `${maxPrice}+` : filters.priceRange[1]}
          </span>
        </div>
        <Slider
          value={filters.priceRange}
          onValueChange={(value) => onChange({ ...filters, priceRange: value as [number, number] })}
          max={maxPrice}
          step={10}
          className="py-2"
        />
      </div>
      
      {/* Condition */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Condition
        </Label>
        <Select
          value={filters.condition}
          onValueChange={(value) => onChange({ ...filters, condition: value })}
        >
          <SelectTrigger className="bg-zinc-900/50 border-zinc-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Verified Only */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label className="text-sm">Verified Only</Label>
          <p className="text-xs text-zinc-500">HYDRA verified items</p>
        </div>
        <Switch
          checked={filters.verifiedOnly}
          onCheckedChange={(checked) => onChange({ ...filters, verifiedOnly: checked })}
        />
      </div>
      
      <Separator className="bg-zinc-800" />
      
      {/* Reset */}
      <Button
        variant="outline"
        className="w-full border-zinc-800 hover:bg-zinc-800"
        onClick={handleReset}
      >
        Reset Filters
      </Button>
    </div>
  );
};