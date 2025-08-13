// FILE: src/pages/Settings.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';
import { Settings as SettingsIcon, ArrowLeft, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import DeviceConnectionSettings from '@/components/DeviceConnectionSettings';
import ScreenNameModal from '@/components/ScreenNameModal';

const Settings: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [screenNameModalOpen, setScreenNameModalOpen] = useState(false);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleSaveScreenName = async (screenName: string) => {
    // This would typically involve a Supabase call to update user metadata
    console.log('Saving screen name:', screenName);
  };

  return (
    <div className="min-h-screen pt-20" style={{ fontFamily: themeConfig.fonts.body }}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mr-4"
            style={{ color: themeConfig.colors.text }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center" style={{ color: themeConfig.colors.text, fontFamily: themeConfig.fonts.heading }}>
              <SettingsIcon className="w-8 h-8 mr-3" />
              Settings
            </h1>
            <p className="text-lg mt-2" style={{ color: themeConfig.colors.textSecondary }}>
              Configure your tactical scanning experience
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Card className="backdrop-blur-sm border" style={{ backgroundColor: `${themeConfig.colors.surface}90`, borderColor: `${themeConfig.colors.border}50` }}>
            <CardHeader>
              <CardTitle className="flex items-center" style={{ color: themeConfig.colors.text, fontFamily: themeConfig.fonts.heading }}>
                <User className="w-5 h-5 mr-2" />
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setScreenNameModalOpen(true)} variant="outline" className="w-full" style={{ borderColor: `${themeConfig.colors.border}50`, color: themeConfig.colors.text }}>
                <User className="w-4 h-4 mr-2" />
                {user?.user_metadata?.screen_name ? 'Change Screen Name' : 'Set Screen Name'}
              </Button>
            </CardContent>
          </Card>

          <DeviceConnectionSettings />
        </div>

        <ScreenNameModal
          isOpen={screenNameModalOpen}
          onClose={() => setScreenNameModalOpen(false)}
          onSave={handleSaveScreenName}
          currentScreenName={user?.user_metadata?.screen_name || ''}
        />
        
        <Card className="border-red-500/30 bg-red-900/20 mt-12">
          <CardHeader>
            <CardTitle className="text-red-400">Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={signOut} variant="destructive" className="bg-red-600 hover:bg-red-700">
              <LogOut className="w-4 h-4 mr-2" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;