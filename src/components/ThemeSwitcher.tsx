import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Sun, Moon } from 'lucide-react';

const ThemeSwitcher: React.FC = () => {
  const { theme, themeMode, setTheme, setThemeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  const themes = [
    { value: 'safari', label: 'Safari Expedition' },
    { value: 'executive', label: 'Executive Dashboard' },
    { value: 'matrix', label: 'Matrix' },
    { value: 'darkKnight', label: 'Dark Knight' },
    { value: 'cyberpunk', label: 'Cyberpunk Steampunk' },
    { value: 'ocean', label: 'Ocean' },
    { value: 'forest', label: 'Forest' },
    { value: 'sunset', label: 'Sunset' }
  ];

  return (
    <Card 
      className="backdrop-blur-sm border"
      style={{
        backgroundColor: `${themeConfig.colors.surface}90`,
        borderColor: `${themeConfig.colors.border}50`,
      }}
    >
      <CardHeader>
        <CardTitle 
          className="flex items-center gap-2"
          style={{ 
            color: themeConfig.colors.text,
            fontFamily: themeConfig.fonts.heading
          }}
        >
          <Palette className="h-5 w-5" />
          Theme Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label 
            htmlFor="theme-select"
            style={{ color: themeConfig.colors.text }}
          >
            Theme
          </Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger 
              id="theme-select"
              className="backdrop-blur-sm"
              style={{
                backgroundColor: `${themeConfig.colors.surface}50`,
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            >
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent 
              className="backdrop-blur-sm border"
              style={{
                backgroundColor: `${themeConfig.colors.surface}95`,
                borderColor: `${themeConfig.colors.border}50`,
              }}
            >
              {themes.map((t) => (
                <SelectItem 
                  key={t.value} 
                  value={t.value}
                  style={{ color: themeConfig.colors.text }}
                >
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between">
          <Label 
            htmlFor="mode-switch" 
            className="flex items-center gap-2"
            style={{ color: themeConfig.colors.text }}
          >
            {themeMode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {themeMode === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </Label>
          <Switch
            id="mode-switch"
            checked={themeMode === 'dark'}
            onCheckedChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ThemeSwitcher;