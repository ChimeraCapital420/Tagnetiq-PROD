// FILE: src/components/BackgroundManager.tsx

import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';

// --- START: Self-Contained Seasonal & Animated Components ---

const SeasonalCSS = () => (
  <style>{`
    .particles-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
    .particle { position: absolute; top: -20px; animation: fall 10s linear infinite; }
    @keyframes fall { to { transform: translateY(105vh); } }
    .snow { background: white; border-radius: 50%; width: 5px; height: 5px; opacity: 0.7; }
    .flower, .leaf { font-size: 20px; opacity: 0.8; }
    .particle:nth-child(10n) { animation-duration: 12s; }
    .particle:nth-child(10n+1) { left: 10%; animation-delay: 1s; }
    .particle:nth-child(10n+2) { left: 20%; animation-delay: 3s; }
    .particle:nth-child(10n+3) { left: 30%; animation-delay: 5s; }
    .particle:nth-child(10n+4) { left: 40%; animation-delay: 2s; animation-duration: 8s; }
    .particle:nth-child(10n+5) { left: 50%; animation-delay: 8s; }
    .particle:nth-child(10n+6) { left: 60%; animation-delay: 9s; }
    .particle:nth-child(10n+7) { left: 70%; animation-delay: 6s; }
    .particle:nth-child(10n+8) { left: 80%; animation-delay: 4s; animation-duration: 15s; }
    .particle:nth-child(10n+9) { left: 90%; animation-delay: 7s; }
    .sun-rays-overlay { position: fixed; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(255, 235, 59, 0.2) 0%, rgba(255, 235, 59, 0) 60%); animation: spin 60s linear infinite; z-index: 0; pointer-events: none; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `}</style>
);

const WinterOverlay = () => <div className="particles-overlay">{[...Array(50)].map((_, i) => <div key={i} className="particle snow"></div>)}</div>;
const SpringOverlay = () => <div className="particles-overlay">{[...Array(20)].map((_, i) => <div key={i} className="particle flower">🌸</div>)}</div>;
const SummerOverlay = () => <div className="sun-rays-overlay" />;
const FallOverlay = () => <div className="particles-overlay">{[...Array(20)].map((_, i) => <div key={i} className="particle leaf">🍂</div>)}</div>;

// --- END: Self-Contained Components ---

