import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';

const themeImageMap: { [key: string]: string } = {
  darkKnight: '/dark-knight-bg.jpg',
  executive: '/executive-bg.jpg',
  forest: '/forest-bg.jpg',
  sunset: '/sunset-bg.jpg',
  cyberpunk: '/cyberpunk-bg.jpg',
  safari: '/safari-bg.jpg',
  ocean: '/ocean-bg.jpg',
};

const GlobalThemeBackground: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  let imageUrl = '';
  if (themeMode === 'dark') {
    imageUrl = themeImageMap[theme] || '';
  }

  const backgroundStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: -1, // Places it behind all content
    transition: 'opacity 0.5s ease-in-out',
    backgroundColor: themeConfig.colors.background,
    backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return <div style={backgroundStyle} />;
};

export default GlobalThemeBackground;