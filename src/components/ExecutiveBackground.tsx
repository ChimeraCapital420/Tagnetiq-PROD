import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const ExecutiveBackground: React.FC = () => {
  const { theme, themeMode } = useAppContext();

  if (theme !== 'executive') return null;

  const isDark = themeMode === 'dark';

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Executive cityscape background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754152518992_7755d3bf.png')`,
        }}
      />
      
      {/* Overlay for theme mode adjustment */}
      <div 
        className="absolute inset-0"
        style={{
          background: isDark 
            ? 'rgba(0, 0, 0, 0.3)' 
            : 'rgba(255, 255, 255, 0.1)'
        }}
      />
    </div>
  );
};

export default ExecutiveBackground;