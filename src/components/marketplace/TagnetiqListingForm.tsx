// FILE: src/components/marketplace/TagnetiqListingForm.tsx
// TagnetIQ listing form with AI description distinction + Ghost Protocol support
// UPDATED: Ghost mode handling time, disclaimer, and KPI capture

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DollarSign, Sparkles, Store, Loader2, CheckCircle2,
  MapPin, Truck, Package, ExternalLink, Ghost, Clock, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MarketplaceItem } from './platforms/types';
import type { GhostData } from '@/hooks/useGhostMode';

// Zippopotam.us API response type
interface ZipLookupResult {
  'post code': string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    longitude: string;
    state: string;
    'state abbreviation': string;
    latitude: string;
  }>;
}

interface TagnetiqListingFormProps {
  item: MarketplaceItem;
  onSubmit: (item: MarketplaceItem, price: number, description: string, ghostData?: GhostData) => Promise<void>;
  disabled?: boolean;
  ghostData?: GhostData | null;  // NEW: Ghost data from analysis
}

export const TagnetiqListingForm: React.FC<TagnetiqListingFormProps> = ({
  item,
  onSubmit,
  disabled = false,
  ghostData = null,
}) => {
  // Form state
  const [price, setPrice] = useState(item.asking_price.toString());
  const [includeAiDescription, setIncludeAiDescription] = useState(true);
  const [sellerNotes, setSellerNotes] = useState('');
  
  // Location - use ghost data if available
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLookingUpZip, setIsLookingUpZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  
  const [offersShipping, setOffersShipping] = useState(true);
  const [offersLocalPickup, setOffersLocalPickup] = useState(!ghostData); // Default off for ghost
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListed, setIsListed] = useState(false);

  // Ghost-specific state
  const isGhostListing = !!ghostData?.is_ghost;

  // Initialize from ghost data if available
  useEffect(() => {
    if (ghostData?.store?.name) {
      // Pre-fill store name as location hint
      setSellerNotes(prev => {
        if (prev) return prev;
        return `Found at: ${ghostData.store.name}${ghostData.store.aisle ? ` (${ghostData.store.aisle})` : ''}`;
      });
    }
  }, [ghostData]);

  // Computed full location string
  const itemLocation = useMemo(() => {
    if (city && state) {
      return `${city}, ${state} ${zipCode}`.trim();
    }
    return zipCode;
  }, [city, state, zipCode]);

  // Zippopotam.us API integration for ZIP code auto-fill
  const lookupZipCode = useCallback(async (zip: string) => {
    if (!/^\d{5}$/.test(zip)) return;

    setIsLookingUpZip(true);
    setZipError(null);

    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setZipError('ZIP code not found');
        }
        return;
      }

      const data: ZipLookupResult = await response.json();
      
      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        setCity(place['place name']);
        setState(place['state abbreviation']);
        
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    } catch (error) {
      console.warn('[ZipLookup] Error:', error);
    } finally {
      setIsLookingUpZip(false);
    }
  }, []);

  useEffect(() => {
    if (zipCode.length === 5) {
      lookupZipCode(zipCode);
    } else if (zipCode.length < 5) {
      setCity('');
      setState('');
      setZipError(null);
    }
  }, [zipCode, lookupZipCode]);

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(value);
  };

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

    // Add ghost disclaimer
    if (isGhostListing && ghostData) {
      description += `\n\n⏱️ Handling Time: ${ghostData.timer.handling_hours} hours`;
    }
    
    return description.trim();
  }, [includeAiDescription, item.description, sellerNotes, itemLocation, offersShipping, offersLocalPickup, isGhostListing, ghostData]);

  const handleSubmit = async () => {
    if (!finalDescription || finalDescription.length < 20) {
      const paddedDescription = finalDescription || `${item.item_name}. Listed on TagnetIQ Marketplace.`;
      setIsSubmitting(true);
      try {
        await onSubmit(item, parseFloat(price) || item.asking_price, paddedDescription, ghostData || undefined);
        setIsListed(true);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(item, parseFloat(price) || item.asking_price, finalDescription, ghostData || undefined);
      setIsListed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-lg">
      {/* Ghost Mode Banner */}
      {isGhostListing && ghostData && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-400" />
            <span className="font-medium text-purple-300">Ghost Protocol Active</span>
            <Badge variant="outline" className="border-purple-500/50 text-purple-400 text-[10px]">
              {ghostData.kpis.velocity_score.toUpperCase()} VELOCITY
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-zinc-900/50 p-2">
              <p className="text-xs text-zinc-500">Shelf Price</p>
              <p className="text-sm font-mono text-white">${ghostData.store.shelf_price.toFixed(2)}</p>
            </div>
            <div className="rounded bg-zinc-900/50 p-2">
              <p className="text-xs text-zinc-500">Est. Profit</p>
              <p className="text-sm font-mono text-emerald-400">
                ${ghostData.kpis.estimated_margin.toFixed(2)}
              </p>
            </div>
            <div className="rounded bg-zinc-900/50 p-2">
              <p className="text-xs text-zinc-500">Handling</p>
              <p className="text-sm font-mono text-yellow-400">{ghostData.timer.handling_hours}hr</p>
            </div>
          </div>

          <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-400">
              You don't own this item yet. When it sells, you'll receive a fulfillment alert to retrieve it from{' '}
              <strong>{ghostData.store.name}</strong>
              {ghostData.store.aisle && ` (${ghostData.store.aisle})`}.
            </p>
          </div>
        </div>
      )}

      {/* Asking Price */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Asking Price</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800"
            placeholder="0.00"
            disabled={disabled || isListed}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          {item.estimated_value && (
            <p className="text-zinc-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              HYDRA Estimate: ${item.estimated_value.toLocaleString()}
            </p>
          )}
          {isGhostListing && ghostData && (
            <p className="text-emerald-500">
              Margin: ${(parseFloat(price) - ghostData.store.shelf_price).toFixed(2)}
            </p>
          )}
        </div>
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
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-800/50">
              <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
              <span className="text-[10px] text-zinc-500">Generated by HYDRA AI</span>
              
              {item.authoritySource && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span className="text-[10px] text-zinc-500">
                    Source: {item.authoritySource}
                  </span>
                </>
              )}
              
              {item.numista_url && (
                <a 
                  href={item.numista_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Numista
                </a>
              )}
              {item.googlebooks_url && (
                <a 
                  href={item.googlebooks_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Google Books
                </a>
              )}
              {item.colnect_url && (
                <a 
                  href={item.colnect_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Colnect
                </a>
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

      {/* Location & Shipping - Hide for ghost since location is captured */}
      {!isGhostListing && (
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-zinc-400" />
            Item Location
          </Label>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <div className="relative">
                <Input
                  value={zipCode}
                  onChange={handleZipChange}
                  className={cn(
                    "bg-zinc-900 border-zinc-800 text-center font-mono",
                    zipError && "border-red-500/50",
                    city && state && "border-emerald-500/50"
                  )}
                  placeholder="ZIP"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  disabled={disabled || isListed}
                  aria-label="ZIP code"
                />
                {isLookingUpZip && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="col-span-1">
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={cn(
                  "bg-zinc-900 border-zinc-800",
                  city && "bg-emerald-950/20"
                )}
                placeholder="City"
                disabled={disabled || isListed}
                aria-label="City"
              />
            </div>
            
            <div className="col-span-1">
              <Input
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                className={cn(
                  "bg-zinc-900 border-zinc-800 text-center uppercase",
                  state && "bg-emerald-950/20"
                )}
                placeholder="ST"
                maxLength={2}
                disabled={disabled || isListed}
                aria-label="State"
              />
            </div>
          </div>
          
          {zipError && (
            <p className="text-[10px] text-red-400">{zipError}</p>
          )}
          {city && state && (
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Location auto-filled from ZIP code
            </p>
          )}
          {!city && !state && zipCode.length < 5 && (
            <p className="text-[10px] text-zinc-500">
              Enter 5-digit ZIP to auto-fill city & state
            </p>
          )}
        </div>
      )}

      {/* Shipping options */}
      <div className="flex flex-wrap gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="shipping"
            checked={offersShipping}
            onCheckedChange={(checked) => setOffersShipping(checked as boolean)}
            disabled={disabled || isListed}
          />
          <Label htmlFor="shipping" className="text-xs text-zinc-400 cursor-pointer flex items-center gap-1 touch-manipulation">
            <Truck className="h-3 w-3" />
            <span className="hidden xs:inline">Offers</span> shipping
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="localPickup"
            checked={offersLocalPickup}
            onCheckedChange={(checked) => setOffersLocalPickup(checked as boolean)}
            disabled={disabled || isListed || isGhostListing}
          />
          <Label 
            htmlFor="localPickup" 
            className={cn(
              "text-xs cursor-pointer flex items-center gap-1 touch-manipulation",
              isGhostListing ? "text-zinc-600" : "text-zinc-400"
            )}
          >
            <Package className="h-3 w-3" />
            Local pickup
            {isGhostListing && <span className="text-[9px]">(N/A for ghost)</span>}
          </Label>
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
          {isGhostListing && ghostData && (
            <p className="text-yellow-500 text-xs mt-2">
              ⏱️ Handling Time: {ghostData.timer.handling_hours} hours
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
        className={cn(
          "w-full h-12 touch-manipulation text-base",
          isGhostListing && "bg-purple-600 hover:bg-purple-700"
        )}
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
        ) : isGhostListing ? (
          <>
            <Ghost className="h-4 w-4 mr-2" /> Create Ghost Listing
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