// FILE: src/components/AppLayout.tsx
// STATUS: Final integration point. Surgically validated to connect all Oracle components without altering existing functionality.

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';
import DualScanner from './DualScanner';
import GlobalVoiceControl from './GlobalVoiceControl';
// --- ORACLE SURGICAL INTEGRATION ---
// The master command handler is imported.
import { useOracleCommandHandler } from '@/lib/command-handler';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;
  
  // --- ORACLE SURGICAL INTEGRATION ---
  // We instantiate the command handler hook here, in the highest relevant component,
  // so it has access to both navigation and the full application context.
  const { handleVoiceCommand } = useOracleCommandHandler();

  const onVoiceCommand = (command: string, ttsContext: { speak: Function, voiceURI: string | null }) => {
    // This function assembles the complete "context" object that the command handler needs to execute any possible action.
    // It combines the application state setters from useAppContext, the navigation function, and the TTS functions.
    const commandContext = {
      ...appContext,
      navigate,
      speak: ttsContext.speak,
      voiceURI: ttsContext.voiceURI,
    };
    // The command and the full context are passed to the handler for processing.
    handleVoiceCommand(command, commandContext);
  };

  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      <DualScanner isOpen={appContext.isScannerOpen} onClose={() => appContext.setIsScannerOpen(false)} />

      <main className={showAppNav ? "pt-14" : ""}>
        {children}
      </main>
      
      {/* --- ORACLE SURGICAL INTEGRATION --- */}
      {/* The GlobalVoiceControl is rendered here for authenticated users. */}
      {/* Its onCommand prop is connected to our master handler function. */}
      {/* This is a clean, additive placement that does not affect other components. */}
      {user && <GlobalVoiceControl onCommand={onVoiceCommand} />}
    </div>
  );
};

export default AppLayout;
