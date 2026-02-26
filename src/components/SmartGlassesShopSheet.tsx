// FILE: src/components/SmartGlassesShopSheet.tsx
// Bottom sheet for smart glasses — pair existing glasses OR shop for new ones
//
// ASYNC PAIR FLOW — sheet stays open during pairing:
//   1. User taps "Pair My Glasses" → card shows spinner
//   2. registerMetaGlasses() fires async → Meta AI deep-link opens
//   3. Success → card shows "Connected ✓" with "Unpair" option
//   4. Failure → card shows error with retry
//   5. Sheet stays open the entire time — user closes manually
//
// UNPAIR FLOW:
//   Connected card shows "Unpair" → calls forgetMetaGlasses()
//   → stops session, resets local state → card returns to "Pair My Glasses"
//
// Each brand card has TWO clear paths:
//   🔗 "Pair My Glasses" → owners with glasses → starts pairing
//   🛒 "Shop" → future buyers → affiliate link (commission opportunity)
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
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Bluetooth,
  Glasses,
  Sparkles,
  ShoppingCart,
  Smartphone,
  Loader2,
  Check,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MetaGlassesState } from './GlassesStatusIcon';

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
  affiliateUrl: string;
  status: GlassesVendorStatus;
  sdkAvailable: boolean;
  priceRange: string;
  hasCamera: boolean;
}

export interface SmartGlassesShopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Live glasses state from useBluetoothManager — drives card UI */
  metaGlasses?: MetaGlassesState;
  /** Async register function — returns true on success */
  onRegisterGlasses?: () => Promise<boolean>;
  /** Async forget/unpair function */
  onForgetGlasses?: () => Promise<void>;
}

// =============================================================================
// HELPERS
// =============================================================================

const isCapacitorApp = (): boolean =>
  typeof (window as any)?.Capacitor !== 'undefined';

const DEFAULT_GLASSES: MetaGlassesState = {
  pluginAvailable: false,
  isRegistered: false,
  isConnected: false,
  isSessionActive: false,
  cameraPermissionGranted: false,
  batteryLevel: null,
  deviceName: null,
  isLoading: false,
  error: null,
};

// =============================================================================
// VENDOR CATALOG
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
    sdkAvailable: false,
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
// VENDOR CARD — context-aware pair/unpair/shop
// =============================================================================

const VendorCard: React.FC<{
  vendor: GlassesVendor;
  isInApp: boolean;
  /** Is this specific vendor currently connected/registered? */
  isConnected: boolean;
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  onPair?: () => void;
  onUnpair?: () => void;
}> = ({ vendor, isInApp, isConnected, isRegistered, isLoading, error, onPair, onUnpair }) => {
  const handleShop = () => {
    window.open(vendor.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const canPair = vendor.status === 'supported';

  const handlePairClick = () => {
    if (!canPair) return;

    if (isInApp && onPair) {
      onPair();
    } else if (!isInApp) {
      toast.info(`Pair ${vendor.model} in the TagnetIQ app`, {
        description: 'Open TagnetIQ on your phone to connect your glasses',
      });
    }
  };

  // Determine left button state
  const getPairContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Connecting...
        </>
      );
    }

    if (isConnected || isRegistered) {
      return (
        <>
          <Check className="w-3.5 h-3.5 text-green-500" />
          Connected
        </>
      );
    }

    if (!canPair) {
      return (
        <>
          <Bluetooth className="w-3.5 h-3.5 opacity-40" />
          Coming Soon
        </>
      );
    }

    if (isInApp) {
      return (
        <>
          <Bluetooth className="w-3.5 h-3.5" />
          Pair My Glasses
        </>
      );
    }

    return (
      <>
        <Smartphone className="w-3.5 h-3.5" />
        Pair in App
      </>
    );
  };

  // Should the left button be clickable?
  const isPairClickable = canPair && !isLoading && !isConnected && !isRegistered;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Top row: brand info + status */}
      <div className="flex items-start gap-3 p-3 pb-2">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          isConnected || isRegistered ? 'bg-green-500/20' : canPair ? 'bg-blue-500/10' : 'bg-muted'
        }`}>
          <Glasses className={`w-5 h-5 ${
            isConnected || isRegistered ? 'text-green-500' : canPair ? 'text-blue-500' : 'text-muted-foreground'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium text-sm">{vendor.model}</span>
            <StatusBadge status={vendor.status} />
          </div>
          <p className="text-xs text-muted-foreground">{vendor.tagline}</p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{vendor.specs}</p>
          {/* Error message */}
          {error && (
            <p className="text-[11px] text-red-400 mt-1">{error}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <span className="text-sm font-semibold">{vendor.priceRange}</span>
        </div>
      </div>

      {/* Bottom row: Pair/Connected/Unpair | Shop */}
      <div className="flex border-t divide-x">
        {/* Left: Pair or Connected status */}
        {(isConnected || isRegistered) && onUnpair ? (
          // CONNECTED — show Unpair button
          <button
            onClick={onUnpair}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation"
          >
            <Unplug className="w-3.5 h-3.5" />
            Unpair
          </button>
        ) : (
          // NOT CONNECTED — show Pair button
          <button
            onClick={isPairClickable ? handlePairClick : undefined}
            disabled={!isPairClickable}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors touch-manipulation ${
              isPairClickable
                ? 'hover:bg-accent text-foreground'
                : isLoading
                  ? 'text-foreground'
                  : 'text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            {getPairContent()}
          </button>
        )}

        {/* Right: Shop — always works */}
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
  metaGlasses = DEFAULT_GLASSES,
  onRegisterGlasses,
  onForgetGlasses,
}) => {
  const isInApp = isCapacitorApp();

  const vendors = GLASSES_VENDORS.map(v => ({
    ...v,
    sdkAvailable: v.id === 'meta_rayban' && isInApp,
  }));

  // Determine Meta-specific state for the Meta card
  const isMetaConnected = metaGlasses.isConnected;
  const isMetaRegistered = metaGlasses.isRegistered;
  const isMetaLoading = metaGlasses.isLoading;
  const metaError = metaGlasses.error;

  const handlePairMeta = async () => {
    if (onRegisterGlasses) {
      await onRegisterGlasses();
      // Sheet stays open — user sees result in card
    }
  };

  const handleUnpairMeta = async () => {
    if (onForgetGlasses) {
      await onForgetGlasses();
      // Card reverts to "Pair My Glasses"
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
        <SheetHeader className="text-left pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Smart Glasses for TagnetIQ
          </SheetTitle>
          <SheetDescription>
            {isInApp
              ? 'Own a pair? Tap Pair to connect. Looking to buy? Tap Shop.'
              : 'Browse compatible smart glasses. Pair your glasses in the TagnetIQ mobile app.'
            }
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
                isInApp={isInApp}
                isConnected={vendor.id === 'meta_rayban' ? isMetaConnected : false}
                isRegistered={vendor.id === 'meta_rayban' ? isMetaRegistered : false}
                isLoading={vendor.id === 'meta_rayban' ? isMetaLoading : false}
                error={vendor.id === 'meta_rayban' ? metaError : null}
                onPair={vendor.id === 'meta_rayban' ? handlePairMeta : undefined}
                onUnpair={vendor.id === 'meta_rayban' ? handleUnpairMeta : undefined}
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
                    isInApp={isInApp}
                    isConnected={false}
                    isRegistered={false}
                    isLoading={false}
                    error={null}
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