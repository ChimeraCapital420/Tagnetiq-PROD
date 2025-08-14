import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { theme, themeMode } = useAppContext();
  const location = useLocation();

  const getPageStyles = (): React.CSSProperties => {
    const themeConfig = getThemeConfig(theme, themeMode);
    const styles: React.CSSProperties = {
      minHeight: '100vh',
      backgroundColor: themeConfig.colors.background,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      transition: 'background-color 0.5s ease',
    };

    const themeImageMap: { [key: string]: string } = {
      darkKnight: '/dark-knight-bg.jpg',
      executive: '/executive-bg.jpg',
      forest: '/forest-bg.jpg',
      sunset: '/sunset-bg.jpg',
      cyberpunk: '/cyberpunk-bg.jpg',
      safari: '/safari-bg.jpg',
      ocean: '/ocean-bg.jpg',
    };
    
    let imageUrl = '';
    const isHomePage = location.pathname === '/';
    const isAuthPage = !user && (location.pathname === '/login' || location.pathname === '/signup');
    const isInvestorPage = location.pathname === '/investor' || location.pathname === '/admin/investors';

    if (isHomePage) {
        imageUrl = '/welcome-artwork.jpg';
    } else if (isAuthPage) {
        imageUrl = '/auth-background.jpg';
    } else if (isInvestorPage) {
        imageUrl = '/investor-splash.jpg';
    } else if (themeMode === 'dark') {
        imageUrl = themeImageMap[theme] || '';
    }
    
    if (imageUrl) {
      styles.backgroundImage = `url(${imageUrl})`;
    }
    
    return styles;
  };
  
  return (
    <div style={getPageStyles()}>
      {children}
    </div>
  );
};

export default AppShell;