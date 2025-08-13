import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Mail, Sun, Moon, Bluetooth, Sparkles, User, LogOut } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';
import DeviceConnectionModal from './DeviceConnectionModal';
import CleanRoomModal from './CleanRoomModal';
import { useNavigate } from 'react-router-dom';
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

const Navigation: React.FC<NavigationProps> = ({ onDeviceConnect, onCleanRoom }) => {
  const { theme, themeMode, setTheme, setThemeMode, setIsScanning, lastAnalysisResult } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCleanRoomModal, setShowCleanRoomModal] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [hudMode, setHudMode] = useState(false);

  const themeConfig = getThemeConfig(theme, themeMode);

  const handleStartScanning = () => {
    setIsScanning(true);
  };

  const handleFeedback = () => {
    navigate('/feedback');
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
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src="https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754416822115_6170c8bb.png"
                alt="Tagnetiq Q Logo" 
                className="w-8 h-8 object-contain"
                style={{
                  filter: theme === 'matrix' ? 'hue-rotate(120deg)' : 
                         theme === 'executive' ? 'brightness(1.2) contrast(1.1)' : 'none'
                }}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
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
                <DropdownMenuItem 
                  onClick={() => navigate('/settings')}
                  className="text-white hover:bg-purple-500/20 flex items-center"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-purple-500/30">
                  <DropdownMenuItem 
                    onClick={() => navigate('/settings')}
                    className="text-white hover:bg-purple-500/20 flex items-center"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                >
                  Login
                </Button>
                <Button
                  onClick={() => navigate('/signup')}
                  className="bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold"
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <DeviceConnectionModal 
        isOpen={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        onConnect={setConnectedDevice}
      />
      <CleanRoomModal 
        isOpen={showCleanRoomModal}
        onClose={() => setShowCleanRoomModal(false)}
      />
    </nav>
  );
};

export default Navigation;