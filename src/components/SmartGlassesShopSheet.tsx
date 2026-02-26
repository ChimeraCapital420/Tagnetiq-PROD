// FILE: src/components/SmartGlassesShopSheet.tsx
// Bottom sheet for smart glasses — pair existing glasses OR shop for new ones
//
// Shown when gray glasses icon tapped (no SDK/browser user)
//
// Each brand card has TWO clear actions:
//   🔗 "I have these" → Pair button → starts SDK registration for that brand
//   🛒 "Shop" → affiliate link → opens vendor store (commission opportunity)
//
// Brands with status "supported" show active Pair button
// Brands with status "coming_soon" show disabled Pair + active Shop
//
// AFFILIATE STRATEGY:
//   Meta Ray-Ban → meta.com / ray-ban.com affiliate program
//   XREAL → xreal.com affiliate (ShareASale / direct)
//   RayNeo → rayneo.com affiliate (direct partner program)
//   Even Realities → evenrealities.com (founding partner opportunity)
//
// Mobile-first: Sheet slides up, one-thumb reachable, touch-friendly targets

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Bluetooth, Glasses, Sparkles, ShoppingCart } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type GlassesVendorStatus = 'supported' | 'coming_soon' | 'beta';

export interface GlassesVendor {
  id: string;
  name: string;
  model: string;
  tagline: string;
  specs: string;
  /** Direct product page URL */
  shopUrl: string;
  /** Affiliate link — replace with tracked URLs when partnerships established */
  affiliateUrl: string;
  status: GlassesVendorStatus;
  /** Is the native SDK available on this device right now? */
  sdkAvailable: boolean;
  /** Price range string */
  priceRange: string;
  /** Camera capability — important for Hunt Mode */
  hasCamera: boolean;
}

export interface SmartGlassesShopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user taps "Pair" on a supported brand */
  onPairBrand?: (vendorId: string) => void;
}

// =============================================================================
// VENDOR CATALOG
// Update affiliateUrl with tracked params when partnerships are live
// =============================================================================

const GLASSES_VENDORS: GlassesVendor[] = [
  {
    id: 'meta_rayban',
    name: 'Meta',
    model: 'Ray-Ban Meta Headliner',
    tagline: 'The one Oracle was built for — camera + AI ready',
    specs: '12MP ultra-wide camera · Meta AI built-in · 4hr battery · 48g',
    shopUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses',
    affiliateUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses', // TODO: affiliate params
    status: 'supported',
    sdkAvailable: false, // Set dynamically based on Capacitor detection
    priceRange: '$299–$379',
    hasCamera: true,
  },
  {
    id: 'xreal_air2',
    name: 'XREAL',
    model: 'XREAL Air 2 Ultra',
    tagline: 'AR display shows prices right in your lens',
    specs: '8MP camera · USB-C direct connect · 3hr battery · 75g',
    shopUrl: 'https://www.xreal.com/air2ultra',
    affiliateUrl: 'https://www.xreal.com/air2ultra', // TODO: affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$699',
    hasCamera: true,
  },
  {
    id: 'rayneo_x2',
    name: 'RayNeo',
    model: 'RayNeo X2',
    tagline: 'Full AR with see-through display + camera',
    specs: '12MP camera · Qualcomm XR2 · 5hr battery · 68g',
    shopUrl: 'https://www.rayneo.com/products/rayneo-x2',
    affiliateUrl: 'https://www.rayneo.com/products/rayneo-x2', // TODO: affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$699',
    hasCamera: true,
  },
  {
    id: 'even_g1',
    name: 'Even Realities',
    model: 'G1',
    tagline: 'Ultralight AI glasses — display only, no camera',
    specs: 'No camera · AI text display · 12hr battery · 35g',
    shopUrl: 'https://www.evenrealities.com',
    affiliateUrl: 'https://www.evenrealities.com', // TODO: affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$499',
    hasCamera: false,
  },
];

// =============================================================================
// STATUS BADGE
// =============================================================================

const StatusBadge: React.FC<{ status: GlassesVendorStatus }> = ({ status }) => {
  switch (status) {
    case 'supported':
      return <Badge className="bg-green-600/80 text-white text-xs">Supported</Badge>;
    case 'beta':
      return <Badge className="bg-yellow-600/80 text-white text-xs">Beta</Badge>;
    case 'coming_soon':
      return <Badge variant="outline" className="text-xs opacity-70">Coming Soon</Badge>;
  }
};

