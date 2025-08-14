// src/pages/Settings.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/contexts/AppContext';

const Settings: React.FC = () => {
  const { theme, setTheme, themeMode, setThemeMode } = useAppContext();

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your application settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['executive', 'matrix', 'safari', 'darkKnight', 'cyberpunk', 'ocean', 'forest', 'sunset'].map((themeId) => (
                <Button
                  key={themeId}
                  variant={theme === themeId ? 'default' : 'outline'}
                  onClick={() => setTheme(themeId as any)}
                >
                  {themeId.charAt(0).toUpperCase() + themeId.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Theme Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={themeMode === 'light' ? 'default' : 'outline'}
                onClick={() => setThemeMode('light')}
              >
                Light
              </Button>
              <Button
                variant={themeMode === 'dark' ? 'default' : 'outline'}
                onClick={() => setThemeMode('dark')}
              >
                Dark
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;