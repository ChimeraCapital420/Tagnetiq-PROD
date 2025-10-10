// FILE: src/components/SettingsDropdown.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, LogOut, Sun, Moon, Palette, MessageSquare, BarChart, ShieldCheck, Beaker, Map, Leaf, User, Languages, Bluetooth, ExternalLink, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LanguageSelector } from './LanguageSelector';
import DevicePairingModal from '@/components/DevicePairingModal';

const themeNames = ['executive', 'matrix', 'safari', 'darkKnight', 'cyberpunk', 'ocean', 'forest', 'sunset'];

const SettingsDropdown: React.FC = () => {
  const { signOut, isAdmin, profile } = useAuth();
  const { theme, setTheme, themeMode, setThemeMode, seasonalMode, setSeasonalMode, setIsFeedbackModalOpen } = useAppContext();
  const [isDevicePairingOpen, setIsDevicePairingOpen] = useState(false);

  const handleSeasonalToggle = (isChecked: boolean) => {
    if (isChecked) {
      // Set a default season when turning on, e.g., 'fall'.
      // This could be made more dynamic based on the actual date in the future.
      setSeasonalMode('fall');
    } else {
      setSeasonalMode('off');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="end">
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Primary Settings */}
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center justify-between">
                <div className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  <div>
                    <span>User Control Panel</span>
                    <p className="text-xs text-muted-foreground">Manage your account</p>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link to="/settings/billing" className="flex items-center justify-between">
                <div className="flex items-center">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <div>
                    <span>Billing & Subscription</span>
                    <p className="text-xs text-muted-foreground">Plans & invoices</p>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          
          <DropdownMenuSeparator />
          
          {/* Appearance Settings */}
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                <span>Theme: {theme.charAt(0).toUpperCase() + theme.slice(1).replace(/([A-Z])/g, ' $1').trim()}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {themeNames.map((themeId) => (
                  <DropdownMenuItem key={themeId} onSelect={() => setTheme(themeId as any)}>
                    {themeId.charAt(0).toUpperCase() + themeId.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}>
              {themeMode === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </DropdownMenuItem>
             <Popover>
               <PopoverTrigger asChild>
                 <Button variant="ghost" className="w-full justify-start font-normal px-2 py-1.5 h-auto">
                     <Languages className="mr-2 h-4 w-4" />
                     <span>Language</span>
                 </Button>
               </PopoverTrigger>
               <PopoverContent>
                   <LanguageSelector />
               </PopoverContent>
             </Popover>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />

          <div className="px-2 py-1.5 text-sm">
            <div className="flex items-center justify-between">
              <Label htmlFor="seasonal-mode" className="flex items-center gap-2 font-normal">
                <Leaf className="h-4 w-4" />
                <span>Seasonal Mode</span>
              </Label>
              <Switch
                id="seasonal-mode"
                checked={seasonalMode !== 'off'}
                onCheckedChange={handleSeasonalToggle}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 px-1">Adds seasonal visuals over your theme.</p>
          </div>

          <DropdownMenuSeparator />
          
          {/* Tools & Feedback */}
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setIsDevicePairingOpen(true)}>
              <Bluetooth className="mr-2 h-4 w-4" />
              <div>
                <span>Bluetooth Devices</span>
                <p className="text-xs text-muted-foreground">Connect external devices</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setIsFeedbackModalOpen(true)}>
              <MessageSquare className="mr-2 h-4 w-4" />
              <div>
                <span>Send Feedback</span>
                <p className="text-xs text-muted-foreground">Help us improve</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Admin Tools</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/admin/map" className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Map className="mr-2 h-4 w-4" />
                    <span>Global Map</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/beta" className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Beaker className="mr-2 h-4 w-4" />
                    <span>Beta Console</span>
                  </div>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin/investors" className="flex items-center justify-between">
                  <div className="flex items-center">
                    <BarChart className="mr-2 h-4 w-4" />
                    <span>Investor Suite</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <DevicePairingModal
        isOpen={isDevicePairingOpen}
        onClose={() => setIsDevicePairingOpen(false)}
      />
    </>
  );
};

export default SettingsDropdown;