// =============================================================================
// VENDOR CARD — two clear paths: Pair (owners) or Shop (future buyers)
// =============================================================================

const VendorCard: React.FC<{
  vendor: GlassesVendor;
  onPair?: () => void;
}> = ({ vendor, onPair }) => {
  const handleShop = () => {
    // TODO: Track affiliate click for analytics
    // trackEvent('glasses_shop_click', 'affiliate', { vendor: vendor.id });
    window.open(vendor.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const canPair = vendor.status === 'supported';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Top row: brand info + status */}
      <div className="flex items-start gap-3 p-3 pb-2">
        {/* Glasses icon — colored by support status */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          canPair ? 'bg-green-500/20' : 'bg-muted'
        }`}>
          <Glasses className={`w-5 h-5 ${
            canPair ? 'text-green-500' : 'text-muted-foreground'
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm">{vendor.model}</span>
            <StatusBadge status={vendor.status} />
          </div>
          <p className="text-xs text-muted-foreground">{vendor.tagline}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{vendor.specs}</p>
        </div>

        {/* Price */}
        <div className="flex-shrink-0 text-right">
          <span className="text-sm font-semibold">{vendor.priceRange}</span>
        </div>
      </div>

      {/* Bottom row: action buttons — always two clear options */}
      <div className="flex border-t divide-x">
        {/* Left: "I have these" → Pair */}
        <button
          onClick={canPair && onPair ? onPair : undefined}
          disabled={!canPair}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors touch-manipulation ${
            canPair
              ? 'hover:bg-accent text-foreground'
              : 'text-muted-foreground/40 cursor-not-allowed'
          }`}
        >
          <Bluetooth className="w-3.5 h-3.5" />
          {canPair ? 'Pair My Glasses' : 'Pair (Coming Soon)'}
        </button>

        {/* Right: "I want these" → Shop (affiliate link) */}
        <button
          onClick={handleShop}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium hover:bg-accent text-foreground transition-colors touch-manipulation"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Shop
          <ExternalLink className="w-3 h-3 opacity-50" />
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const SmartGlassesShopSheet: React.FC<SmartGlassesShopSheetProps> = ({
  isOpen,
  onClose,
  onPairBrand,
}) => {
  // Mark Meta as SDK-available if we detect Capacitor runtime
  const isCapacitor = typeof (window as any)?.Capacitor !== 'undefined';
  const vendors = GLASSES_VENDORS.map(v => ({
    ...v,
    sdkAvailable: v.id === 'meta_rayban' && isCapacitor,
  }));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
        <SheetHeader className="text-left pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Smart Glasses for TagnetIQ
          </SheetTitle>
          <SheetDescription>
            Already own a pair? Tap <strong>Pair</strong> to connect. Shopping? Tap <strong>Shop</strong> to browse.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2.5 pb-6 overflow-y-auto max-h-[60vh]">
          {/* Camera-equipped glasses first (Hunt Mode compatible) */}
          {vendors
            .filter(v => v.hasCamera)
            .map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onPair={
                  vendor.status === 'supported' && onPairBrand
                    ? () => onPairBrand(vendor.id)
                    : undefined
                }
              />
            ))}

          {/* Display-only glasses */}
          {vendors.filter(v => !v.hasCamera).length > 0 && (
            <>
              <p className="text-xs text-muted-foreground pt-2 px-1">
                Display-only glasses (no camera — Oracle results shown in-lens)
              </p>
              {vendors
                .filter(v => !v.hasCamera)
                .map((vendor) => (
                  <VendorCard
                    key={vendor.id}
                    vendor={vendor}
                    onPair={
                      vendor.status === 'supported' && onPairBrand
                        ? () => onPairBrand(vendor.id)
                        : undefined
                    }
                  />
                ))}
            </>
          )}

          {/* Request new brand */}
          <div className="text-center pt-3 pb-1">
            <p className="text-xs text-muted-foreground">
              Have a different pair?{' '}
              <button
                className="underline hover:text-foreground transition-colors"
                onClick={() => {
                  window.open(
                    'mailto:glasses@tagnetiq.com?subject=Smart%20Glasses%20Support%20Request&body=I%20have%20these%20glasses%20and%20want%20TagnetIQ%20support%3A%20',
                    '_blank'
                  );
                }}
              >
                Request support for your brand
              </button>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SmartGlassesShopSheet;