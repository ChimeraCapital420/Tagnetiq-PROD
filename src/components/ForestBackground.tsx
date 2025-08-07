import React from 'react';
import { useAppContext } from '@/contexts/AppContext';

const ForestBackground: React.FC = () => {
  const { theme } = useAppContext();

  if (theme !== 'forest') return null;

  return (
    <div className="fixed inset-0 z-0">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754138982946_222be3d8.png')`
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};

export default ForestBackground;