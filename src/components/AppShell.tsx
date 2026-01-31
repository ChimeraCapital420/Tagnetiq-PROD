// FILE: src/components/AppShell.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import ThemeAnimationManager from './ThemeAnimationManager.js';
import SeasonalManager from './SeasonalManager.js';

// Detect iOS/iPadOS for background-attachment fix
const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const { theme, themeMode } = useAppContext();
  const location = useLocation();
  
  const [bgLoaded, setBgLoaded] = useState(false);
  const [currentBgUrl, setCurrentBgUrl] = useState<string | null>(null);
  const lastBgUrl = useRef<string | null>(null);

  // Theme-based background images
  const themeImageMap: Record<string, string> = {
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
    const path = location.pathname;
    
    // Priority 1: Page-specific backgrounds (branding)
    if (path === '/') return '/images/welcome.jpg';
    if (path === '/login' || path === '/signup') return '/images/auth-background.jpg';
    if (path === '/investor' || path === '/admin/investors') return '/images/investor-splash.jpg';

    // Priority 2: User's custom background
    if (user && profile?.custom_background_url) {
      return profile.custom_background_url;
    }

    // Priority 3: Theme-based background
    return themeImageMap[theme] || '';
  };

  const backgroundImageUrl = getBackgroundImageUrl();

  // Preload background image for smooth transitions
  useEffect(() => {
    if (!backgroundImageUrl) {
      setBgLoaded(true);
      setCurrentBgUrl(null);
      return;
    }

    // Skip if same URL already loaded
    if (backgroundImageUrl === currentBgUrl) {
      return;
    }

    lastBgUrl.current = backgroundImageUrl;
    setBgLoaded(false);

    const img = new Image();
    img.onload = () => {
      setCurrentBgUrl(backgroundImageUrl);
      setBgLoaded(true);
    };
    img.onerror = () => {
      setCurrentBgUrl(null);
      setBgLoaded(true);
    };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl, currentBgUrl]);

  const themeConfig = getThemeConfig(theme, themeMode);
  const hasCustomBg = user && profile?.custom_background_url;
  const showOverlay = currentBgUrl && hasCustomBg;

  return (
    <div 
      className="relative min-h-screen"
      style={{ backgroundColor: themeConfig.colors.background }}
    >
      {/* 
        Fixed background layer
        Uses a fixed div instead of background-attachment: fixed (broken on iOS Safari)
      */}
      {currentBgUrl && bgLoaded && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${currentBgUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            // GPU acceleration for iOS Safari
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
          }}
        />
      )}

      {/* Readability overlay for custom backgrounds */}
      {showOverlay && (
        <div 
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            backgroundColor: themeMode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
          }}
        />
      )}
      
      <ThemeAnimationManager />
      <SeasonalManager />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default AppShell;