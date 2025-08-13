// FILE: src/components/GlobalThemeBackground.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import MatrixBackground from './MatrixBackground';
import StaticImageBackground from './StaticImageBackground';
import DarkKnightBackground from './DarkKnightBackground';

const BACKGROUND_IMAGE_URLS = {
    executive: '/images/executivecityscape.jpg',
    safari: '/images/clean roof safari.jpg',
    cyberpunk: '/images/Gemini_Generated_Image_rc0n7jrc0n7jrc0n.jpg',
    ocean: '/images/love the reef and fi.jpg',
    forest: '/images/a mighty ponderosa o.jpg',
    sunset: '/images/desert with a moon r.jpg',
};

const GlobalThemeBackground: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const isDark = themeMode === 'dark';

  const renderThemeBackground = () => {
    switch (theme) {
      case 'matrix':
        return <MatrixBackground />;
      case 'darkKnight':
        return <DarkKnightBackground />;
      case 'executive':
      case 'safari':
      case 'cyberpunk':
      case 'ocean':
      case 'forest':
      case 'sunset':
        // @ts-ignore
        return <StaticImageBackground imageUrl={BACKGROUND_IMAGE_URLS[theme]} isDark={isDark} />;
      default:
        return <StaticImageBackground imageUrl={BACKGROUND_IMAGE_URLS['darkKnight']} isDark={isDark} />;
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full z-[-1]">
      {renderThemeBackground()}
    </div>
  );
};

export default GlobalThemeBackground;