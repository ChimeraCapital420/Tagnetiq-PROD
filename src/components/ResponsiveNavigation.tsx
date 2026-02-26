// FILE: src/components/ResponsiveNavigation.tsx
// Mobile-first responsive navigation with Oracle
// Oracle replaces Arena in primary nav — it's the AI brain users come back to daily
//
// Sprint F: Smart conditional nav
//   Mobile + ON dashboard  → Glasses icon (you're already home)
//   Mobile + OFF dashboard → Dashboard button (need to get back)
//   Desktop → Both Dashboard button + Glasses icon always visible
//   Gray glasses icon → SmartGlassesShopSheet (pair or shop)
//
// Sprint E: data-tour attributes added for guided tour targeting
//   data-tour="dashboard-tab"   → Dashboard button
//   data-tour="glasses-status"  → Glasses status icon
//   data-tour="scanner-button"  → Scan button (primary action)
//   data-tour="oracle-tab"      → Oracle button
//   data-tour="market-tab"      → Market button
//   data-tour="vault-tab"       → Vault button

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SettingsDropdown from './SettingsDropdown.js';
import GlassesStatusIcon from './GlassesStatusIcon';
import { Button } from '@/components/ui/button';
import { Shield, Scan, Store, LayoutDashboard, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import AlertsDropdown from '@/components/arena/AlertsDropdown';
import MessagesDropdown from '@/components/arena/MessagesDropdown';
import type { MetaGlassesState } from './GlassesStatusIcon';

interface ResponsiveNavigationProps {
  onOpenDevicePairing?: () => void;
  /** Meta glasses state from useBluetoothManager — drives glasses icon */
  metaGlasses?: MetaGlassesState;
  /** Called when user taps red glasses icon to register */
  onRegisterGlasses?: () => void;
  /** Called when user taps gray glasses icon — open shop sheet */
  onShopGlasses?: () => void;
}

const INITIAL_GLASSES_STATE: MetaGlassesState = {
  pluginAvailable: false,
  isRegistered: false,
  isConnected: false,
  isSessionActive: false,
  cameraPermissionGranted: false,
  batteryLevel: null,
  deviceName: null,
  isLoading: false,
  error: null,
};

const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  onOpenDevicePairing,
  metaGlasses = INITIAL_GLASSES_STATE,
  onRegisterGlasses,
  onShopGlasses,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showArenaWelcome, setIsScannerOpen } = useAppContext();

  // Determine active states based on current path
  const isDashboardActive = location.pathname === '/' || location.pathname.startsWith('/dashboard');
  const isOracleActive = location.pathname.startsWith('/oracle');
  const isMarketplaceActive = location.pathname.includes('/marketplace') || location.pathname.startsWith('/arena');
  const isVaultActive = location.pathname.startsWith('/vault');

  // Mobile nav logic:
  //   ON dashboard  → hide dashboard button, show glasses icon
  //   OFF dashboard → show dashboard button, hide glasses icon (glasses still in scanner toolbar)
  const showGlassesInNav = isDashboardActive;
  const showDashboardOnMobile = !isDashboardActive;

  const handleMarketClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showArenaWelcome(() => navigate('/arena/marketplace'));
  };

  const handleHuntMode = () => {
    navigate('/hunt');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Desktop Logo - hidden on mobile */}
        <div className="mr-4 hidden md:flex">
          <Link to="/dashboard" className="mr-6 flex items-center space-x-2">
             <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-1 sm:space-x-2 md:justify-end">
            {/* Mobile Logo — links to dashboard */}
            <div className="w-full flex-1 md:w-auto md:flex-none">
                <Link to="/dashboard" className="flex items-center md:hidden">
                    <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-8 sm:h-10 w-auto" />
                </Link>
            </div>

            {/* Navigation Buttons */}
            <nav className="flex items-center gap-0.5 sm:gap-1 md:gap-2">

                {/* Dashboard button:
                    Desktop: always visible
                    Mobile: visible on ALL screens EXCEPT dashboard */}
                <Button
                  asChild
                  variant={isDashboardActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={`touch-manipulation px-2 sm:px-3 ${
                    showDashboardOnMobile ? '' : 'hidden md:inline-flex'
                  }`}
                  data-tour="dashboard-tab"
                >
                    <Link to="/dashboard" className="flex items-center gap-1">
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="hidden sm:inline-block">Dashboard</span>
                    </Link>
                </Button>

                {/* Glasses Status Icon:
                    Desktop: always visible (next to dashboard)
                    Mobile: only on dashboard screen (replaces dashboard button slot) */}
                <div className={showGlassesInNav ? '' : 'hidden md:block'}>
                  <GlassesStatusIcon
                    metaGlasses={metaGlasses}
                    onRegister={onRegisterGlasses}
                    onHuntMode={handleHuntMode}
                    onShopGlasses={onShopGlasses}
                    variant="nav"
                    className="hover:bg-accent hover:text-accent-foreground"
                  />
                </div>

                {/* Scan — Primary action, always visible */}
                <Button
                  onClick={() => setIsScannerOpen(true)}
                  size="sm"
                  className="touch-manipulation px-2 sm:px-3"
                  data-tour="scanner-button"
                >
                    <Scan className="h-4 w-4" />
                    <span className="hidden sm:inline-block sm:ml-1">Scan</span>
                </Button>

                {/* Oracle — AI Assistant */}
                <Button
                  asChild
                  variant={isOracleActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="touch-manipulation px-2 sm:px-3"
                  data-tour="oracle-tab"
                >
                    <Link to="/oracle" className="flex items-center gap-1">
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline-block">Oracle</span>
                    </Link>
                </Button>

                {/* Market */}
                <Button
                  asChild
                  variant={isMarketplaceActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="touch-manipulation px-2 sm:px-3"
                  data-tour="market-tab"
                >
                    <Link to="/arena/marketplace" onClick={handleMarketClick} className="flex items-center gap-1">
                        <Store className="h-4 w-4" />
                        <span className="hidden sm:inline-block">Market</span>
                    </Link>
                </Button>

                {/* Vault */}
                <Button
                  asChild
                  variant={isVaultActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="touch-manipulation px-2 sm:px-3"
                  data-tour="vault-tab"
                >
                    <Link to="/vault" className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        <span className="hidden sm:inline-block">Vault</span>
                    </Link>
                </Button>

                {/* Messages dropdown with unread badge */}
                <MessagesDropdown />

                {/* Notifications */}
                <AlertsDropdown />

                {/* Settings */}
                <SettingsDropdown onOpenDevicePairing={onOpenDevicePairing} />
            </nav>
        </div>
      </div>
    </header>
  );
};

export default ResponsiveNavigation;