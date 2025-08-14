import React from 'react';

const CyberpunkBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: 'url(/cyberpunk-bg.jpg)' }}
      aria-hidden="true" 
    />
  );
};

export default CyberpunkBackground;