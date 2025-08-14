import React from 'react';

const OceanBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: 'url(/ocean-bg.jpg)' }}
      aria-hidden="true" 
    />
  );
};

export default OceanBackground;