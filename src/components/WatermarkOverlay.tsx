// FILE: src/components/WatermarkOverlay.tsx (NEW FILE)
import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const WATERMARK_LOGO_URL = '/images/Big Q tm.jpg';

export const WatermarkOverlay: React.FC = () => {
    const { isWatermarkVisible } = useAppContext();

    if (!isWatermarkVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 pointer-events-none transition-opacity duration-500">
            <img 
                src={WATERMARK_LOGO_URL} 
                alt="TagnetIQ Watermark" 
                className="w-12 h-12 opacity-20"
            />
        </div>
    );
};