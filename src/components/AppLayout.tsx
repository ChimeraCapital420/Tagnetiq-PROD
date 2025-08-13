// FILE: src/components/AppLayout.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ResponsiveNavigation from './ResponsiveNavigation';
import NewMarketingNavigation from './NewMarketingNavigation';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const showAppNav = user;
  const showMarketingNav = !user && (location.pathname === '/' || location.pathname === '/index.html');

  // This style ensures the layout itself is transparent, letting the background component show through.
  const layoutStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    minHeight: '100vh',
    position: 'relative',
    zIndex: 1,
  };

  return (
    <div style={layoutStyle}>
      {showAppNav && <ResponsiveNavigation />}
      {showMarketingNav && <NewMarketingNavigation />}
      <div className={showAppNav ? "pt-16" : ""}>
        {children}
      </div>
    </div>
  );
};

export default AppLayout;