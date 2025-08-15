import React from 'react';

const CyberpunkBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-[-1] bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: 'url(/images/cyberpunk-bg.jpg)' }}
      aria-hidden="true" 
    />
  );
};

export default CyberpunkBackground;