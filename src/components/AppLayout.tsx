// FILE: src/components/AppLayout.tsx
// Oracle Phase 1 — Cleaned up: removed dead imports, swapped JarvisVoiceInterface → OracleVoiceButton
//
// Sprint E: data-tour="voice-settings" on OracleVoiceButton wrapper
// Sprint E+: useAnalytics for scanner open tracking

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation.js';
import NewMarketingNavigation from './NewMarketingNavigation.js';
import DualScanner from './scanner';
import OracleVisualizer from './OracleVisualizer.js';
import OracleResponseDisplay from './OracleResponseDisplay.js';
import OracleVoiceButton from './oracle/OracleVoiceButton';
import DevicePairingModal from './DevicePairingModal.js';
import { useAnalytics } from '@/hooks/useAnalytics';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const appContext = useAppContext();
  const location = useLocation();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);
  const { trackFeature } = useAnalytics();

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;

  const handleScannerClose = () => {
    appContext.setIsScannerOpen(false);
  };

  const handleScannerOpen = () => {
    trackFeature('scanner_open');
  };

  // Track scanner opens via context watcher
  React.useEffect(() => {
    if (appContext.isScannerOpen) {
      handleScannerOpen();
    }
  }, [appContext.isScannerOpen]);

  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation onOpenDevicePairing={() => setIsDevicePairingOpen(true)} />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      <DualScanner isOpen={appContext.isScannerOpen} onClose={handleScannerClose} />
      
      <DevicePairingModal 
        isOpen={isDevicePairingOpen} 
        onClose={() => setIsDevicePairingOpen(false)}
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