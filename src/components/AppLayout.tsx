// FILE: src/components/AppLayout.tsx
// Oracle Phase 1 — Cleaned up: removed dead imports, swapped JarvisVoiceInterface → OracleVoiceButton
//
// v4.0 FIX: REMOVED DualScanner — it was already rendered in App.tsx.
//   Having it in BOTH files mounted TWO instances → two camera streams → black screen.
//   DualScanner lives in App.tsx only. Do NOT re-add it here.
//
// Sprint E+: useAnalytics for scanner open tracking
// Sprint F: useBluetoothManager lifted here to wire metaGlasses → nav + shop sheet
// Sprint F: SmartGlassesShopSheet — async pair flow, sheet stays open during pairing
//
// v4.1 — OracleBar replaces OracleVoiceButton:
//   REMOVED: OracleVoiceButton (blue circle, always-on, no context awareness)
//   REMOVED: data-tour="voice-settings" wrapper (tied to OracleVoiceButton)
//   ADDED:   OracleBar — slim 52px persistent bar at bottom of every screen.
//            Context-aware chips, voice-first, hides only on /oracle.
//   CHANGED: <main> gets pb-[52px] when user is logged in so page content
//            is never hidden behind the bar.
//
// v4.2 — Trust Escalation: GuidedOverlay wired:
//   ADDED: GuidedOverlay — spotlight onboarding for Trust Level 1 users.
//          Renders after OracleBar. Self-hides at Level 2+. No props needed —
//          reads trustLevel from AppContext internally.

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation.js';
import NewMarketingNavigation from './NewMarketingNavigation.js';
import OracleVisualizer from './OracleVisualizer.js';
import OracleResponseDisplay from './OracleResponseDisplay.js';
import OracleBar from './OracleBar';
import GuidedOverlay from './onboarding/GuidedOverlay'; // v4.2
import DevicePairingModal from './DevicePairingModal.js';
import SmartGlassesShopSheet from './SmartGlassesShopSheet';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import { useAnalytics } from '@/hooks/useAnalytics';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const appContext = useAppContext();
  const location = useLocation();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const [isGlassesShopOpen, setIsGlassesShopOpen] = useState(false);
  const { trackFeature } = useAnalytics();

  // Lifted here so metaGlasses state flows to nav bar + shop sheet
  const bluetooth = useBluetoothManager();

  const isHomePage = location.pathname === '/';
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;

  // Track scanner opens via context watcher
  React.useEffect(() => {
    if (appContext.isScannerOpen) {
      trackFeature('scanner_open');
    }
  }, [appContext.isScannerOpen]);

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

      <SmartGlassesShopSheet
        isOpen={isGlassesShopOpen}
        onClose={() => setIsGlassesShopOpen(false)}
        metaGlasses={bluetooth.metaGlasses}
        onRegisterGlasses={bluetooth.registerMetaGlasses}
        onForgetGlasses={bluetooth.forgetMetaGlasses}
      />

      {/* pb-[52px] when logged in — OracleBar is 52px fixed at bottom.
          Without this, the bar covers the last ~52px of every page. */}
      <main className={[
        showAppNav ? 'pt-14' : '',
        user ? 'pb-[52px]' : '',
      ].filter(Boolean).join(' ')}>
        {children}
      </main>

      {/* Oracle UI — only for authenticated users */}
      {user && (
        <>
          <OracleVisualizer />
          <OracleResponseDisplay />
          {/* OracleBar replaces OracleVoiceButton.
              Slim persistent bar. Always available. Never intrusive.
              Self-hides on /oracle. Voice-first with permission gate. */}
          <OracleBar />
          {/* v4.2: GuidedOverlay — Trust Level 1 spotlight onboarding.
              Reads trustLevel from AppContext. Self-hides at Level 2+.
              No props needed. Zero impact on Level 3+ users. */}
          <GuidedOverlay />
        </>
      )}
    </div>
  );
};

export default AppLayout;