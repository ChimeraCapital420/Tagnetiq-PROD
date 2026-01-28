// FILE: src/components/marketplace/TagnetiqListingForm.tsx
// TagnetIQ listing form with AI description distinction

import React, { useState, useMemo } from 'react';
import {
  DollarSign, Sparkles, Store, Loader2, CheckCircle2,
  MapPin, Truck, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { MarketplaceItem } from './platforms/types';

interface TagnetiqListingFormProps {
  item: MarketplaceItem;
  onSubmit: (item: MarketplaceItem, price: number, description: string) => Promise<void>;
  disabled?: boolean;
}

export const TagnetiqListingForm: React.FC<TagnetiqListingFormProps> = ({
  item,
  onSubmit,
  disabled = false,
}) => {
  // Form state
  const [price, setPrice] = useState(item.asking_price.toString());
  const [includeAiDescription, setIncludeAiDescription] = useState(true);
  const [sellerNotes, setSellerNotes] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [offersShipping, setOffersShipping] = useState(true);
  const [offersLocalPickup, setOffersLocalPickup] = useState(true);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListed, setIsListed] = useState(false);

  // Build final description from components
  const finalDescription = useMemo(() => {
    let description = '';
    
    if (includeAiDescription && item.description) {
      description += item.description;
    }
    
    if (sellerNotes) {
      description += (description ? '\n\n' : '') + sellerNotes;
    }
    
    if (itemLocation) {
      description += `\n\n📍 Location: ${itemLocation}`;
      const options = [];
      if (offersShipping) options.push('Shipping available');
      if (offersLocalPickup) options.push('Local pickup');
      if (options.length) description += ` • ${options.join(' • ')}`;
    }
    
    return description.trim();
  }, [includeAiDescription, item.description, sellerNotes, itemLocation, offersShipping, offersLocalPickup]);

  const handleSubmit = async () => {
    if (!finalDescription || finalDescription.length < 20) {
      // Pad description if too short
      const paddedDescription = finalDescription || `${item.item_name}. Listed on TagnetIQ Marketplace.`;
      setIsSubmitting(true);
      try {
        await onSubmit(item, parseFloat(price) || item.asking_price, paddedDescription);
        setIsListed(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(item, parseFloat(price) || item.asking_price, finalDescription);
      setIsListed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      {/* Asking Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Asking Price</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800"
            placeholder="0.00"
            disabled={disabled || isListed}
          />
        </div>
        {item.estimated_value && (
          <p className="text-xs text-zinc-500 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            HYDRA Estimate: ${item.estimated_value.toLocaleString()}
          </p>
        )}
      </div>

      <Separator className="bg-zinc-800" />

      {/* AI-Generated Description Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            HYDRA AI Analysis
          </Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="includeAI"
              checked={includeAiDescription}
              onCheckedChange={(checked) => setIncludeAiDescription(checked as boolean)}
              disabled={disabled || isListed || !item.description}
            />
            <Label htmlFor="includeAI" className="text-xs text-zinc-400 cursor-pointer">
              Include in listing
            </Label>
          </div>
        </div>

        {item.description ? (
          <div
            className={cn(
              'rounded-lg border p-3 transition-all',
              includeAiDescription
                ? 'border-primary/30 bg-primary/5'
                : 'border-zinc-800 bg-zinc-900/50 opacity-50'
            )}
          >
            <p className="text-sm text-zinc-300 italic leading-relaxed">
              {item.description}
            </p>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800/50">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] text-zinc-500">Generated by HYDRA AI</span>
              {item.authoritySource && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span className="text-[10px] text-zinc-500">
                    Source: {item.authoritySource}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
            <p className="text-sm text-zinc-500 italic">
              No AI analysis available. Add your own description below.
            </p>
          </div>
        )}
      </div>

      {/* Seller Notes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Your Notes</Label>
        <Textarea
          value={sellerNotes}
          onChange={(e) => setSellerNotes(e.target.value)}
          className="min-h-[80px] bg-zinc-900 border-zinc-800 resize-none"
          placeholder="Add personal details, history, reason for selling..."
          disabled={disabled || isListed}
        />
        <p className="text-[10px] text-zinc-500">
          Your notes appear after the AI description in regular text
        </p>
      </div>

      {/* Location & Shipping */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4 text-zinc-400" />
          Item Location
        </Label>
        <Input
          value={itemLocation}
          onChange={(e) => setItemLocation(e.target.value)}
          className="bg-zinc-900 border-zinc-800"
          placeholder="City, State or ZIP code"
          disabled={disabled || isListed}
        />
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="shipping"
              checked={offersShipping}
              onCheckedChange={(checked) => setOffersShipping(checked as boolean)}
              disabled={disabled || isListed}
            />
            <Label htmlFor="shipping" className="text-xs text-zinc-400 cursor-pointer flex items-center gap-1">
              <Truck className="h-3 w-3" />
              Offers shipping
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="localPickup"
              checked={offersLocalPickup}
              onCheckedChange={(checked) => setOffersLocalPickup(checked as boolean)}
              disabled={disabled || isListed}
            />
            <Label htmlFor="localPickup" className="text-xs text-zinc-400 cursor-pointer flex items-center gap-1">
              <Package className="h-3 w-3" />
              Local pickup
            </Label>
          </div>
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Final Description Preview */}
      <div className="space-y-2">
        <Label className="text-xs text-zinc-500">Final Listing Preview</Label>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-sm max-h-40 overflow-y-auto">
          {includeAiDescription && item.description && (
            <p className="text-zinc-300 italic mb-2">{item.description}</p>
          )}
          {sellerNotes && (
            <p className="text-zinc-100">{sellerNotes}</p>
          )}
          {itemLocation && (
            <p className="text-zinc-500 text-xs mt-2">
              📍 {itemLocation}
              {offersShipping && ' • Ships'}
              {offersLocalPickup && ' • Local pickup'}
            </p>
          )}
          {!finalDescription && (
            <p className="text-zinc-500 italic">Add a description above...</p>
          )}
        </div>
        {finalDescription && (
          <p className="text-[10px] text-zinc-500">
            {finalDescription.length} characters
            {finalDescription.length < 20 && ' (minimum 20 required)'}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        className="w-full h-11"
        disabled={disabled || isSubmitting || isListed}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
          </>
        ) : isListed ? (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Listed!
          </>
        ) : (
          <>
            <Store className="h-4 w-4 mr-2" /> List on TagnetIQ
          </>
        )}
      </Button>
    </div>
  );
};

export default TagnetiqListingForm;