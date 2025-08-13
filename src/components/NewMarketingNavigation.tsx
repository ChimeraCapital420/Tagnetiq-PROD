import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NewMarketingNavigation: React.FC = () => {
  const navigate = useNavigate();
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-b border-purple-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="text-2xl font-bold text-white">
              <span className="text-purple-400">T</span>agnetiq
            </div>
          </div>
          
          {/* Auth Buttons */}
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-black"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => navigate('/signup')}
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NewMarketingNavigation;