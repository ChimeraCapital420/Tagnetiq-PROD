import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';
import { Settings as SettingsIcon, ArrowLeft, LogOut, User, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import DeviceConnectionSettings from '@/components/DeviceConnectionSettings';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ScreenNameModal from '@/components/ScreenNameModal';
import { useToast } from '@/hooks/use-toast';
const Settings: React.FC = () => {
  const { theme, themeMode } = useAppContext();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [screenNameModalOpen, setScreenNameModalOpen] = useState(false);
  const [suggestionEmail, setSuggestionEmail] = useState('');
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const themeConfig = getThemeConfig(theme, themeMode);
  const { toast } = useToast();

  const handleSaveScreenName = async (screenName: string) => {
    // Update user metadata with screen name
    // This would typically involve a Supabase call to update user metadata
    console.log('Saving screen name:', screenName);
  };

  const handleSendSuggestion = async () => {
    if (!suggestionEmail || !suggestionMessage) {
      toast({
        title: "Missing Information",
        description: "Please fill in both email and message fields.",
        variant: "destructive"
      });
      return;
    }

    // Here you would typically send the suggestion to your backend
    console.log('Sending suggestion:', { email: suggestionEmail, message: suggestionMessage });
    
    toast({
      title: "Suggestion Sent",
      description: "Thank you for your feedback! We'll review your suggestion.",
    });
    
    setSuggestionEmail('');
    setSuggestionMessage('');
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
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mr-4"
            style={{ color: themeConfig.colors.text }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
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
              Configure your tactical scanning experience
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* User Profile Section */}
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
                User Profile
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
                {user?.user_metadata?.screen_name ? 'Change Screen Name' : 'Set Screen Name'}
              </Button>
            </CardContent>
          </Card>

          <ThemeSwitcher />
          <DeviceConnectionSettings />

          {/* Suggestion Email Section */}
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
                <Mail className="w-5 h-5 mr-2" />
                Send Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label 
                  htmlFor="suggestion-email"
                  style={{ color: themeConfig.colors.text }}
                >
                  Your Email
                </Label>
                <Input
                  id="suggestion-email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={suggestionEmail}
                  onChange={(e) => setSuggestionEmail(e.target.value)}
                  style={{
                    backgroundColor: `${themeConfig.colors.surface}50`,
                    borderColor: `${themeConfig.colors.border}50`,
                    color: themeConfig.colors.text
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label 
                  htmlFor="suggestion-message"
                  style={{ color: themeConfig.colors.text }}
                >
                  Your Suggestion
                </Label>
                <Textarea
                  id="suggestion-message"
                  placeholder="Tell us about your ideas, feature requests, or feedback..."
                  value={suggestionMessage}
                  onChange={(e) => setSuggestionMessage(e.target.value)}
                  rows={4}
                  style={{
                    backgroundColor: `${themeConfig.colors.surface}50`,
                    borderColor: `${themeConfig.colors.border}50`,
                    color: themeConfig.colors.text
                  }}
                />
              </div>
              <Button
                onClick={handleSendSuggestion}
                className="w-full"
                style={{
                  backgroundColor: themeConfig.colors.primary,
                  color: themeConfig.colors.text
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                Send Suggestion
              </Button>
            </CardContent>
          </Card>
        </div>

        <ScreenNameModal
          isOpen={screenNameModalOpen}
          onClose={() => setScreenNameModalOpen(false)}
          onSave={handleSaveScreenName}
          currentScreenName={user?.user_metadata?.screen_name || ''}
        />
        
        {/* Log Out Section - Moved to bottom */}
        <Card className="border-red-500/30 bg-red-900/20 mt-12">
          <CardHeader>
            <CardTitle className="text-red-400">Account Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={signOut}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
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