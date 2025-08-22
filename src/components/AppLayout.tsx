// FILE: src/components/AppLayout.tsx (REPLACE THIS FILE)

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext'; // Import AppContext
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';
import DualScanner from './DualScanner'; // Import the Scanner

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isScanning, setIsScanning } = useAppContext(); // Get scanner state
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  
  const showAppNav = user && !isHomePage;
  const showMarketingNav = !user || isHomePage;
  
  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation />}
      {showMarketingNav && <NewMarketingNavigation />}
      
      {/* By placing the scanner here, it exists outside of any specific page's routes.
        It can now be triggered from anywhere in the app (like the Vault MFA screen)
        and will correctly display as an overlay.
      */}
      {user && <DualScanner isOpen={isScanning} onClose={() => setIsScanning(false)} />}

      <main className={showAppNav ? "pt-14" : ""}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
