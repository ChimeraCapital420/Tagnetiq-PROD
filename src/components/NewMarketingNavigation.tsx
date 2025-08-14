import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const NewMarketingNavigation: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="TagnetIQ Logo" className="h-8 w-8 rounded-full" />
          <span className="text-lg font-bold">TagnetIQ</span>
        </div>
        <div className="flex items-center gap-4">
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default NewMarketingNavigation;