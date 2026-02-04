// FILE: src/components/arena/GhostFulfillmentModal.tsx
// Ghost Protocol - Fulfillment Verification Form
// Captures verified sale data when scout completes a ghost listing
// This data feeds: HYDRA accuracy, Arbitrage Spread, Platform Intelligence

import React, { useState, useMemo } from 'react';
import {
  Ghost, DollarSign, Store, Package, Truck, CheckCircle2,
  ExternalLink, Camera, AlertTriangle, Loader2, Receipt,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface GhostListingData {
  id: string;
  title: string;
  images: string[];
  listed_price: number;
  shelf_price: number;
  estimated_margin: number;
  store_name: string;
  store_type: string;
  created_at: string;
  sold_at?: string;
}

interface FulfillmentData {
  sale_platform: string;
  sale_price: number;
  actual_cost: number;
  platform_fees: number;
  shipping_cost: number;
  shipping_carrier: string;
  tracking_number: string;
  proof_url?: string;
  notes?: string;
}

interface GhostFulfillmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: GhostListingData;
  onComplete: (data: FulfillmentData) => Promise<void>;
}

// =============================================================================
// PLATFORM OPTIONS
// =============================================================================

const SALE_PLATFORMS = [
  { value: 'tagnetiq', label: 'TagnetIQ Marketplace', icon: '🏷️' },
  { value: 'ebay', label: 'eBay', icon: '🛒' },
  { value: 'facebook', label: 'Facebook Marketplace', icon: '📘' },
  { value: 'mercari', label: 'Mercari', icon: '🔴' },
  { value: 'poshmark', label: 'Poshmark', icon: '👗' },
  { value: 'offerup', label: 'OfferUp', icon: '🤝' },
  { value: 'craigslist', label: 'Craigslist', icon: '📋' },
  { value: 'depop', label: 'Depop', icon: '🌀' },
  { value: 'etsy', label: 'Etsy', icon: '🧡' },
  { value: 'whatnot', label: 'Whatnot', icon: '📺' },
  { value: 'hibid', label: 'HiBid', icon: '🔨' },
  { value: 'local_cash', label: 'Local Cash Sale', icon: '💵' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const SHIPPING_CARRIERS = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'pirateship', label: 'Pirate Ship' },
  { value: 'local_pickup', label: 'Local Pickup (No Shipping)' },
  { value: 'other', label: 'Other' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const GhostFulfillmentModal: React.FC<GhostFulfillmentModalProps> = ({
  open,
  onOpenChange,
  listing,
  onComplete,
}) => {
  const { session } = useAuth();
  
  // Form state
  const [salePlatform, setSalePlatform] = useState('');
  const [salePrice, setSalePrice] = useState(listing.listed_price.toString());
  const [actualCost, setActualCost] = useState(listing.shelf_price.toString());
  const [platformFees, setPlatformFees] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'sale' | 'shipping' | 'review'>('sale');

  // ==========================================================================
  // CALCULATIONS
  // ==========================================================================

  const calculations = useMemo(() => {
    const sale = parseFloat(salePrice) || 0;
    const cost = parseFloat(actualCost) || 0;
    const fees = parseFloat(platformFees) || 0;
    const shipping = parseFloat(shippingCost) || 0;
    
    const grossProfit = sale - cost;
    const netProfit = sale - cost - fees - shipping;
    const marginPercent = cost > 0 ? ((sale - cost) / cost) * 100 : 0;
    const roi = cost > 0 ? (netProfit / cost) * 100 : 0;
    
    // Compare to HYDRA estimate
    const estimatedMargin = listing.estimated_margin;
    const accuracyDiff = netProfit - estimatedMargin;
    const accuracyPercent = estimatedMargin !== 0 
      ? ((netProfit / estimatedMargin) * 100) 
      : 0;

    return {
      grossProfit,
      netProfit,
      marginPercent,
      roi,
      estimatedMargin,
      accuracyDiff,
      accuracyPercent,
      isOverEstimate: netProfit > estimatedMargin,
      isUnderEstimate: netProfit < estimatedMargin,
    };
  }, [salePrice, actualCost, platformFees, shippingCost, listing.estimated_margin]);

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const canProceedToShipping = salePlatform && parseFloat(salePrice) > 0 && parseFloat(actualCost) >= 0;
  const canProceedToReview = shippingCarrier && (shippingCarrier === 'local_pickup' || trackingNumber);
  const canSubmit = canProceedToShipping && canProceedToReview;

  // ==========================================================================
  // SUBMIT
  // ==========================================================================

  const handleSubmit = async () => {
    if (!canSubmit) return;
    
    setIsSubmitting(true);
    
    try {
      const fulfillmentData: FulfillmentData = {
        sale_platform: salePlatform,
        sale_price: parseFloat(salePrice),
        actual_cost: parseFloat(actualCost),
        platform_fees: parseFloat(platformFees) || 0,
        shipping_cost: parseFloat(shippingCost) || 0,
        shipping_carrier: shippingCarrier,
        tracking_number: trackingNumber || 'LOCAL_PICKUP',
        proof_url: proofUrl || undefined,
        notes: notes || undefined,
      };
      
      await onComplete(fulfillmentData);
      
      toast.success('🎉 Ghost Hunt Complete!', {
        description: `Net profit: $${calculations.netProfit.toFixed(2)} (${calculations.roi.toFixed(0)}% ROI)`,
      });
      
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to complete fulfillment', {
        description: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-400" />
            Complete Ghost Hunt
          </DialogTitle>
          <DialogDescription>
            Verify sale details to complete this ghost listing and record your profit.
          </DialogDescription>
        </DialogHeader>

        {/* Item Summary */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
            {listing.images?.[0] ? (
              <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Ghost className="h-6 w-6 text-zinc-600" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{listing.title}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Store className="h-3 w-3" />
              <span>{listing.store_name}</span>
              <span>•</span>
              <span>${listing.shelf_price} shelf</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">${listing.listed_price}</p>
            <p className="text-[10px] text-zinc-500">listed</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-2">
          {['sale', 'shipping', 'review'].map((s, i) => (
            <React.Fragment key={s}>
              <button
                onClick={() => setStep(s as any)}
                disabled={s === 'shipping' && !canProceedToShipping}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded transition-all',
                  step === s
                    ? 'bg-purple-500 text-white'
                    : s === 'sale' || (s === 'shipping' && canProceedToShipping) || (s === 'review' && canProceedToReview)
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                )}
              >
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            </React.Fragment>
          ))}
        </div>

        <Separator className="bg-zinc-800" />

        {/* Step Content */}
        <div className="space-y-4 py-2">
          
          {/* STEP 1: Sale Details */}
          {step === 'sale' && (
            <>
              {/* Platform Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Where did it sell? *</Label>
                <Select value={salePlatform} onValueChange={setSalePlatform}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span>{p.icon}</span>
                          <span>{p.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sale Price */}
              <div className="space-y-2">
                <Label className="text-sm">Final Sale Price *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                    placeholder="0.00"
                  />
                </div>
                {parseFloat(salePrice) !== listing.listed_price && (
                  <p className="text-[10px] text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Different from listed price (${listing.listed_price})
                  </p>
                )}
              </div>

              {/* Actual Cost */}
              <div className="space-y-2">
                <Label className="text-sm">Actual Cost Paid at Store *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                    placeholder="0.00"
                  />
                </div>
                {parseFloat(actualCost) !== listing.shelf_price && (
                  <p className="text-[10px] text-blue-400 flex items-center gap-1">
                    Shelf price was ${listing.shelf_price} - did you negotiate?
                  </p>
                )}
              </div>

              {/* Platform Fees */}
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Platform/Payment Fees (optional)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={platformFees}
                    onChange={(e) => setPlatformFees(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Shipping Details */}
          {step === 'shipping' && (
            <>
              {/* Shipping Cost */}
              <div className="space-y-2">
                <Label className="text-sm">Shipping Cost</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Carrier Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Shipping Carrier *</Label>
                <Select value={shippingCarrier} onValueChange={setShippingCarrier}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800">
                    <SelectValue placeholder="Select carrier" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIPPING_CARRIERS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tracking Number */}
              {shippingCarrier && shippingCarrier !== 'local_pickup' && (
                <div className="space-y-2">
                  <Label className="text-sm">Tracking Number *</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="pl-9 bg-zinc-900 border-zinc-800 font-mono"
                      placeholder="Enter tracking number"
                    />
                  </div>
                </div>
              )}

              {shippingCarrier === 'local_pickup' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">Local pickup - no tracking required</span>
                </div>
              )}

              {/* Proof URL (optional) */}
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Sale Proof URL (optional)</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                    placeholder="Link to sale confirmation, screenshot, etc."
                  />
                </div>
              </div>
            </>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <>
              {/* Profit Breakdown */}
              <div className="space-y-3 p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-zinc-400" />
                  Profit Breakdown
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sale Price</span>
                    <span className="font-mono">${parseFloat(salePrice).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Cost Paid</span>
                    <span className="font-mono text-red-400">-${parseFloat(actualCost).toFixed(2)}</span>
                  </div>
                  {parseFloat(platformFees) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Platform Fees</span>
                      <span className="font-mono text-red-400">-${parseFloat(platformFees).toFixed(2)}</span>
                    </div>
                  )}
                  {parseFloat(shippingCost) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Shipping</span>
                      <span className="font-mono text-red-400">-${parseFloat(shippingCost).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-zinc-700" />
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Net Profit</span>
                    <span className={cn(
                      'font-mono font-bold text-lg',
                      calculations.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      ${calculations.netProfit.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">ROI</span>
                    <span className={cn(
                      'font-mono',
                      calculations.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {calculations.roi.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* HYDRA Accuracy Comparison */}
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Ghost className="h-4 w-4 text-purple-400" />
                  HYDRA Prediction Accuracy
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Estimated</p>
                    <p className="text-lg font-mono">${calculations.estimatedMargin.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase">Actual</p>
                    <p className="text-lg font-mono">${calculations.netProfit.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  {calculations.isOverEstimate ? (
                    <>
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm text-emerald-400">
                        Beat estimate by ${Math.abs(calculations.accuracyDiff).toFixed(2)}!
                      </span>
                    </>
                  ) : calculations.isUnderEstimate ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-yellow-400">
                        ${Math.abs(calculations.accuracyDiff).toFixed(2)} under estimate
                      </span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-blue-400">Spot on!</span>
                    </>
                  )}
                </div>
                
                <p className="text-[10px] text-zinc-500 mt-2">
                  This data improves HYDRA's predictions for future scouts.
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 min-h-[60px] resize-none"
                  placeholder="Any notes about this sale..."
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {step !== 'sale' && (
            <Button
              variant="outline"
              onClick={() => setStep(step === 'review' ? 'shipping' : 'sale')}
            >
              Back
            </Button>
          )}
          
          {step === 'sale' && (
            <Button
              onClick={() => setStep('shipping')}
              disabled={!canProceedToShipping}
              className="flex-1"
            >
              Next: Shipping
            </Button>
          )}
          
          {step === 'shipping' && (
            <Button
              onClick={() => setStep('review')}
              disabled={!canProceedToReview}
              className="flex-1"
            >
              Next: Review
            </Button>
          )}
          
          {step === 'review' && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Complete Hunt
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GhostFulfillmentModal;