// PERFORMANCE: Blur-up placeholder for instant loading feel
const BlurUpImage: React.FC<{ src: string; alt?: string }> = ({ src, alt = '' }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setImageLoaded(false);
    setLoadError(false);
    
    console.log('🖼️ [BG-MGR] Loading background image:', src);

    // Create a tiny gradient placeholder based on the URL
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 20;
    canvas.height = 20;
    
    const gradient = ctx.createLinearGradient(0, 0, 20, 20);
    const hue = src.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
    gradient.addColorStop(0, `hsl(${hue}, 50%, 40%)`);
    gradient.addColorStop(1, `hsl(${hue}, 50%, 20%)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 20, 20);
    
    setImageSrc(canvas.toDataURL());

    // Load the actual image
    const img = new Image();
    img.onload = () => {
      console.log('🖼️ [BG-MGR] ✅ Background image loaded successfully');
      setImageSrc(src);
      setImageLoaded(true);
    };
    img.onerror = (e) => {
      console.error('🖼️ [BG-MGR] ❌ Background image failed to load:', src, e);
      setLoadError(true);
    };
    img.src = src;
  }, [src]);

  // Don't render if there was an error
  if (loadError) {
    console.warn('🖼️ [BG-MGR] Skipping render due to load error');
    return null;
  }

  return (
    <>
      {imageSrc && (
        <div
          className="fixed inset-0 z-[-2] bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${imageSrc})`,
            filter: imageLoaded ? 'none' : 'blur(40px)',
            transform: imageLoaded ? 'none' : 'scale(1.2)',
            transition: 'filter 0.8s ease-out, transform 0.8s ease-out',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
};

const BackgroundManager: React.FC = () => {
  const { theme, themeMode, seasonalMode } = useAppContext();
  const { profile } = useAuth();
  const themeConfig = getThemeConfig(theme, themeMode);

  // Debug: Log when profile changes
  useEffect(() => {
    console.log('🖼️ [BG-MGR] Profile updated:', {
      hasProfile: !!profile,
      customBgUrl: profile?.custom_background_url || 'none',
    });
  }, [profile?.custom_background_url]);

  // PERFORMANCE: Convert to WebP when available
  const staticThemeImageMap: { [key: string]: string } = {
    executive: '/images/executive-bg.webp',
    safari: '/images/safari-bg.webp',
    darkKnight: '/images/dark-knight-bg.webp',
    cyberpunk: '/images/cyberpunk-bg.webp',
    ocean: '/images/ocean-bg.webp',
    forest: '/images/forest-bg.webp',
    sunset: '/images/sunset-bg.webp',
  };

  // Fallback to JPG if WebP doesn't exist
  const getImageUrl = (themeName: string): string => {
    const webpUrl = staticThemeImageMap[themeName];
    if (webpUrl) return webpUrl;
    return `/images/${themeName}-bg.jpg`;
  };

  const renderSeasonalOverlay = () => {
    switch(seasonalMode) {
      case 'winter': return <WinterOverlay />;
      case 'spring': return <SpringOverlay />;
      case 'summer': return <SummerOverlay />;
      case 'fall': return <FallOverlay />;
      default: return null;
    }
  };
  
  const getBackgroundImageUrl = (): string | null => {
    // 1. HIGHEST PRIORITY: User's custom background URL
    if (profile?.custom_background_url) {
      console.log('🖼️ [BG-MGR] Using custom background:', profile.custom_background_url);
      return profile.custom_background_url;
    }
    
    // 2. Theme-based image (only if seasonal mode is off)
    if (seasonalMode === 'off' && staticThemeImageMap[theme]) {
      console.log('🖼️ [BG-MGR] Using theme background:', theme);
      return getImageUrl(theme);
    }
    
    // 3. No background image
    console.log('🖼️ [BG-MGR] No background image (seasonal mode or no theme image)');
    return null;
  };

  const backgroundImageUrl = getBackgroundImageUrl();
  
  const seasonalGradientMap = {
    winter: 'linear-gradient(to bottom, rgba(161, 196, 253, 0.5), rgba(194, 233, 251, 0.5))',
    spring: 'linear-gradient(to bottom, rgba(212, 252, 121, 0.4), rgba(150, 230, 161, 0.4))',
    summer: 'linear-gradient(to bottom, rgba(248, 54, 0, 0.3), rgba(249, 212, 35, 0.3))',
    fall:   'linear-gradient(to bottom, rgba(247, 151, 30, 0.4), rgba(255, 210, 0, 0.4))',
  };
  const seasonalGradient = seasonalMode !== 'off' ? seasonalGradientMap[seasonalMode] : undefined;

  return (
    <>
      <SeasonalCSS />
      
      {/* LAYER 1: Base color layer for instant load (z-[-3]) */}
      <div
        className="fixed inset-0 z-[-3] transition-colors duration-500"
        style={{
          backgroundColor: themeConfig.colors.background,
        }}
      />
      
      {/* LAYER 2: Background image with blur-up effect (z-[-2]) */}
      {backgroundImageUrl && (
        <BlurUpImage src={backgroundImageUrl} alt="Background" />
      )}
      
      {/* LAYER 3: Darkening overlay for readability (z-[-1]) */}
      {backgroundImageUrl && (
        <div
          className="fixed inset-0 z-[-1] bg-black/40 transition-opacity duration-500"
          style={{
            opacity: themeMode === 'dark' ? 0.5 : 0.3,
          }}
        />
      )}
      
      {/* LAYER 4: Seasonal gradient overlay (z-[-1]) */}
      {seasonalGradient && (
        <div 
          className="fixed inset-0 z-[-1]"
          style={{ backgroundImage: seasonalGradient }}
        />
      )}
      
      {/* LAYER 5: Seasonal particles (z-[0]) */}
      {renderSeasonalOverlay()}
    </>
  );
};

export default BackgroundManager;