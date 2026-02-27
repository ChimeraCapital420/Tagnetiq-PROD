// FILE: src/components/SmartGlassesShopSheet.tsx
// Bottom sheet for smart glasses — pair existing glasses OR shop for new ones
//
// NO PRICES DISPLAYED — prices change frequently, we don't control them.
// Shop links go to vendor sites where the user sees current pricing.
//
// AFFILIATE TRACKING:
//   Every "Shop" click logs vendor ID + timestamp for attribution.
//   When affiliate accounts are live, append tracking params to affiliateUrl.
//
// FULL META CATALOG: All models use the same MWDAT SDK.
// ALL FEEDBACK INLINE — no toasts behind sheet z-index.
// Mobile-first: Sheet slides up, one-thumb reachable, touch-friendly targets
//
// v9 FIX: import { Capacitor } from '@capacitor/core' for isNativePlatform().
//   window.Capacitor global does NOT have isNativePlatform — only the ES module does.
//   v8 tried window.Capacitor.isNativePlatform which was undefined → always false.

import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
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
  Info,
  Monitor,
  Zap,
} from 'lucide-react';
import type { MetaGlassesState } from './GlassesStatusIcon';

// =============================================================================
// TYPES
// =============================================================================

export type GlassesVendorStatus = 'supported' | 'coming_soon' | 'beta';
export type GlassesBrand = 'meta' | 'oakley_meta' | 'xreal' | 'rayneo' | 'even';

export interface GlassesVendor {
  id: string;
  brand: GlassesBrand;
  name: string;
  model: string;
  tagline: string;
  specs: string;
  affiliateUrl: string;
  status: GlassesVendorStatus;
  hasCamera: boolean;
  hasDisplay: boolean;
  usesMwdatSdk: boolean;
  featured?: boolean;
}

export interface SmartGlassesShopSheetProps {
  isOpen: boolean;
  onClose: () => void;
  metaGlasses?: MetaGlassesState;
  onRegisterGlasses?: () => Promise<boolean>;
  onForgetGlasses?: () => Promise<void>;
}

// =============================================================================
// HELPERS
// =============================================================================

// v9 FIX: Use the ES module import — Capacitor.isNativePlatform()
// returns true ONLY inside the real APK shell, false in any browser.
const isCapacitorApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

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

/** Track affiliate click — future: POST to server for attribution */
function trackAffiliateClick(vendorId: string) {
  try {
    const clicks = JSON.parse(localStorage.getItem('tagnetiq_affiliate_clicks') || '[]');
    clicks.push({ vendorId, timestamp: new Date().toISOString() });
    localStorage.setItem('tagnetiq_affiliate_clicks', JSON.stringify(clicks.slice(-100)));

    // TODO: When affiliate tracking is live, POST to server:
    // fetch('/api/analytics/affiliate-click', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ vendorId, timestamp: Date.now() }),
    // });
  } catch {
    // Silent fail — never block the shop link
  }
}

// =============================================================================
// VENDOR CATALOG — no prices, just links
// =============================================================================

