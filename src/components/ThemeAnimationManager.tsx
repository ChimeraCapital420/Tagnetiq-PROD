// src/components/ThemeAnimationManager.tsx
import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import DarkKnightBackground from './backgrounds/DarkKnightBackground.js';
import OceanBackground from './backgrounds/OceanBackground.js';
import ForestBackground from './backgrounds/ForestBackground.js';
import MatrixBackground from './backgrounds/MatrixBackground.js';

const ThemeAnimationManager: React.FC = () => {
  const { theme } = useAppContext();

  // Only render animations for specific themes
  switch (theme) {
    case 'darkKnight':
      return <DarkKnightBackground />;
    case 'ocean':
      return <OceanBackground />;
    case 'forest':
      return <ForestBackground />;
    case 'matrix':
      return <MatrixBackground />;
    default:
      // Return null for themes without special animations
      return null;
  }
};

export default ThemeAnimationManager;