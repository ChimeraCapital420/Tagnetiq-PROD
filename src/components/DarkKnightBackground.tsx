import React from 'react';

const DarkKnightBackground: React.FC = () => {
  // TODO: Add spotlight animation here if desired.
  return (
    <div 
      className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: 'url(/dark-knight-bg.jpg)' }}
      aria-hidden="true" 
    />
  );
};

export default DarkKnightBackground;