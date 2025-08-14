import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useBeta } from '@/contexts/BetaContext'; // Assuming flags are in BetaContext

const WatermarkOverlay: React.FC = () => {
  const { isWatermarkVisible } = useAppContext(); // Using AppContext for visibility toggle
  
  if (!isWatermarkVisible) {
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