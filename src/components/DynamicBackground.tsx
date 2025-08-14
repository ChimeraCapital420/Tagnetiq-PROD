import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';

const DynamicBackground = (): null => {
  const { user } = useAuth();
  const { theme, themeMode } = useAppContext();
  const location = useLocation();

  useEffect(() => {
    const themeConfig = getThemeConfig(theme, themeMode);
    const root = document.documentElement; // This is the <html> tag

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

    // Directly apply styles to the <html> element
    root.style.backgroundColor = themeConfig.colors.background;
    root.style.backgroundImage = imageUrl ? `url(${imageUrl})` : 'none';
    root.style.backgroundSize = 'cover';
    root.style.backgroundPosition = 'center';
    root.style.backgroundAttachment = 'fixed';
    root.style.transition = 'background-color 0.5s ease';

  }, [theme, themeMode, location, user]);

  return null; // This component renders nothing itself
};

export default DynamicBackground;