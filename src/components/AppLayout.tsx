import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  const showAppNav = user;
  const showMarketingNav = !user && isHomePage;
  
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