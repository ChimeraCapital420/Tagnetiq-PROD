// FILE: src/components/marketplace/ShippingOptionsSelector.tsx
// Smart shipping configuration with recommendations
// Lets seller decide who pays, but shows them the impact on margin

import React, { useMemo } from 'react';
import { 
  Truck, Package, MapPin, DollarSign, 
  TrendingUp, AlertTriangle, CheckCircle2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  getShippingRecommendation, 
  type ShippingPayer,
  type ShippingRecommendation 
} from '@/lib/ghost-kpi-tracker';

// =============================================================================
// TYPES
// =============================================================================

interface ShippingOptionsSelectorProps {
  itemValue: number;          // Listed price
  shelfPrice: number;         // What scout paid/will pay
  category: string;
  estimatedWeight?: number;   // lbs
  buyerZipCode?: string;
  sellerZipCode?: string;
  onChange: (config: ShippingConfig) => void;
  className?: string;
}

interface ShippingConfig {
  payer: ShippingPayer;
  estimatedCost: number;
  offerLocalPickup: boolean;
}

// =============================================================================
// SHIPPING COST ESTIMATOR (simplified - would use carrier APIs)
// =============================================================================

function estimateShippingCost(
  weight: number = 1,
  category: string
): number {
  // Base rates (USPS Ground Advantage approximation)
  const baseRates: Record<string, number> = {
    coins: 4.50,
    jewelry: 5.00,
    cards: 4.00,
    toys: 8.50,
    electronics: 12.00,
    clothing: 7.50,
    books: 6.00,
    art: 15.00,
    collectibles: 8.00,
    default: 9.00,
  };

  const categoryKey = Object.keys(baseRates).find(k => 
    category.toLowerCase().includes(k)
  ) || 'default';

  const baseRate = baseRates[categoryKey];
  
  // Adjust for weight
  if (weight <= 1) return baseRate;
  if (weight <= 5) return baseRate + (weight - 1) * 1.50;
  if (weight <= 10) return baseRate + 6 + (weight - 5) * 2.00;
  return baseRate + 16 + (weight - 10) * 2.50;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ShippingOptionsSelector: React.FC<ShippingOptionsSelectorProps> = ({
  itemValue,
  shelfPrice,
  category,
  estimatedWeight = 1,
  onChange,
  className,
}) => {
  // Calculate shipping cost estimate
  const estimatedShippingCost = useMemo(() => 
    estimateShippingCost(estimatedWeight, category),
    [estimatedWeight, category]
  );

  // Get smart recommendation
  const recommendation = useMemo(() => 
    getShippingRecommendation(
      itemValue,
      shelfPrice,
      estimatedShippingCost,
      category,
      estimatedWeight
    ),
    [itemValue, shelfPrice, estimatedShippingCost, category, estimatedWeight]
  );

  // Local state
  const [selectedPayer, setSelectedPayer] = React.useState<ShippingPayer>(
    recommendation.recommended_payer
  );
  const [offerLocalPickup, setOfferLocalPickup] = React.useState(
    recommendation.recommended_payer === 'local_only'
  );
  const [customShippingCost, setCustomShippingCost] = React.useState(
    estimatedShippingCost.toFixed(2)
  );

  // Calculate margins for display
  const currentShippingCost = parseFloat(customShippingCost) || estimatedShippingCost;
  const margin = itemValue - shelfPrice;
  const marginIfSellerPays = margin - currentShippingCost;
  const marginIfBuyerPays = margin;
  const buyerTotalIfPays = itemValue + currentShippingCost;

  // Emit changes
  React.useEffect(() => {
    onChange({
      payer: selectedPayer,
      estimatedCost: currentShippingCost,
      offerLocalPickup,
    });
  }, [selectedPayer, currentShippingCost, offerLocalPickup, onChange]);

  // Don't show shipping options for local-only items
  if (recommendation.recommended_payer === 'local_only') {
    return (
      <div className={cn('p-4 rounded-lg bg-amber-500/10 border border-amber-500/20', className)}>
        <div className="flex items-center gap-2 text-amber-400">
          <MapPin className="h-4 w-4" />
          <span className="font-medium text-sm">Local Pickup Only</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {recommendation.reason}
        </p>
        <div className="mt-3">
          <Label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={offerLocalPickup}
              onChange={(e) => setOfferLocalPickup(e.target.checked)}
              className="rounded"
              disabled
            />
            <span className="text-sm">Local pickup enabled</span>
          </Label>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Recommendation Banner */}
      <div className={cn(
        'p-3 rounded-lg border flex items-start gap-3',
        recommendation.recommended_payer === 'seller' 
          ? 'bg-emerald-500/10 border-emerald-500/20'
          : 'bg-blue-500/10 border-blue-500/20'
      )}>
        <div className={cn(
          'p-1.5 rounded-full',
          recommendation.recommended_payer === 'seller'
            ? 'bg-emerald-500/20'
            : 'bg-blue-500/20'
        )}>
          {recommendation.recommended_payer === 'seller' ? (
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          ) : (
            <Info className="h-4 w-4 text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium',
            recommendation.recommended_payer === 'seller'
              ? 'text-emerald-400'
              : 'text-blue-400'
          )}>
            {recommendation.recommended_payer === 'seller' 
              ? '💡 Recommend: You pay shipping'
              : '💡 Recommend: Buyer pays shipping'
            }
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recommendation.reason}
          </p>
        </div>
      </div>

      {/* Shipping Cost Input */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4 text-zinc-500" />
          Estimated Shipping Cost
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={customShippingCost}
            onChange={(e) => setCustomShippingCost(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-800"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Based on {estimatedWeight}lb {category} item via USPS
        </p>
      </div>

      {/* Who Pays Selection */}
      <div className="space-y-2">
        <Label className="text-sm">Who pays shipping?</Label>
        <RadioGroup
          value={selectedPayer}
          onValueChange={(v) => setSelectedPayer(v as ShippingPayer)}
          className="space-y-2"
        >
          {/* Buyer Pays Option */}
          <label className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
            selectedPayer === 'buyer'
              ? 'border-primary bg-primary/5'
              : 'border-zinc-800 hover:border-zinc-700'
          )}>
            <RadioGroupItem value="buyer" id="buyer" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Buyer pays</span>
                {recommendation.recommended_payer === 'buyer' && (
                  <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-400">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buyer sees: ${buyerTotalIfPays.toFixed(2)} total
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-emerald-400">
                +${marginIfBuyerPays.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">your profit</p>
            </div>
          </label>

          {/* Seller Pays Option (Free Shipping) */}
          <label className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
            selectedPayer === 'seller'
              ? 'border-primary bg-primary/5'
              : 'border-zinc-800 hover:border-zinc-700'
          )}>
            <RadioGroupItem value="seller" id="seller" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Free shipping (you pay)</span>
                {recommendation.recommended_payer === 'seller' && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400">
                    Recommended
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buyer sees: ${itemValue.toFixed(2)} with FREE shipping
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                'text-sm font-mono',
                marginIfSellerPays >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {marginIfSellerPays >= 0 ? '+' : ''}${marginIfSellerPays.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">your profit</p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Warning if margin goes negative */}
      {selectedPayer === 'seller' && marginIfSellerPays < 0 && (
        <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">
            Warning: Free shipping will result in a loss of ${Math.abs(marginIfSellerPays).toFixed(2)}
          </p>
        </div>
      )}

      {/* Local Pickup Toggle */}
      <div className="pt-2 border-t border-zinc-800">
        <Label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={offerLocalPickup}
            onChange={(e) => setOfferLocalPickup(e.target.checked)}
            className="rounded"
          />
          <MapPin className="h-4 w-4 text-zinc-500" />
          <span className="text-sm">Also offer local pickup</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-zinc-600" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Let buyers pick up in person to avoid shipping</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
      </div>

      {/* Profit Summary */}
      <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Item cost</span>
          <span className="font-mono">${shelfPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-muted-foreground">Sale price</span>
          <span className="font-mono">${itemValue.toFixed(2)}</span>
        </div>
        {selectedPayer === 'seller' && (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-muted-foreground">Shipping (you pay)</span>
            <span className="font-mono text-red-400">-${currentShippingCost.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-zinc-800">
          <span className="font-medium">Your profit</span>
          <span className={cn(
            'font-mono font-bold',
            (selectedPayer === 'seller' ? marginIfSellerPays : marginIfBuyerPays) >= 0
              ? 'text-emerald-400'
              : 'text-red-400'
          )}>
            ${(selectedPayer === 'seller' ? marginIfSellerPays : marginIfBuyerPays).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ShippingOptionsSelector;