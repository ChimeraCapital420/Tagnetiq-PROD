import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getThemeConfig } from '@/lib/themes';
import { useAppContext } from '@/contexts/AppContext';

const MarketingNavigation: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const navigate = useNavigate();
  const themeConfig = getThemeConfig(theme, themeMode);

  const getNavStyles = () => {
    const baseClasses = "fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b";
    
    if (theme === 'matrix') {
      return `${baseClasses} bg-black/95 border-green-500/30`;
    }
    
    if (theme === 'executive') {
      return `${baseClasses} bg-black/95 border-red-500/30`;
    }
    
    if (theme === 'safari') {
      return `${baseClasses} bg-amber-900/95 border-amber-600/30`;
    }
    
    return `${baseClasses} bg-slate-900/95 border-purple-500/20`;
  };

  return (
    <nav className={getNavStyles()} style={{ fontFamily: themeConfig.fonts.body }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754080102285_791a628b.png" 
              alt="Tagnetiq Q Logo" 
              className="w-10 h-10 object-contain"
            />
          </div>

          {/* Login and Sign Up buttons */}
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              Login
            </Button>
            <Button
              onClick={() => navigate('/signup')}
              className="bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold px-6"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default MarketingNavigation;