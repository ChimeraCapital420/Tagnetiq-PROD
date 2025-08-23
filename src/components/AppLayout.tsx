// FILE: src/components/AppLayout.tsx

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';
import DualScanner from './DualScanner';
import GlobalVoiceControl from './GlobalVoiceControl';
import { handleVoiceCommand } from '@/lib/command-handler';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const appContext = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;
  
  const onVoiceCommand = (command: string, ttsContext: { speak: Function, voiceURI: string | null }) => {
    // Prepare the full context for the command handler
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
      {showAppNav && <ResponsiveNavigation />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      <DualScanner isOpen={appContext.isScannerOpen} onClose={() => appContext.setIsScannerOpen(false)} />

      <main className={showAppNav ? "pt-14" : ""}>
        {children}
      </main>

      {user && <GlobalVoiceControl onCommand={onVoiceCommand} />}
    </div>
  );
};

export default AppLayout;