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
//   data-tour="wellness-tab"    → Wellness button (RH-042)
//
// v4.3: Wellness tab added — RH-001 + RH-002 + RH-042
//   Heart icon → /wellness (Kirtan Kriya, Solfeggio Tones, Healing Haptics)
//   Same pattern as all other nav tabs. Icon-only mobile, label desktop.

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SettingsDropdown from './SettingsDropdown.js';
import GlassesStatusIcon from './GlassesStatusIcon';
import { Button } from '@/components/ui/button';
import { Shield, Scan, Store, LayoutDashboard, Zap, Heart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import AlertsDropdown from '@/components/arena/AlertsDropdown';
import MessagesDropdown from '@/components/arena/MessagesDropdown';
import type { MetaGlassesState } from './GlassesStatusIcon';

interface ResponsiveNavigationProps {
  onOpenDevicePairing?: () => void;
  metaGlasses?: MetaGlassesState;
  onRegisterGlasses?: () => void;
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

  const isDashboardActive    = location.pathname === '/' || location.pathname.startsWith('/dashboard');
  const isOracleActive       = location.pathname.startsWith('/oracle');
  const isMarketplaceActive  = location.pathname.includes('/marketplace') || location.pathname.startsWith('/arena');
  const isVaultActive        = location.pathname.startsWith('/vault');
  // v4.3: Wellness active state
  const isWellnessActive     = location.pathname.startsWith('/wellness');

  const showGlassesInNav     = isDashboardActive;
  const showDashboardOnMobile = !isDashboardActive;

  const handleMarketClick = (e: React.MouseEvent) => {
    e.preventDefault();
    showArenaWelcome(() => navigate('/arena/marketplace'));
  };

  const handleHuntMode = () => navigate('/hunt');

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Desktop Logo */}
        <div className="mr-4 hidden md:flex">
          <Link to="/dashboard" className="mr-6 flex items-center space-x-2">
             <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-10 w-auto" />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-1 sm:space-x-2 md:justify-end">
          {/* Mobile Logo */}
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Link to="/dashboard" className="flex items-center md:hidden">
              <img src="/images/logo-main.jpg" alt="TagnetIQ Logo" className="h-8 sm:h-10 w-auto" />
            </Link>
          </div>

          {/* Navigation Buttons */}
          <nav className="flex items-center gap-0.5 sm:gap-1 md:gap-2">

            {/* Dashboard */}
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

            {/* Glasses Status */}
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

            {/* Scan — Primary action */}
            <Button
              onClick={() => setIsScannerOpen(true)}
              size="sm"
              className="touch-manipulation px-2 sm:px-3"
              data-tour="scanner-button"
            >
              <Scan className="h-4 w-4" />
              <span className="hidden sm:inline-block sm:ml-1">Scan</span>
            </Button>

            {/* Oracle */}
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

            {/* ─────────────────────────────────────────────────────────
                v4.3: Wellness — RH-001 + RH-002 + RH-042
                Kirtan Kriya, Solfeggio Tones, Healing Haptics.
                Heart icon. Icon-only on mobile, label on desktop.
                Pulse animation when active — subtle nod to the practice.
                ───────────────────────────────────────────────────────── */}
            <Button
              asChild
              variant={isWellnessActive ? 'secondary' : 'ghost'}
              size="sm"
              className="touch-manipulation px-2 sm:px-3"
              data-tour="wellness-tab"
            >
              <Link to="/wellness" className="flex items-center gap-1">
                <Heart
                  className={`h-4 w-4 ${
                    isWellnessActive
                      ? 'text-purple-400 fill-purple-400'
                      : 'text-muted-foreground'
                  }`}
                />
                <span className="hidden sm:inline-block">Wellness</span>
              </Link>
            </Button>

            {/* Messages dropdown */}
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