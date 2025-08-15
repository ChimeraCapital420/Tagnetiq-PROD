// src/components/ThemeAnimationManager.tsx
import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

// CORRECTED IMPORTS: All themes are imported from the '/backgrounds' subfolder.
import DarkKnightBackground from './backgrounds/DarkKnightBackground';
import OceanBackground from './backgrounds/OceanBackground';
import ForestBackground from './backgrounds/ForestBackground';
import MatrixBackground from './backgrounds/MatrixBackground';
import ExecutiveBackground from './backgrounds/ExecutiveBackground';
import SafariBackground from './backgrounds/SafariBackground';
import SunsetBackground from './backgrounds/SunsetBackground';
import CyberpunkBackground from './backgrounds/CyberpunkBackground';

const ThemeAnimationManager: React.FC = () => {
  const { theme } = useAppContext();

  switch (theme) {
    case 'darkKnight':
      return <DarkKnightBackground />;
    case 'ocean':
      return <OceanBackground />;
    case 'forest':
      return <ForestBackground />;
    case 'matrix':
      return <MatrixBackground />;
    case 'executive':
      return <ExecutiveBackground />;
    case 'safari':
      return <SafariBackground />;
    case 'sunset':
      return <SunsetBackground />;
    case 'cyberpunk':
      return <CyberpunkBackground />;
    default:
      return null;
  }
};

export default ThemeAnimationManager;