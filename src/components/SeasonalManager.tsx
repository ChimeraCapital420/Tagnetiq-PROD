// src/components/SeasonalManager.tsx
import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { WinterOverlay, SpringOverlay, SummerOverlay, FallOverlay } from '@/components/seasonal';
import '@/components/seasonal/animations.css';

const SeasonalManager: React.FC = () => {
  const { seasonalMode } = useAppContext();

  switch (seasonalMode) {
    case 'winter':
      return <WinterOverlay />;
    case 'spring':
      return <SpringOverlay />;
    case 'summer':
      return <SummerOverlay />;
    case 'fall':
      return <FallOverlay />;
    default:
      return null;
  }
};

export default SeasonalManager;