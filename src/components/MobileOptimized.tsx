import React from 'react';
import { cn } from '@/lib/utils';

interface MobileOptimizedProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileOptimized: React.FC<MobileOptimizedProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "min-h-screen w-full",
      "safe-area-inset",
      "touch-manipulation",
      "select-none",
      "overscroll-none",
      className
    )}>
      {children}
    </div>
  );
};

export const MobileContainer: React.FC<MobileOptimizedProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "mx-auto max-w-sm px-4 py-2",
      "h-full flex flex-col",
      className
    )}>
      {children}
    </div>
  );
};

export const MobileButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}> = ({ children, onClick, className, variant = 'primary' }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full py-4 px-6 rounded-xl font-semibold text-lg",
        "active:scale-95 transition-transform duration-150",
        "touch-manipulation",
        variant === 'primary' 
          ? "bg-blue-600 text-white hover:bg-blue-700" 
          : "bg-gray-200 text-gray-800 hover:bg-gray-300",
        className
      )}
    >
      {children}
    </button>
  );
};