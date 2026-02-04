// FILE: src/components/AppLayout.tsx (CORRECTED - Old GlobalVoiceControl removed, keeping new JarvisVoiceInterface)

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation.js';
import NewMarketingNavigation from './NewMarketingNavigation.js';
// UPDATED: Import from refactored scanner module
import DualScanner from './scanner';
// REMOVED OLD: import GlobalVoiceControl from './GlobalVoiceControl.js';
import { useOracleCommandHandler } from '@/lib/command-handler';
import OracleVisualizer from './OracleVisualizer.js';
import OracleResponseDisplay from './OracleResponseDisplay.js';
import JarvisVoiceInterface from './oracle/JarvisVoiceInterface.js'; // NEW - KEEPING THIS

import DevicePairingModal from './DevicePairingModal.js';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;
  
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
          {/* REMOVED OLD: <GlobalVoiceControl onCommand={onVoiceCommand} /> */}
          <OracleVisualizer />
          <OracleResponseDisplay />
          {/* NEW JARVIS VOICE INTERFACE - KEEPING THIS */}
          {profile?.settings?.tts_enabled && (
            <JarvisVoiceInterface />
          )}
        </>
      )}
    </div>
  );
};

export default AppLayout;