// FILE: src/components/AppShell.tsx

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import ThemeAnimationManager from './ThemeAnimationManager.js';
import SeasonalManager from './SeasonalManager.js';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { theme, themeMode } = useAppContext();
  const location = useLocation();
  
  // Track background image loading for smooth transitions
  const [bgLoaded, setBgLoaded] = useState(false);
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(null);

  // Theme-based background images
  const themeImageMap: { [key: string]: string } = {
    darkKnight: '/images/dark-knight-bg.jpg',
    executive: '/images/executive-bg.jpg',
    forest: '/images/forest-bg.jpg',
    sunset: '/images/sunset-bg.jpg',
    cyberpunk: '/images/cyberpunk-bg.jpg',
    safari: '/images/safari-bg.jpg',
    ocean: '/images/ocean-bg.jpg',
  };

  // Determine the background image URL with priority system
  const getBackgroundImageUrl = (): string => {
    const isHomePage = location.pathname === '/';
    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
    const isInvestorPage = location.pathname === '/investor' || location.pathname === '/admin/investors';

    // Priority 1: Page-specific backgrounds (always override for branding)
    if (isHomePage) {
      return '/images/welcome.jpg';
    }
    if (isAuthPage) {
      return '/images/auth-background.jpg';
    }
    if (isInvestorPage) {
      return '/images/investor-splash.jpg';
    }

    // Priority 2: User's custom background (logged-in users only)
    if (user && profile?.custom_background_url) {
      console.log('🖼️ [AppShell] Using custom background:', profile.custom_background_url);
      return profile.custom_background_url;
    }

    // Priority 3: Theme-based background
    const themeImage = themeImageMap[theme];
    if (themeImage) {
      console.log('🖼️ [AppShell] Using theme background:', theme);
      return themeImage;
    }

    // No background image
    return '';
  };

  const backgroundImageUrl = getBackgroundImageUrl();

  // Preload background image for smooth transitions
  useEffect(() => {
    if (!backgroundImageUrl) {
      setBgLoaded(true);
      setCurrentBgUrl(null);
      return;
    }

    // If same URL, no need to reload
    if (backgroundImageUrl === currentBgUrl) {
      return;
    }

    console.log('🖼️ [AppShell] Loading background:', backgroundImageUrl);
    setBgLoaded(false);

    const img = new Image();
    img.onload = () => {
      console.log('🖼️ [AppShell] ✅ Background loaded');
      setCurrentBgUrl(backgroundImageUrl);
      setBgLoaded(true);
    };
    img.onerror = () => {
      console.error('🖼️ [AppShell] ❌ Background failed to load:', backgroundImageUrl);
      setCurrentBgUrl(null);
      setBgLoaded(true);
    };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl, currentBgUrl]);

  // Debug: Log when custom background changes
  useEffect(() => {
    console.log('🖼️ [AppShell] Profile updated:', {
      hasUser: !!user,
      customBgUrl: profile?.custom_background_url || 'none',
    });
  }, [user, profile?.custom_background_url]);

  const getPageStyles = (): React.CSSProperties => {
    const themeConfig = getThemeConfig(theme, themeMode);
    
    const styles: React.CSSProperties = {
      minHeight: '100vh',
      backgroundColor: themeConfig.colors.background,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat',
      transition: 'background-color 0.5s ease, background-image 0.5s ease',
    };

    // Apply background image if loaded
    if (currentBgUrl && bgLoaded) {
      styles.backgroundImage = `url(${currentBgUrl})`;
    }
    
    return styles;
  };
 
  return (
    <div style={getPageStyles()}>
      {/* Overlay for better text readability on custom backgrounds */}
      {currentBgUrl && user && profile?.custom_background_url && (
        <div 
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundColor: themeMode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
            transition: 'background-color 0.5s ease',
          }}
        />
      )}
      
      <ThemeAnimationManager />
      <SeasonalManager />
      
      {/* Content with relative positioning to sit above overlay */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AppShell;
