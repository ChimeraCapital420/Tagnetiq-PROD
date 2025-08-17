// FILE: src/components/ResponsiveNavigation.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import SettingsDropdown from './SettingsDropdown';
import { Button } from '@/components/ui/button';
import { Shield, Scan } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ResponsiveNavigation: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isVaultActive = location.pathname.startsWith('/vault');

  // Only show navigation for authenticated users
  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link to="/dashboard" className="mr-6 flex items-center space-x-2">
             <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
          </Link>
        </div>
        
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
                 {/* Mobile view shows logo here */}
                <Link to="/dashboard" className="flex items-center md:hidden">
                    <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
                </Link>
            </div>
            <nav className="flex items-center gap-2">
                <Button asChild variant={!isVaultActive ? 'secondary' : 'ghost'} size="sm">
                    <Link to="/dashboard">
                    <Scan className="h-4 w-4" />
                    <span className="hidden sm:inline-block sm:ml-2">Scanner</span>
                    </Link>
                </Button>
                <Button asChild variant={isVaultActive ? 'secondary' : 'ghost'} size="sm">
                    <Link to="/vault">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline-block sm:ml-2">Vault</span>
                    </Link>
                </Button>
                <SettingsDropdown />
            </nav>
        </div>
      </div>
    </header>
  );
};

export default ResponsiveNavigation;
