import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Settings as SettingsIcon, ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import DeviceConnectionSettings from '@/components/DeviceConnectionSettings';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ScreenNameModal from '@/components/ScreenNameModal';

const DemoSettings: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const [screenNameModalOpen, setScreenNameModalOpen] = useState(false);
  const themeConfig = getThemeConfig(theme, themeMode);

  const handleSaveScreenName = async (screenName: string) => {
    console.log('Demo: Saving screen name:', screenName);
  };

  const getSectionBackground = () => {
    if (theme === 'matrix' && themeMode === 'dark') {
      return 'linear-gradient(135deg, rgba(0, 255, 65, 0.05) 0%, rgba(0, 0, 0, 0.8) 100%)';
    }
    if (theme === 'executive') {
      return themeMode === 'dark' 
        ? 'linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(42, 42, 42, 0.7) 100%)'
        : 'linear-gradient(135deg, rgba(248, 248, 248, 0.9) 0%, rgba(240, 240, 240, 0.7) 100%)';
    }
    return `linear-gradient(135deg, ${themeConfig.colors.surface}90 0%, ${themeConfig.colors.background}80 100%)`;
  };

  return (
    <div 
      className="min-h-screen pt-20"
      style={{ 
        background: getSectionBackground(),
        fontFamily: themeConfig.fonts.body
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Link to="/demo">
            <Button
              variant="ghost"
              className="mr-4"
              style={{ color: themeConfig.colors.text }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Demo
            </Button>
          </Link>
          <div>
            <h1 
              className="text-3xl font-bold flex items-center"
              style={{ 
                color: themeConfig.colors.text,
                fontFamily: themeConfig.fonts.heading
              }}
            >
              <SettingsIcon className="w-8 h-8 mr-3" />
              TAGNETIQ SETTINGS
            </h1>
            <p 
              className="text-lg mt-2"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              Configure your tactical scanning experience (Demo Mode)
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <Card 
            className="backdrop-blur-sm border"
            style={{
              backgroundColor: `${themeConfig.colors.surface}90`,
              borderColor: `${themeConfig.colors.border}50`,
            }}
          >
            <CardHeader>
              <CardTitle 
                className="flex items-center"
                style={{ 
                  color: themeConfig.colors.text,
                  fontFamily: themeConfig.fonts.heading
                }}
              >
                <User className="w-5 h-5 mr-2" />
                User Profile (Demo)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setScreenNameModalOpen(true)}
                variant="outline"
                className="w-full"
                style={{
                  borderColor: `${themeConfig.colors.border}50`,
                  color: themeConfig.colors.text
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Set Screen Name
              </Button>
            </CardContent>
          </Card>

          <ThemeSwitcher />
          <DeviceConnectionSettings />
        </div>

        <ScreenNameModal
          isOpen={screenNameModalOpen}
          onClose={() => setScreenNameModalOpen(false)}
          onSave={handleSaveScreenName}
          currentScreenName=""
        />
      </div>
    </div>
  );
};

export default DemoSettings;