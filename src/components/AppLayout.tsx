// FILE: src/components/AppLayout.tsx
// Oracle Phase 1 — Cleaned up: removed dead imports, swapped JarvisVoiceInterface → OracleVoiceButton
//
// v4.0 FIX: REMOVED DualScanner — it was already rendered in App.tsx.
//   Having it in BOTH files mounted TWO instances → two camera streams → black screen.
//   DualScanner lives in App.tsx only. Do NOT re-add it here.
//
// Sprint E: data-tour="voice-settings" on OracleVoiceButton wrapper
// Sprint E+: useAnalytics for scanner open tracking
// Sprint F: useBluetoothManager lifted here to wire metaGlasses → nav glasses icon
// Sprint F: SmartGlassesShopSheet — affiliate-ready brand discovery sheet

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation.js';
import NewMarketingNavigation from './NewMarketingNavigation.js';
import OracleVisualizer from './OracleVisualizer.js';
import OracleResponseDisplay from './OracleResponseDisplay.js';
import OracleVoiceButton from './oracle/OracleVoiceButton';
import DevicePairingModal from './DevicePairingModal.js';
import SmartGlassesShopSheet from './SmartGlassesShopSheet';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { useAnalytics } from '@/hooks/useAnalytics';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const appContext = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [isGlassesShopOpen, setIsGlassesShopOpen] = useState(false);
  const { trackFeature } = useAnalytics();

  // Lifted here so metaGlasses state flows to nav bar + scanner via props
  const bluetooth = useBluetoothManager();

  const isHomePage = location.pathname === '/';
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;

  const handleScannerOpen = () => {
    trackFeature('scanner_open');
  };

  // Track scanner opens via context watcher
  React.useEffect(() => {
    if (appContext.isScannerOpen) {
      handleScannerOpen();
    }
  }, [appContext.isScannerOpen]);

  // Handle "Pair" button from shop sheet — starts registration for that brand
  const handlePairBrand = (vendorId: string) => {
    setIsGlassesShopOpen(false);
    if (vendorId === 'meta_rayban') {
      // Trigger Meta registration flow
      bluetooth.registerMetaGlasses();
    }
    // Future: other brand registration flows
  };

  return (
    <div className="relative z-10">
      {showAppNav && (
        <ResponsiveNavigation
          onOpenDevicePairing={() => setIsDevicePairingOpen(true)}
          metaGlasses={bluetooth.metaGlasses}
          onRegisterGlasses={bluetooth.registerMetaGlasses}
          onShopGlasses={() => setIsGlassesShopOpen(true)}
        />
      )}
      {showMarketingNav && <NewMarketingNavigation />}

      {/* DualScanner intentionally NOT here — rendered in App.tsx AppContent */}

      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
      />

      {/* Smart Glasses Shop Sheet — affiliate links + pair options */}
      <SmartGlassesShopSheet
        isOpen={isGlassesShopOpen}
        onClose={() => setIsGlassesShopOpen(false)}
        onPairBrand={handlePairBrand}
      />

      <main className={showAppNav ? "pt-14" : ""}>
        {children}
      </main>

      {/* Oracle UI Components */}
      {user && (
        <>
          <OracleVisualizer />
          <OracleResponseDisplay />
          {profile?.settings?.tts_enabled && (
            <div data-tour="voice-settings">
              <OracleVoiceButton />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AppLayout;