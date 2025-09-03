// FILE: src/pages/Profile.tsx (COMPLETE OVERHAUL)

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { useTts } from '@/hooks/useTts';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Palette, Volume2, Globe, Shield, Sparkles } from 'lucide-react';
import PremiumVoiceSelector from '@/components/PremiumVoiceSelector';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AvatarUploader } from '@/components/profile/AvatarUploader';
import { BackgroundUploader } from '@/components/profile/BackgroundUploader';
import { AccountSecurity } from '@/components/profile/AccountSecurity';
import { NotificationPreferences } from '@/components/profile/NotificationPreferences';

const ProfilePage: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { theme, setTheme, themeMode, setThemeMode, seasonalMode, setSeasonalMode } = useAppContext();
  const { voices } = useTts();
  const { i18n, t } = useTranslation();
  const [activeTab, setActiveTab] = useState('profile');

  const handleTtsEnabledChange = async (enabled: boolean) => {
    if (!profile) return;
    const newSettings = { ...profile.settings, tts_enabled: enabled };
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });
    const { error } = await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);
    if (error) {
      toast.error(t('settings.voice.saveFailed'));
      setProfile(oldProfile);
    } else {
      toast.success(enabled ? t('settings.voice.enabled') : t('settings.voice.disabled'));
    }
  };

  const handleVoiceChange = async (voiceURI: string) => {
    if (!profile) return;
    const newSettings = { ...profile.settings, tts_voice_uri: voiceURI };
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });
    const { error } = await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);
    if (error) {
      toast.error(t('settings.voice.saveFailed'));
      setProfile(oldProfile);
    } else {
      toast.success(t('settings.voice.saved'));
    }
  };

  const handleSeasonalToggle = (isChecked: boolean) => {
    if (isChecked) {
      // Automatically detect the current season based on date
      const month = new Date().getMonth() + 1;
      let season = 'spring';
      if (month >= 6 && month <= 8) season = 'summer';
      else if (month >= 9 && month <= 11) season = 'fall';
      else if (month === 12 || month <= 2) season = 'winter';
      
      setSeasonalMode(season as any);
    } else {
      setSeasonalMode('off');
    }
  };

  const filteredVoices = voices.filter(voice => voice.lang.startsWith(i18n.language));

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('profile.title', 'User Control Panel')}</h1>
        <p className="text-muted-foreground">{t('profile.subtitle', 'Manage your personal space within Tagnetiq')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.profile', 'Profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.appearance', 'Appearance')}</span>
          </TabsTrigger>
          <TabsTrigger value="oracle" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.oracle', 'Oracle')}</span>
          </TabsTrigger>
          <TabsTrigger value="language" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.language', 'Language')}</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.security', 'Security')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('profile.avatar.title', 'Profile Avatar')}</CardTitle>
                <CardDescription>{t('profile.avatar.description', 'Your visual identity across Tagnetiq')}</CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUploader />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('profile.info.title', 'Account Information')}</CardTitle>
                <CardDescription>{t('profile.info.description', 'Your account details and status')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-muted-foreground">{t('profile.info.email', 'Email')}</Label>
                  <p className="font-medium">{profile?.email}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t('profile.info.role', 'Account Type')}</Label>
                  <p className="font-medium capitalize flex items-center gap-2">
                    {profile?.role}
                    {profile?.role === 'investor' && <Sparkles className="h-4 w-4 text-yellow-500" />}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t('profile.info.joined', 'Member Since')}</Label>
                  <p className="font-medium">{new Date(profile?.created_at || '').toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <NotificationPreferences />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('appearance.theme.title', 'Theme Selection')}</CardTitle>
              <CardDescription>{t('appearance.theme.description', 'Choose your preferred visual style')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>{t('appearance.theme.select', 'Select Theme')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['executive', 'matrix', 'safari', 'darkKnight', 'cyberpunk', 'ocean', 'forest', 'sunset'].map((themeId) => (
                    <Button
                      key={themeId}
                      variant={theme === themeId ? 'default' : 'outline'}
                      onClick={() => setTheme(themeId as any)}
                      className="w-full"
                    >
                      {themeId.charAt(0).toUpperCase() + themeId.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Label>{t('appearance.mode.title', 'Display Mode')}</Label>
                <div className="flex gap-3">
                  <Button 
                    variant={themeMode === 'light' ? 'default' : 'outline'} 
                    onClick={() => setThemeMode('light')}
                    className="flex-1"
                  >
                    {t('appearance.mode.light', 'Light')}
                  </Button>
                  <Button 
                    variant={themeMode === 'dark' ? 'default' : 'outline'} 
                    onClick={() => setThemeMode('dark')}
                    className="flex-1"
                  >
                    {t('appearance.mode.dark', 'Dark')}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="seasonal-mode" className="flex flex-col gap-1">
                  <span>{t('appearance.seasonal.title', 'Seasonal Mode')}</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    {t('appearance.seasonal.description', 'Adds seasonal visuals over your theme')}
                  </span>
                </Label>
                <Switch
                  id="seasonal-mode"
                  checked={seasonalMode !== 'off'}
                  onCheckedChange={handleSeasonalToggle}
                />
              </div>
            </CardContent>
          </Card>

          <BackgroundUploader />
        </TabsContent>

        <TabsContent value="oracle" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('oracle.title', 'Oracle Voice Assistant')}</CardTitle>
              <CardDescription>{t('oracle.description', 'Configure your AI companion\'s voice and behavior')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="tts-enabled" className="flex flex-col gap-1">
                  <span>{t('oracle.enable.title', 'Enable Voice Readouts')}</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    {t('oracle.enable.description', 'Allow the Oracle to speak analysis results')}
                  </span>
                </Label>
                <Switch 
                  id="tts-enabled" 
                  checked={profile?.settings?.tts_enabled ?? false} 
                  onCheckedChange={handleTtsEnabledChange} 
                />
              </div>

              {profile?.settings?.tts_enabled && (
                <>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="tts-voice" className="mb-2">{t('oracle.systemVoice.title', 'System Voice')}</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        {t('oracle.systemVoice.description', 'Basic voice from your browser or OS')}
                      </p>
                      <Select 
                        value={profile?.settings?.tts_voice_uri || ''} 
                        onValueChange={handleVoiceChange} 
                        disabled={filteredVoices.length === 0}
                      >
                        <SelectTrigger id="tts-voice">
                          <SelectValue placeholder={t('oracle.systemVoice.placeholder', 'Select a voice...')} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredVoices.map((voice) => (
                            <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label className="mb-2">{t('oracle.premiumVoice.title', 'Premium Oracle Voice')}</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        {t('oracle.premiumVoice.description', 'High-quality, natural AI voices')}
                      </p>
                      <PremiumVoiceSelector />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="language" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('language.title', 'Language & Region')}</CardTitle>
              <CardDescription>{t('language.description', 'Set your preferred language for the entire application')}</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <AccountSecurity />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;