// src/components/AppLayout.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  
  // CORRECTED LOGIC: 
  // - Show the main app navigation (with settings) only when the user is logged in AND not on the homepage.
  const showAppNav = user && !isHomePage;
  // - Show the marketing navigation (no settings) if the user is NOT logged in, OR if they are on the homepage.
  const showMarketingNav = !user || isHomePage;
  
  return (
    <div className="relative z-10">
      {showAppNav && <ResponsiveNavigation />}
      {showMarketingNav && <NewMarketingNavigation />}
      <main className={showAppNav ? "pt-16" : ""}>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;