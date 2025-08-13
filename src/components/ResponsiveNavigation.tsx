// FILE: src/components/ResponsiveNavigation.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, MessageSquare, BarChart3, ShieldCheck, Sun, Moon, Palette, PictureInPicture } from 'lucide-react';
import { getThemeConfig, themes } from '@/lib/themes';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal
} from '@/components/ui/dropdown-menu';

const ResponsiveNavigation: React.FC = () => {
  const { theme, themeMode, setTheme, setThemeMode, isWatermarkVisible, toggleWatermark } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const themeConfig = getThemeConfig(theme, themeMode);

  // Use the email from our developer shortcut to determine admin status
  const isAdmin = user?.email === 'admin@tagnetiq.com';

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };
  
  return (
    <nav style={{ backgroundColor: `${themeConfig.colors.surface}B3`, borderColor: themeConfig.colors.border }} className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <img src="/images/Big Q logo.jpg" alt="Tagnetiq Q Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold" style={{color: themeConfig.colors.text}}>{user?.user_metadata?.screen_name || 'admin'}</span>
          </Link>

          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" style={{backgroundColor: 'transparent', borderColor: themeConfig.colors.border}}>
                  <Settings className="w-4 h-4" style={{color: themeConfig.colors.textSecondary}}/>
                  <span className="ml-2 hidden sm:inline" style={{color: themeConfig.colors.text}}>Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger><Palette className="mr-2 h-4 w-4" /><span>Theme</span></DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            {Object.entries(themes).map(([key, value]) => (
                                <DropdownMenuItem key={key} onClick={() => setTheme(key as any)}>
                                    {value.dark.name.replace(' (Dark)', '')}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}>
                  {themeMode === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/feedback')}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Feedback
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleWatermark}>
                      <PictureInPicture className="mr-2 h-4 w-4" />
                      <span>{isWatermarkVisible ? 'Hide' : 'Show'} Watermark</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin/beta-controls')}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Beta Controls
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/admin/investor-suite')}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Investor Suite
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default ResponsiveNavigation;