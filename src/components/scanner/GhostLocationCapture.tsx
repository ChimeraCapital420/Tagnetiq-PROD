// FILE: src/components/scanner/GhostLocationCapture.tsx
// Ghost Protocol - Store Information Capture Form
// Mobile-first with minimal taps required

import React, { useState } from 'react';
import {
  MapPin, DollarSign, Clock, Store, StickyNote, RefreshCw,
  ChevronDown, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { STORE_TYPES, type StoreInfo, type StoreType, type GhostLocation } from '@/hooks/useGhostMode';

interface GhostLocationCaptureProps {
  location: GhostLocation | null;
  storeInfo: StoreInfo | null;
  onUpdateStore: (updates: Partial<StoreInfo>) => void;
  onRefreshLocation: () => void;
  handlingHours: number;
  onHandlingHoursChange: (hours: number) => void;
  isCapturing: boolean;
  className?: string;
}

export const GhostLocationCapture: React.FC<GhostLocationCaptureProps> = ({
  location,
  storeInfo,
  onUpdateStore,
  onRefreshLocation,
  handlingHours,
  onHandlingHoursChange,
  isCapturing,
  className,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  if (!location) return null;

  const isComplete = storeInfo?.name && storeInfo?.shelf_price > 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Location Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-full p-1.5 bg-emerald-500/20">
            <MapPin className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-200">Location Pinned</p>
            <p className="text-[10px] text-zinc-500">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefreshLocation}
          disabled={isCapturing}
          className="h-8 px-2"
        >
          <RefreshCw className={cn('h-3 w-3', isCapturing && 'animate-spin')} />
        </Button>
      </div>

      {/* Store Type - Quick Select */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-400">Store Type</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {STORE_TYPES.slice(0, 8).map((type) => (
            <button
              key={type.value}
              onClick={() => onUpdateStore({ type: type.value })}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg border transition-all touch-manipulation',
                storeInfo?.type === type.value
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
              )}
            >
              <span className="text-lg">{type.icon}</span>
              <span className="text-[9px] mt-0.5 line-clamp-1">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Store Name - Required */}
      <div className="space-y-2">
        <Label htmlFor="store-name" className="text-xs text-zinc-400 flex items-center gap-1">
          <Store className="h-3 w-3" />
          Store Name <span className="text-red-400">*</span>
        </Label>
        <Input
          id="store-name"
          value={storeInfo?.name || ''}
          onChange={(e) => onUpdateStore({ name: e.target.value })}
          placeholder="Goodwill, Garage Sale, etc."
          className="bg-zinc-900 border-zinc-800 h-10"
        />
      </div>

      {/* Shelf Price - Required */}
      <div className="space-y-2">
        <Label htmlFor="shelf-price" className="text-xs text-zinc-400 flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          Shelf Price <span className="text-red-400">*</span>
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            id="shelf-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={storeInfo?.shelf_price || ''}
            onChange={(e) => onUpdateStore({ shelf_price: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="pl-9 bg-zinc-900 border-zinc-800 h-10"
          />
        </div>
        <p className="text-[10px] text-zinc-500">
          The price tag on the item at the store
        </p>
      </div>

      {/* Handling Time Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Handling Time
          </Label>
          <span className="text-sm font-mono text-purple-400">{handlingHours}hr</span>
        </div>
        <Slider
          value={[handlingHours]}
          onValueChange={(v) => onHandlingHoursChange(v[0])}
          min={24}
          max={120}
          step={12}
          className="py-2"
        />
        <div className="flex justify-between text-[10px] text-zinc-600">
          <span>24hr</span>
          <span>48hr</span>
          <span>72hr</span>
          <span>96hr</span>
          <span>120hr</span>
        </div>
      </div>

      {/* Advanced Options - Collapsible */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between text-zinc-500 hover:text-zinc-300"
          >
            <span className="text-xs">Additional Details (optional)</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isAdvancedOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Aisle/Location */}
          <div className="space-y-1.5">
            <Label htmlFor="aisle" className="text-xs text-zinc-500">
              Aisle / Section
            </Label>
            <Input
              id="aisle"
              value={storeInfo?.aisle || ''}
              onChange={(e) => onUpdateStore({ aisle: e.target.value })}
              placeholder="Aisle 4, Electronics section, etc."
              className="bg-zinc-900 border-zinc-800 h-9 text-sm"
            />
          </div>

          {/* Store Hours */}
          <div className="space-y-1.5">
            <Label htmlFor="hours" className="text-xs text-zinc-500">
              Store Hours
            </Label>
            <Input
              id="hours"
              value={storeInfo?.hours || ''}
              onChange={(e) => onUpdateStore({ hours: e.target.value })}
              placeholder="9am-8pm, Weekends only, etc."
              className="bg-zinc-900 border-zinc-800 h-9 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-zinc-500 flex items-center gap-1">
              <StickyNote className="h-3 w-3" />
              Shelf Notes
            </Label>
            <Textarea
              id="notes"
              value={storeInfo?.notes || ''}
              onChange={(e) => onUpdateStore({ notes: e.target.value })}
              placeholder="Condition notes, other items nearby, etc."
              className="bg-zinc-900 border-zinc-800 min-h-[60px] text-sm resize-none"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Completion Status */}
      {isComplete && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">
            Ready to create ghost listing
          </span>
        </div>
      )}
    </div>
  );
};

export default GhostLocationCapture;