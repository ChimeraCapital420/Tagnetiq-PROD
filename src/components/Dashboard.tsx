import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import InstantFlipAlerts from './InstantFlipAlerts';
import AnalysisResult from './AnalysisResult';
import { Zap, Mic, MicOff } from 'lucide-react';
import { getCategoryColors } from '@/lib/categoryColors';

const Dashboard: React.FC = () => {
  const { 
    voiceRecognitionEnabled, 
    toggleVoiceRecognition,
    listItAndWalkMode,
    toggleListItAndWalkMode,
    isAnalyzing,
    lastAnalysisResult,
    selectedCategory,
    theme,
    themeMode
  } = useAppContext();
  
  const themeConfig = getThemeConfig(theme, themeMode);
  const categoryColors = getCategoryColors(selectedCategory);

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
    <section 
      className="py-16"
      style={{ 
        background: getSectionBackground(),
        minHeight: '60vh'
      }}
    >
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        
        {/* Analysis Status */}
        {isAnalyzing && (
          <div className="text-center">
            <div 
              className="inline-flex items-center px-6 py-3 rounded-full backdrop-blur-sm"
              style={{ 
                backgroundColor: `${categoryColors.primary}20`,
                border: `1px solid ${categoryColors.primary}30`
              }}
            >
              <div 
                className="animate-spin rounded-full h-6 w-6 border-b-2 mr-3" 
                style={{ borderColor: categoryColors.primary }}
              />
              <span style={{ color: categoryColors.primary }}>Legolas AI Analyzing...</span>
            </div>
          </div>
        )}

        {lastAnalysisResult && <AnalysisResult />}

        {/* Power User Controls */}
        <Card 
          className="backdrop-blur-sm border"
          style={{
            backgroundColor: `${themeConfig.colors.surface}90`,
            borderColor: `${themeConfig.colors.border}50`,
            color: themeConfig.colors.text
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
              <Zap 
                className="w-5 h-5 mr-2" 
                style={{ color: categoryColors.accent }}
              />
              Power User Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 
                  className="font-medium"
                  style={{ color: themeConfig.colors.text }}
                >
                  List It & Walk Mode
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: themeConfig.colors.textSecondary }}
                >
                  Auto-trigger listing after successful analysis
                </p>
              </div>
              <Switch
                checked={listItAndWalkMode}
                onCheckedChange={toggleListItAndWalkMode}
                style={{ 
                  backgroundColor: listItAndWalkMode ? categoryColors.accent : undefined 
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 
                  className="font-medium"
                  style={{ color: themeConfig.colors.text }}
                >
                  Voice Recognition
                </h3>
                <p 
                  className="text-sm"
                  style={{ color: themeConfig.colors.textSecondary }}
                >
                  Enable voice commands and feedback
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleVoiceRecognition}
                style={{
                  borderColor: voiceRecognitionEnabled ? categoryColors.accent : `${themeConfig.colors.primary}50`,
                  backgroundColor: voiceRecognitionEnabled ? `${categoryColors.accent}20` : 'transparent',
                  color: voiceRecognitionEnabled ? categoryColors.accent : themeConfig.colors.primary
                }}
              >
                {voiceRecognitionEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <InstantFlipAlerts />
      </div>
    </section>
  );
};

export default Dashboard;