const GLASSES_VENDORS: GlassesVendor[] = [
  // ── Meta Ray-Ban Gen 2 (Latest) ───────────────────────────────
  {
    id: 'meta_gen2_wayfarer',
    brand: 'meta',
    name: 'Ray-Ban Meta',
    model: 'Wayfarer (Gen 2)',
    tagline: 'Latest gen — 3K camera, 8hr battery, Live AI',
    specs: '3K/12MP camera · 60fps · 8hr battery · Live AI · 27 color combos',
    affiliateUrl: 'https://www.meta.com/ai-glasses/ray-ban-meta/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
    featured: true,
  },
  {
    id: 'meta_gen2_headliner',
    brand: 'meta',
    name: 'Ray-Ban Meta',
    model: 'Headliner (Gen 2)',
    tagline: 'Round frame, same 3K camera + Live AI',
    specs: '3K/12MP camera · 60fps · 8hr battery · Live AI',
    affiliateUrl: 'https://www.meta.com/ai-glasses/ray-ban-meta/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },
  {
    id: 'meta_gen2_skyler',
    brand: 'meta',
    name: 'Ray-Ban Meta',
    model: 'Skyler (Gen 2)',
    tagline: 'Cat-eye frame, same 3K camera + Live AI',
    specs: '3K/12MP camera · 60fps · 8hr battery · Live AI',
    affiliateUrl: 'https://www.meta.com/ai-glasses/ray-ban-meta/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },

  // ── Meta Ray-Ban Display (AR) ─────────────────────────────────
  {
    id: 'meta_display',
    brand: 'meta',
    name: 'Meta Ray-Ban',
    model: 'Display',
    tagline: 'In-lens display — Oracle could show prices in your view',
    specs: '12MP camera · 600×600 in-lens display · Neural Band · 90Hz',
    affiliateUrl: 'https://www.meta.com/ai-glasses/meta-ray-ban-display/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: true,
    usesMwdatSdk: true,
    featured: true,
  },

  // ── Oakley Meta (Sport) ───────────────────────────────────────
  {
    id: 'oakley_hstn',
    brand: 'oakley_meta',
    name: 'Oakley Meta',
    model: 'HSTN',
    tagline: 'Sport-ready — built for outdoor hunts',
    specs: '12MP camera · Sport frame · Meta AI · Water resistant',
    affiliateUrl: 'https://www.meta.com/ai-glasses/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },
  {
    id: 'oakley_vanguard',
    brand: 'oakley_meta',
    name: 'Oakley Meta',
    model: 'Vanguard',
    tagline: 'Performance sport frame with Meta AI',
    specs: '12MP camera · Wraparound sport frame · Meta AI',
    affiliateUrl: 'https://www.meta.com/ai-glasses/',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },

  // ── Ray-Ban Meta Gen 1 (Budget / Entry) ───────────────────────
  {
    id: 'meta_gen1_wayfarer',
    brand: 'meta',
    name: 'Ray-Ban Meta',
    model: 'Wayfarer (Gen 1)',
    tagline: 'Best value entry — fully supported',
    specs: '12MP camera · 4hr battery · Meta AI · Bluetooth audio',
    affiliateUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },
  {
    id: 'meta_gen1_headliner',
    brand: 'meta',
    name: 'Ray-Ban Meta',
    model: 'Headliner (Gen 1)',
    tagline: 'Round frame classic — fully supported',
    specs: '12MP camera · 4hr battery · Meta AI · Bluetooth audio',
    affiliateUrl: 'https://www.ray-ban.com/usa/ray-ban-meta-smart-glasses',
    status: 'supported',
    hasCamera: true,
    hasDisplay: false,
    usesMwdatSdk: true,
  },

  // ── Other Brands (Coming Soon) ────────────────────────────────
  {
    id: 'xreal_air2',
    brand: 'xreal',
    name: 'XREAL',
    model: 'Air 2 Ultra',
    tagline: 'AR display shows prices right in your lens',
    specs: '8MP camera · USB-C direct connect · AR display',
    affiliateUrl: 'https://www.xreal.com/air2ultra',
    status: 'coming_soon',
    hasCamera: true,
    hasDisplay: true,
    usesMwdatSdk: false,
  },
  {
    id: 'rayneo_x2',
    brand: 'rayneo',
    name: 'RayNeo',
    model: 'X2',
    tagline: 'Full AR with see-through display + camera',
    specs: '12MP camera · Qualcomm XR2 · AR display',
    affiliateUrl: 'https://www.rayneo.com/products/rayneo-x2',
    status: 'coming_soon',
    hasCamera: true,
    hasDisplay: true,
    usesMwdatSdk: false,
  },
  {
    id: 'even_g1',
    brand: 'even',
    name: 'Even Realities',
    model: 'G1',
    tagline: 'Ultralight AI glasses — display only, no camera',
    specs: 'No camera · AI text display · 12hr battery · 35g',
    affiliateUrl: 'https://www.evenrealities.com',
    status: 'coming_soon',
    hasCamera: false,
    hasDisplay: true,
    usesMwdatSdk: false,
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
// VENDOR CARD — no prices, inline feedback, affiliate tracking
// =============================================================================

const VendorCard: React.FC<{
  vendor: GlassesVendor;
  isInApp: boolean;
  isConnected: boolean;
  isRegistered: boolean;
  isLoading: boolean;
  error: string | null;
  onPair?: () => Promise<boolean>;
  onUnpair?: () => void;
  compact?: boolean;
}> = ({ vendor, isInApp, isConnected, isRegistered, isLoading, error, onPair, onUnpair, compact }) => {
  const [showAppHint, setShowAppHint] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  const handleShop = () => {
    trackAffiliateClick(vendor.id);
    window.open(vendor.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const canPair = vendor.status === 'supported' && vendor.usesMwdatSdk;

  const handlePairClick = async () => {
    if (!canPair) return;

    if (isInApp && onPair) {
      // In APK — call native plugin, show spinner while waiting
      setLocalLoading(true);
      try {
        const success = await onPair();
        if (!success) {
          setShowAppHint(true);
          setTimeout(() => setShowAppHint(false), 6000);
        }
      } catch {
        setShowAppHint(true);
        setTimeout(() => setShowAppHint(false), 6000);
      } finally {
        setLocalLoading(false);
      }
    } else {
      // In browser — show "use the app" message inline on card
      setShowAppHint(true);
      setTimeout(() => setShowAppHint(false), 6000);
    }
  };

  const showSpinner = isLoading || localLoading;

  const getPairContent = () => {
    if (showSpinner) {
      return (<><Loader2 className="w-3.5 h-3.5 animate-spin" />Connecting...</>);
    }
    if (isConnected || isRegistered) {
      return (<><Check className="w-3.5 h-3.5 text-green-500" />Connected</>);
    }
    if (!canPair) {
      return (<><Bluetooth className="w-3.5 h-3.5 opacity-40" />Coming Soon</>);
    }
    if (isInApp) {
      return (<><Bluetooth className="w-3.5 h-3.5" />Pair My Glasses</>);
    }
    return (<><Smartphone className="w-3.5 h-3.5" />Pair in App</>);
  };

  const isPairClickable = canPair && !showSpinner && !isConnected && !isRegistered;

  return (
    <div className={`rounded-lg border bg-card overflow-hidden ${vendor.featured ? 'ring-1 ring-green-500/30' : ''}`}>
      <div className={`flex items-start gap-3 ${compact ? 'p-2.5 pb-1.5' : 'p-3 pb-2'}`}>
        <div className={`flex-shrink-0 ${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center ${
          isConnected || isRegistered ? 'bg-green-500/20' : canPair ? 'bg-blue-500/10' : 'bg-muted'
        }`}>
          {vendor.hasDisplay ? (
            <Monitor className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${
              isConnected || isRegistered ? 'text-green-500' : canPair ? 'text-blue-500' : 'text-muted-foreground'
            }`} />
          ) : (
            <Glasses className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} ${
              isConnected || isRegistered ? 'text-green-500' : canPair ? 'text-blue-500' : 'text-muted-foreground'
            }`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-medium ${compact ? 'text-xs' : 'text-sm'}`}>{vendor.model}</span>
            {vendor.featured && <Zap className="w-3 h-3 text-yellow-500" />}
            {!compact && <StatusBadge status={vendor.status} />}
          </div>
          <p className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}>{vendor.tagline}</p>
          {!compact && (
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{vendor.specs}</p>
          )}
          {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}

          {showAppHint && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-300">
                {isInApp
                  ? 'Registration requires the Meta AI app. Make sure your glasses are powered on and nearby, then try again.'
                  : 'Pairing requires the TagnetIQ mobile app. Open TagnetIQ on your Android phone to connect your glasses.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex border-t divide-x">
        {(isConnected || isRegistered) && onUnpair ? (
          <button
            onClick={onUnpair}
            disabled={showSpinner}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors touch-manipulation"
          >
            <Unplug className="w-3.5 h-3.5" />Unpair
          </button>
        ) : (
          <button
            onClick={isPairClickable ? handlePairClick : undefined}
            disabled={!isPairClickable}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors touch-manipulation ${
              isPairClickable
                ? 'hover:bg-accent text-foreground active:bg-accent/80'
                : showSpinner ? 'text-foreground' : 'text-muted-foreground/40 cursor-not-allowed'
            }`}
          >
            {getPairContent()}
          </button>
        )}

        <button
          onClick={handleShop}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium hover:bg-accent text-foreground active:bg-accent/80 transition-colors touch-manipulation"
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
// SECTION HEADER
// =============================================================================

const SectionHeader: React.FC<{ title: string; subtitle?: string; supported?: boolean }> = ({
  title, subtitle, supported,
}) => (
  <div className="flex items-center justify-between pt-3 pb-1 px-1">
    <div>
      <p className="text-xs font-semibold">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
    {supported && <Badge className="bg-green-600/80 text-white text-[10px]">All Supported</Badge>}
  </div>
);

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

  const isMetaConnected = metaGlasses.isConnected;
  const isMetaRegistered = metaGlasses.isRegistered;
  const isMetaLoading = metaGlasses.isLoading;
  const metaError = metaGlasses.error;

  const handlePairMeta = async (): Promise<boolean> => {
    if (onRegisterGlasses) return await onRegisterGlasses();
    return false;
  };

  const handleUnpairMeta = async () => {
    if (onForgetGlasses) await onForgetGlasses();
  };

  const metaFeatured = GLASSES_VENDORS.filter(v => v.usesMwdatSdk && v.featured);
  const metaGen2 = GLASSES_VENDORS.filter(v => v.brand === 'meta' && v.id.includes('gen2') && !v.featured);
  const oakley = GLASSES_VENDORS.filter(v => v.brand === 'oakley_meta');
  const metaGen1 = GLASSES_VENDORS.filter(v => v.brand === 'meta' && v.id.includes('gen1'));
  const otherBrands = GLASSES_VENDORS.filter(v => !v.usesMwdatSdk);

  const renderMetaCard = (vendor: GlassesVendor, compact = false) => (
    <VendorCard
      key={vendor.id}
      vendor={vendor}
      isInApp={isInApp}
      isConnected={isMetaConnected}
      isRegistered={isMetaRegistered}
      isLoading={isMetaLoading}
      error={metaError}
      onPair={handlePairMeta}
      onUnpair={handleUnpairMeta}
      compact={compact}
    />
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            Smart Glasses for TagnetIQ
          </SheetTitle>
          <SheetDescription>
            {isInApp
              ? 'Own a pair? Tap Pair to connect. Looking to buy? Tap Shop.'
              : 'Browse compatible smart glasses. Pair in the TagnetIQ mobile app.'
            }
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5 pb-6 overflow-y-auto max-h-[60vh]">

          <SectionHeader title="Recommended for TagnetIQ" subtitle="Best for Hunt Mode" supported />
          {metaFeatured.map(v => renderMetaCard(v))}

          {metaGen2.length > 0 && (
            <>
              <SectionHeader title="Ray-Ban Meta Gen 2" subtitle="Same specs, different frame styles" />
              {metaGen2.map(v => renderMetaCard(v, true))}
            </>
          )}

          {oakley.length > 0 && (
            <>
              <SectionHeader title="Oakley Meta" subtitle="Sport frames — estate sales, flea markets, outdoors" />
              {oakley.map(v => renderMetaCard(v, true))}
            </>
          )}

          {metaGen1.length > 0 && (
            <>
              <SectionHeader title="Ray-Ban Meta Gen 1" subtitle="Best value — fully supported" />
              {metaGen1.map(v => renderMetaCard(v, true))}
            </>
          )}

          {otherBrands.length > 0 && (
            <>
              <SectionHeader title="Other Brands" subtitle="Coming soon to TagnetIQ" />
              {otherBrands.map(vendor => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  isInApp={isInApp}
                  isConnected={false}
                  isRegistered={false}
                  isLoading={false}
                  error={null}
                  compact
                />
              ))}
            </>
          )}

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