// FILE: src/components/AppLayout.tsx
// STATUS: Final integration point. Surgically validated to connect all Oracle components without altering existing functionality.

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';
import DualScanner from './DualScanner';
import GlobalVoiceControl from './GlobalVoiceControl';
// --- ORACLE SURGICAL INTEGRATION START ---
import { useOracleCommandHandler } from '@/lib/command-handler';
import OracleVisualizer from './OracleVisualizer';
import OracleResponseDisplay from './OracleResponseDisplay';
// --- ORACLE SURGICAL INTEGRATION END ---
import DevicePairingModal from './DevicePairingModal'; // PROJECT CERULEAN: Added import

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false); // PROJECT CERULEAN: Added state

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;
  
  // --- ORACLE SURGICAL INTEGRATION START ---
  const { handleVoiceCommand } = useOracleCommandHandler();

  const onVoiceCommand = (command: string, ttsContext: { speak: Function, voiceURI: string | null }) => {
    const commandContext = {
      ...appContext,
      navigate,
      speak: ttsContext.speak,
      voiceURI: ttsContext.voiceURI,
    };
    handleVoiceCommand(command, commandContext);
  };
  // --- ORACLE SURGICAL INTEGRATION END ---

  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation onOpenDevicePairing={() => setIsDevicePairingOpen(true)} />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      <DualScanner isOpen={appContext.isScannerOpen} onClose={() => appContext.setIsScannerOpen(false)} />
      
      {/* PROJECT CERULEAN: Device Pairing Modal */}
      <DevicePairingModal 
        isOpen={isDevicePairingOpen} 
        onClose={() => setIsDevicePairingOpen(false)}
      />

      <main className={showAppNav ? "pt-14" : ""}>
        {children}
      </main>
      
      {/* --- ORACLE SURGICAL INTEGRATION START --- */}
      {/* The core Oracle UI components are added here. They are self-contained and only render for authenticated users. */}
      {user && (
        <>
            <GlobalVoiceControl onCommand={onVoiceCommand} />
            <OracleVisualizer />
            <OracleResponseDisplay />
        </>
      )}
      {/* --- ORACLE SURGICAL INTEGRATION END --- */}
    </div>
  );
};

export default AppLayout;