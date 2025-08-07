import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, Mail, Sun, Moon, Bluetooth, Sparkles, Menu, X } from 'lucide-react';
import { getThemeConfig } from '@/lib/themes';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import DeviceConnectionModal from './DeviceConnectionModal';
import CleanRoomModal from './CleanRoomModal';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';


interface NavigationProps {
  onDeviceConnect?: () => void;
  onCleanRoom?: () => void;
}

const ResponsiveNavigation: React.FC<NavigationProps> = ({ onDeviceConnect, onCleanRoom }) => {
  const { theme, themeMode, setTheme, setThemeMode, setIsScanning, lastAnalysisResult } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCleanRoomModal, setShowCleanRoomModal] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleStartScanning = () => {
    setIsScanning(true);
    setMobileMenuOpen(false);
  };

  const handleFeedback = () => {
    navigate('/feedback');
    setMobileMenuOpen(false);
  };

  const themes = [
    { id: 'safari', name: 'Safari Expedition' },
    { id: 'executive', name: 'Executive Dashboard' },
    { id: 'matrix', name: 'Matrix' },
    { id: 'darkKnight', name: 'Dark Knight' },
    { id: 'cyberpunk', name: 'Cyberpunk' },
    { id: 'ocean', name: 'Ocean' },
    { id: 'forest', name: 'Forest' },
    { id: 'sunset', name: 'Sunset' }
  ];

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as any);
  };

  const toggleThemeMode = () => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  };
  const getContrastColor = () => {
    if (theme === 'matrix') {
      return themeMode === 'dark' ? '#00ff41' : '#00cc33';
    }
    if (theme === 'executive') {
      return themeMode === 'dark' ? '#ff4444' : '#cc0000';
    }
    if (theme === 'safari') {
      return themeMode === 'dark' ? '#fbbf24' : '#d97706';
    }
    if (theme === 'cyberpunk') {
      return themeMode === 'dark' ? '#ff00ff' : '#cc00cc';
    }
    if (theme === 'darkKnight') {
      return themeMode === 'dark' ? '#fbbf24' : '#d97706';
    }
    if (theme === 'ocean') {
      return themeMode === 'dark' ? '#60a5fa' : '#2563eb';
    }
    if (theme === 'forest') {
      return themeMode === 'dark' ? '#34d399' : '#059669';
    }
    if (theme === 'sunset') {
      return themeMode === 'dark' ? '#fb7185' : '#e11d48';
    }
    return themeMode === 'dark' ? '#a855f7' : '#7c3aed';
  };

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
          <div className="flex items-center space-x-4">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754080102285_791a628b.png" 
              alt="Tagnetiq Q Logo" 
              className="w-10 h-10 object-contain"
            />
            {user && (
              <div 
                className="text-sm font-medium"
                style={{ 
                  color: getContrastColor(),
                  fontFamily: themeConfig.fonts.body
                }}
              >
                {user.user_metadata?.screen_name || user.email?.split('@')[0] || 'User'}
              </div>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {user && (
              <>
                <Button
                  onClick={handleFeedback}
                  variant="outline"
                  size="sm"
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Feedback
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-purple-500/30 w-56">
                    {themes.map((themeOption) => (
                      <DropdownMenuItem 
                        key={themeOption.id}
                        onClick={() => handleThemeChange(themeOption.id as any)}
                        className={`text-white hover:bg-purple-500/20 ${
                          theme === themeOption.id ? 'bg-purple-500/30' : ''
                        }`}
                      >
                        {themeOption.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-purple-500/30" />
                    <DropdownMenuItem 
                      onClick={toggleThemeMode}
                      className="text-white hover:bg-purple-500/20 flex items-center"
                    >
                      {themeMode === 'dark' ? (
                        <>
                          <Sun className="w-4 h-4 mr-2" />
                          Switch to Light Mode
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 mr-2" />
                          Switch to Dark Mode
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-purple-500/30" />
                    <DropdownMenuItem 
                      onClick={() => navigate('/settings')}
                      className="text-white hover:bg-purple-500/20 flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-purple-500/30" />
                    <DropdownMenuItem 
                      onClick={() => setShowDeviceModal(true)}
                      className="text-white hover:bg-purple-500/20 flex items-center"
                    >
                      <Bluetooth className="w-4 h-4 mr-2" />
                      Connect Smart Glasses
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowCleanRoomModal(true)}
                      className="text-white hover:bg-purple-500/20 flex items-center"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Clean Room Enhancement
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {user ? (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleStartScanning}
                  className="bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold px-6"
                >
                  Start Scanning
                </Button>
              </div>

            ) : (
              <>
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
              </>
            )}
          </div>
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-slate-900/95 backdrop-blur-sm border-b border-purple-500/20 p-4 space-y-3">
            {user ? (
              <Button
                onClick={handleStartScanning}
                className="w-full bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold"
              >
                Start Scanning
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    navigate('/login');
                    setMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  Login
                </Button>
                <Button
                  onClick={() => {
                    navigate('/signup');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold"
                >
                  Sign Up
                </Button>
              </>
            )}
            {user && (
              <>
                <Button
                  onClick={handleFeedback}
                  variant="outline"
                  className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Feedback
                </Button>

                <div className="border-t border-purple-500/20 pt-3 space-y-2">
                  <p className="text-purple-300 text-sm font-medium">Themes</p>
                  {themes.map((themeOption) => (
                    <Button
                      key={themeOption.id}
                      onClick={() => {
                        handleThemeChange(themeOption.id as any);
                        setMobileMenuOpen(false);
                      }}
                      variant="ghost"
                      className={`w-full justify-start text-white hover:bg-purple-500/20 ${
                        theme === themeOption.id ? 'bg-purple-500/30' : ''
                      }`}
                    >
                      {themeOption.name}
                    </Button>
                  ))}
                  
                  <Button
                    onClick={() => {
                      toggleThemeMode();
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-purple-500/20"
                  >
                    {themeMode === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 mr-2" />
                        Switch to Light Mode
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 mr-2" />
                        Switch to Dark Mode
                      </>
                    )}
                  </Button>
                </div>
                <div className="border-t border-purple-500/20 pt-3 space-y-2">
                  <Button
                    onClick={() => {
                      navigate('/settings');
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-purple-500/20"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>

                  <Button
                    onClick={() => {
                      setShowDeviceModal(true);
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-purple-500/20"
                  >
                    <Bluetooth className="w-4 h-4 mr-2" />
                    Connect Smart Glasses
                  </Button>
                  
                  <Button
                    onClick={() => {
                      setShowCleanRoomModal(true);
                      setMobileMenuOpen(false);
                    }}
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-purple-500/20"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Clean Room Enhancement
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <DeviceConnectionModal
        open={showDeviceModal}
        onOpenChange={setShowDeviceModal}
        onDeviceConnected={setConnectedDevice}
      />
      
      <CleanRoomModal
        open={showCleanRoomModal}
        onOpenChange={setShowCleanRoomModal}
        imageUrl={lastAnalysisResult ? 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png' : undefined}
      />
    </nav>
  );
};

export default ResponsiveNavigation;