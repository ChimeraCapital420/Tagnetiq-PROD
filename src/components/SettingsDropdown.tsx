// FILE: src/components/SettingsDropdown.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, LogOut, Sun, Moon, Palette, MessageSquare, BarChart, ShieldCheck, Beaker, Map, Leaf, User, Languages } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LanguageSelector } from './LanguageSelector';

const themeNames = ['executive', 'matrix', 'safari', 'darkKnight', 'cyberpunk', 'ocean', 'forest', 'sunset'];

const SettingsDropdown: React.FC = () => {
  const { signOut, isAdmin } = useAuth();
  const { theme, setTheme, themeMode, setThemeMode, seasonalMode, setSeasonalMode, setIsFeedbackModalOpen } = useAppContext();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
            <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                <span>User Control Panel</span>
            </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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
        <DropdownMenuItem onSelect={() => setIsFeedbackModalOpen(true)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>Send Feedback</span>
        </DropdownMenuItem>
        
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Admin Tools</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/admin/map"><Map className="mr-2 h-4 w-4" /><span>Global Map</span></Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/beta"><Beaker className="mr-2 h-4 w-4" /><span>Beta Console</span></Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/admin/investors"><BarChart className="mr-2 h-4 w-4" /><span>Investor Suite</span></Link></DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SettingsDropdown;