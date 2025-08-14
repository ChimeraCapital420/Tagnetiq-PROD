import React from 'react';

export const MobileOptimized: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="overscroll-none">
      {children}
    </div>
  );
};