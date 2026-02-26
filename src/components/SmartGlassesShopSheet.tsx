// FILE: src/components/SmartGlassesShopSheet.tsx
// Bottom sheet for smart glasses brand discovery + affiliate links
//
// Shown when:
//   1. Gray glasses icon tapped (no SDK/browser user) → "Get Smart Glasses"
//   2. Could also be triggered from Settings or a dedicated page
//
// Each brand card shows:
//   - Brand logo/icon + model name
//   - Key specs (camera, battery, weight)
//   - "Pair" button if SDK available on device
//   - "Shop" button → affiliate link (external)
//   - Status badge: "Supported" / "Coming Soon"
//
// AFFILIATE STRATEGY:
//   Meta Ray-Ban → meta.com affiliate program (Meta Partner Hub)
//   XREAL → xreal.com affiliate (ShareASale / direct)
//   RayNeo → rayneo.com affiliate (direct partner program)
//   Even Realities → evenrealities.com (early partnership opportunity)
//   Amazon generics → Amazon Associates link
//
// Mobile-first: Sheet slides up, one-thumb reachable

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
import { ExternalLink, Bluetooth, Glasses, Sparkles } from 'lucide-react';

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
  shopUrl: string;
  /** Affiliate link — replace with actual affiliate URLs */
  affiliateUrl: string;
  status: GlassesVendorStatus;
  /** Is the native SDK available on this device right now? */
  sdkAvailable: boolean;
  /** Price range string */
  priceRange: string;
}

export interface SmartGlassesShopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user taps "Pair" on a supported brand */
  onPairBrand?: (vendorId: string) => void;
}

// =============================================================================
// VENDOR CATALOG — update affiliate URLs when partnerships established
// =============================================================================

const GLASSES_VENDORS: GlassesVendor[] = [
  {
    id: 'meta_rayban',
    name: 'Meta',
    model: 'Ray-Ban Meta Headliner',
    tagline: 'The one Oracle was born for',
    specs: '12MP camera · Qualcomm AR1 · 4hr battery · 48g',
    shopUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses',
    affiliateUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses', // TODO: Add affiliate params
    status: 'supported',
    sdkAvailable: false, // Will be set dynamically
    priceRange: '$299–$379',
  },
  {
    id: 'xreal_air2',
    name: 'XREAL',
    model: 'XREAL Air 2 Ultra',
    tagline: 'AR display + camera, see prices in your lens',
    specs: '8MP camera · USB-C direct · 3hr battery · 75g',
    shopUrl: 'https://www.xreal.com/air2ultra',
    affiliateUrl: 'https://www.xreal.com/air2ultra', // TODO: Add affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$699',
  },
  {
    id: 'rayneo_x2',
    name: 'RayNeo',
    model: 'RayNeo X2',
    tagline: 'Full AR with built-in display',
    specs: '12MP camera · Qualcomm XR2 · 5hr battery · 68g',
    shopUrl: 'https://www.rayneo.com/products/rayneo-x2',
    affiliateUrl: 'https://www.rayneo.com/products/rayneo-x2', // TODO: Add affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$699',
  },
  {
    id: 'even_g1',
    name: 'Even Realities',
    model: 'G1',
    tagline: 'Lightest smart glasses with AI built in',
    specs: 'No camera · AI display · 12hr battery · 35g',
    shopUrl: 'https://www.evenrealities.com',
    affiliateUrl: 'https://www.evenrealities.com', // TODO: Add affiliate params
    status: 'coming_soon',
    sdkAvailable: false,
    priceRange: '$499',
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
// VENDOR CARD
// =============================================================================

const VendorCard: React.FC<{
  vendor: GlassesVendor;
  onPair?: () => void;
}> = ({ vendor, onPair }) => {
  const handleShop = () => {
    // Open affiliate link in new tab
    // Track click for affiliate analytics
    window.open(vendor.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* Glasses icon — colored by status */}
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
        vendor.status === 'supported' ? 'bg-green-500/20' : 'bg-muted'
      }`}>
        <Glasses className={`w-5 h-5 ${
          vendor.status === 'supported' ? 'text-green-500' : 'text-muted-foreground'
        }`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm">{vendor.model}</span>
          <StatusBadge status={vendor.status} />
        </div>
        <p className="text-xs text-muted-foreground mb-1">{vendor.tagline}</p>
        <p className="text-xs text-muted-foreground/70">{vendor.specs}</p>
        <p className="text-xs font-medium mt-1">{vendor.priceRange}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {vendor.status === 'supported' && vendor.sdkAvailable && onPair && (
          <Button
            size="sm"
            variant="default"
            className="text-xs h-7 px-3"
            onClick={onPair}
          >
            <Bluetooth className="w-3 h-3 mr-1" />
            Pair
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7 px-3"
          onClick={handleShop}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Shop
        </Button>
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
  // Mark Meta as SDK-available if we detect Capacitor
  const vendors = GLASSES_VENDORS.map(v => ({
    ...v,
    sdkAvailable: v.id === 'meta_rayban' && typeof (window as any)?.Capacitor !== 'undefined',
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
            See what Oracle sees. Pair your glasses or shop compatible models.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 pb-6 overflow-y-auto max-h-[60vh]">
          {vendors.map((vendor) => (
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

          {/* Future-proof note */}
          <div className="text-center pt-3 pb-1">
            <p className="text-xs text-muted-foreground">
              More glasses coming soon. Have a pair you want supported?{' '}
              <button className="underline hover:text-foreground" onClick={() => {
                // Could open feedback modal or mailto
                window.open('mailto:glasses@tagnetiq.com?subject=Smart%20Glasses%20Request', '_blank');
              }}>
                Let us know
              </button>
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SmartGlassesShopSheet;