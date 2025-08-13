// FILE: src/components/StaticImageBackground.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';

interface StaticImageBackgroundProps {
  imageUrl: string;
  isDark: boolean;
}

const StaticImageBackground: React.FC<StaticImageBackgroundProps> = ({ imageUrl, isDark }) => {
  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)' }}
      />
    </>
  );
};

export default StaticImageBackground;