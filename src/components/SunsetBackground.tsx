import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const SunsetBackground: React.FC = () => {
  const { theme } = useAppContext();

  if (theme !== 'sunset') return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Desert sunset background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754111091136_22d8bea6.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center'
        }}
      />
      
      {/* Subtle overlay to ensure content readability */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
};

export default SunsetBackground;