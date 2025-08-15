import React from 'react';
import { Link } from 'react-router-dom';
import SettingsDropdown from './SettingsDropdown';

const ResponsiveNavigation: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* CONFIRMED: This correctly links to the dashboard for verified members. */}
        <Link to="/dashboard" className="flex items-center">
          <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <SettingsDropdown />
        </div>
      </div>
    </header>
  );
};

export default ResponsiveNavigation;