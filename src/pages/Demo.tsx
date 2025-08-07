import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Eye, Settings, Scan, Palette } from 'lucide-react';

const Demo: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

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
        <div className="mb-8">
          <h1 
            className="text-3xl font-bold flex items-center mb-4"
            style={{ 
              color: themeConfig.colors.text,
              fontFamily: themeConfig.fonts.heading
            }}
          >
            <Eye className="w-8 h-8 mr-3" />
            TAGNETIQ DEMO ACCESS
          </h1>
          <p 
            className="text-lg"
            style={{ color: themeConfig.colors.textSecondary }}
          >
            Access signed-in interfaces for UI scouting and testing
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
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
                <Scan className="w-5 h-5 mr-2" />
                Dashboard Interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p 
                className="mb-4"
                style={{ color: themeConfig.colors.textSecondary }}
              >
                View the main signed-in dashboard with scanner and analysis features
              </p>
              <Link to="/demo-dashboard">
                <Button 
                  className="w-full"
                  style={{
                    backgroundColor: themeConfig.colors.primary,
                    color: themeConfig.colors.background
                  }}
                >
                  View Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>

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
                <Palette className="w-5 h-5 mr-2" />
                Theme Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p 
                className="mb-4"
                style={{ color: themeConfig.colors.textSecondary }}
              >
                Test all 8 custom themes and their Day/Night modes
              </p>
              <Link to="/demo-settings">
                <Button 
                  className="w-full"
                  style={{
                    backgroundColor: themeConfig.colors.primary,
                    color: themeConfig.colors.background
                  }}
                >
                  View Theme Settings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Link to="/">
            <Button 
              variant="outline"
              style={{
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            >
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Demo;