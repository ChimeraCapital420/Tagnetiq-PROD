// FILE: src/components/AppLayout.tsx
// Oracle Phase 1 — Cleaned up: removed dead imports, swapped JarvisVoiceInterface → OracleVoiceButton

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation.js';
import NewMarketingNavigation from './NewMarketingNavigation.js';
import DualScanner from './scanner';
import OracleVisualizer from './OracleVisualizer.js';
import OracleResponseDisplay from './OracleResponseDisplay.js';
import OracleVoiceButton from './oracle/OracleVoiceButton'; // REPLACES JarvisVoiceInterface
import DevicePairingModal from './DevicePairingModal.js';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const appContext = useAppContext();
  const location = useLocation();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;

  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation onOpenDevicePairing={() => setIsDevicePairingOpen(true)} />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      <DualScanner isOpen={appContext.isScannerOpen} onClose={() => appContext.setIsScannerOpen(false)} />
      
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
            <OracleVoiceButton />
          )}
        </>
      )}
    </div>
  );
};

export default AppLayout;