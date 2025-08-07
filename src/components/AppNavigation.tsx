import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Menu, X, MessageSquare } from 'lucide-react';
import { getThemeConfig } from '@/lib/themes';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AppNavigation: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const getContrastColor = () => {
    if (theme === 'matrix') return themeMode === 'dark' ? '#00ff41' : '#00cc33';
    if (theme === 'executive') return themeMode === 'dark' ? '#ff4444' : '#cc0000';
    if (theme === 'safari') return themeMode === 'dark' ? '#fbbf24' : '#d97706';
    if (theme === 'cyberpunk') return themeMode === 'dark' ? '#ff00ff' : '#cc00cc';
    return themeMode === 'dark' ? '#a855f7' : '#7c3aed';
  };

  const getNavStyles = () => {
    const baseClasses = "fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b";
    if (theme === 'matrix') return `${baseClasses} bg-black/95 border-green-500/30`;
    if (theme === 'executive') return `${baseClasses} bg-black/95 border-red-500/30`;
    if (theme === 'safari') return `${baseClasses} bg-amber-900/95 border-amber-600/30`;
    return `${baseClasses} bg-slate-900/95 border-purple-500/20`;
  };

  return (
    <nav className={getNavStyles()} style={{ fontFamily: themeConfig.fonts.body }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754416822115_6170c8bb.png"
              alt="Tagnetiq Q Logo" 
              className="w-10 h-10 object-contain"
            />
            <div 
              className="text-sm font-medium"
              style={{ 
                color: getContrastColor(),
                fontFamily: themeConfig.fonts.body
              }}
            >
              {user?.user_metadata?.screen_name || 'Set Screen Name'}
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Button
              onClick={() => navigate('/feedback')}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
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
                <DropdownMenuItem 
                  onClick={() => navigate('/settings')}
                  className="text-white hover:bg-purple-500/20"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-purple-500/30" />
                <DropdownMenuItem 
                  onClick={handleSignOut}
                  className="text-white hover:bg-purple-500/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            <Button
              onClick={() => {
                navigate('/feedback');
                setMobileMenuOpen(false);
              }}
              variant="outline"
              className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Feedback
            </Button>
            <Button
              onClick={() => {
                navigate('/settings');
                setMobileMenuOpen(false);
              }}
              variant="outline"
              className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default AppNavigation;