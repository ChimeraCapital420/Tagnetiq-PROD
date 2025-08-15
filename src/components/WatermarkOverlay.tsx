import React from 'react';
import { useBeta } from '@/contexts/BetaContext'; // Corrected: Use useBeta context for feature flags

const WatermarkOverlay: React.FC = () => {
  const { flags } = useBeta(); // Corrected: Get flags from useBeta

  if (!flags.isWatermarkVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <div 
        className="absolute bottom-10 right-10 text-9xl font-bold text-white/5 opacity-50"
        style={{ transform: 'rotate(-15deg)' }}
      >
        TagnetIQ
      </div>
    </div>
  );
};

export default WatermarkOverlay;