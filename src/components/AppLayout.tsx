import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';
import GlobalThemeBackground from './GlobalThemeBackground';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  const showAppNav = user;
  const showMarketingNav = !user && isHomePage;
  
  return (
    <>
      <GlobalThemeBackground />
      <div className="relative z-10 min-h-screen">
        {showAppNav && <ResponsiveNavigation />}
        {showMarketingNav && <NewMarketingNavigation />}
        <main className={showAppNav ? "pt-16" : ""}>
          {children}
        </main>
      </div>
    </>
  );
};

export default AppLayout;