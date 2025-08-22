import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SettingsDropdown from './SettingsDropdown';
import { Button } from '@/components/ui/button';
import { Shield, Scan, Sword } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import AlertsDropdown from '@/components/arena/AlertsDropdown';

const ResponsiveNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { setIsArenaWelcomeOpen, setIsScannerOpen } = useAppContext(); 
  const isVaultActive = location.pathname.startsWith('/vault');
  const isArenaActive = location.pathname.startsWith('/arena');
  const isDashboardActive = location.pathname.startsWith('/dashboard');

  const handleArenaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (profile && !profile.has_seen_arena_intro) {
        setIsArenaWelcomeOpen(true);
    } else {
        navigate('/arena/marketplace');
    }
  };

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
                <Link to="/dashboard" className="flex items-center md:hidden">
                    <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
                </Link>
            </div>
            <nav className="flex items-center gap-2">
                <Button asChild variant={isDashboardActive ? 'secondary' : 'ghost'} size="sm">
                    <Link to="/dashboard">
                    <span className="hidden sm:inline-block">Dashboard</span>
                    </Link>
                </Button>
                <Button onClick={() => setIsScannerOpen(true)} size="sm">
                    <Scan className="h-4 w-4" />
                    <span className="hidden sm:inline-block sm:ml-2">Scan</span>
                </Button>
                <Button asChild variant={isArenaActive ? 'secondary' : 'ghost'} size="sm">
                    <Link to="/arena/marketplace" onClick={handleArenaClick}>
                        <Sword className="h-4 w-4" />
                        <span className="hidden sm:inline-block sm:ml-2">Arena</span>
                    </Link>
                </Button>
                <Button asChild variant={isVaultActive ? 'secondary' : 'ghost'} size="sm">
                    <Link to="/vault">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline-block sm:ml-2">Vault</span>
                    </Link>
                </Button>
                <AlertsDropdown />
                <SettingsDropdown />
            </nav>
        </div>
      </div>
    </header>
  );
};

export default ResponsiveNavigation;