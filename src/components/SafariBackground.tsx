import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const SafariBackground: React.FC = () => {
  const { theme, themeMode } = useAppContext();

  if (theme !== 'safari') return null;

  const isDark = themeMode === 'dark';

  return (
    <div className="fixed inset-0 -z-10">
      {/* Safari background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754262779697_e428181b.png)',
          filter: isDark ? 'brightness(0.7) contrast(1.2)' : 'brightness(1) contrast(1)',
        }}
      />
      
      {/* Overlay for better text readability */}
      <div className={`absolute inset-0 ${isDark ? 'bg-black/30' : 'bg-black/10'}`} />
    </div>
  );
};

export default SafariBackground;