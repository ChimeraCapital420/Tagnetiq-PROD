import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import MatrixBackground from './MatrixBackground';
import ExecutiveBackground from './ExecutiveBackground';
import SafariBackground from './SafariBackground';
import DarkKnightBackground from './DarkKnightBackground';
import CyberpunkBackground from './CyberpunkBackground';
import OceanBackground from './OceanBackground';
import SunsetBackground from './SunsetBackground';
import ForestBackground from './ForestBackground';

const GlobalThemeBackground: React.FC = () => {
  const { theme, themeMode } = useAppContext();

  const renderBackground = () => {
    switch (theme) {
      case 'matrix':
        return <MatrixBackground />;
      case 'executive':
        return <ExecutiveBackground />;
      case 'safari':
        return <SafariBackground />;
      case 'darkKnight':
        return <DarkKnightBackground />;
      case 'cyberpunk':
        return <CyberpunkBackground />;
      case 'ocean':
        return <OceanBackground />;
      case 'sunset':
        return <SunsetBackground />;
      case 'forest':
        return <ForestBackground />;
      default:
        return <ExecutiveBackground />;
    }
  };

  return renderBackground();
};

export default GlobalThemeBackground;