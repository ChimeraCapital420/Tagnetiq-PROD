import React from 'react';

const ExecutiveBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 z-[-1] bg-cover bg-center transition-all duration-500"
      style={{ backgroundImage: 'url(/images/executive-bg.jpg)' }}
      aria-hidden="true" 
    />
  );
};

export default ExecutiveBackground;