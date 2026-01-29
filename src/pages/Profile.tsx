// FILE: src/pages/Profile.tsx (COMPLETE)

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
import { User, Palette, Volume2, Globe, Shield, Sparkles, Badge, Users } from 'lucide-react';
import PremiumVoiceSelector from '@/components/PremiumVoiceSelector';
import OracleVisualizerSelector from '@/components/profile/OracleVisualizerSelector';
import UserInterestsManager from '@/components/profile/UserInterestsManager';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AvatarUploader } from '@/components/profile/AvatarUploader';
import { BackgroundUploader } from '@/components/profile/BackgroundUploader';
import { AccountSecurity } from '@/components/profile/AccountSecurity';
import { NotificationPreferences } from '@/components/profile/NotificationPreferences';
import { FriendsList } from '@/components/social/FriendsList';
import { PrivacySettings } from '@/components/social/PrivacySettings';

const ProfilePage: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { theme, setTheme, themeMode, setThemeMode, seasonalMode, setSeasonalMode } = useAppContext();
  const { voices, speak } = useTts();
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

  const handleVoiceSettingChange = async (key: string, value: any) => {
    if (!profile) return;
    const newSettings = { 
      ...profile.settings, 
      voice_settings: {
        ...profile.settings.voice_settings,
        [key]: value
      }
    };
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });
    const { error } = await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);
    if (error) {
      toast.error(t('settings.voice.saveFailed'));
      setProfile(oldProfile);
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
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 gap-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.profile', 'Profile')}</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('profile.tabs.social', 'Social')}</span>
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

        <TabsContent value="social" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <FriendsList />
            <PrivacySettings />
          </div>
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
                  {/* Voice Commands Info */}
                  <Card className="bg-muted/50">
                    <CardContent className="pt-6">
                      <h4 className="font-medium mb-3">{t('oracle.commands.title', 'Voice Commands')}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Ctrl+Shift+J</Badge>
                          <span className="text-muted-foreground">{t('oracle.commands.activate', 'Activate voice control')}</span>
                        </div>
                        <div className="grid gap-1 mt-3 text-xs text-muted-foreground">
                          <p>• "{t('oracle.commands.sweep', 'Start sweep')}" - {t('oracle.commands.sweepDesc', 'Begin hunting mode')}</p>
                          <p>• "{t('oracle.commands.triage', 'Oracle, triage this')}" - {t('oracle.commands.triageDesc', 'Quick evaluation')}</p>
                          <p>• "{t('oracle.commands.analyze', 'Deep dive')}" - {t('oracle.commands.analyzeDesc', 'Full analysis')}</p>
                          <p>• "{t('oracle.commands.vault', 'Vault this')}" - {t('oracle.commands.vaultDesc', 'Save to collection')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* System Voice Selection */}
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

                  {/* Premium Voice Selection */}
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label className="mb-2">{t('oracle.premiumVoice.title', 'Premium Oracle Voice')}</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        {t('oracle.premiumVoice.description', 'High-quality, natural AI voices with emotion and personality')}
                      </p>
                      <PremiumVoiceSelector />
                    </div>
                  </div>

                  {/* Voice Settings */}
                  <div className="space-y-4 pt-4 border-t">
                    <Label>{t('oracle.settings.title', 'Voice Settings')}</Label>
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="voice-speed" className="text-sm font-normal">
                          {t('oracle.settings.speed', 'Speaking Speed')}
                        </Label>
                        <Select 
                          defaultValue={profile?.settings?.voice_settings?.speed || "1.0"}
                          onValueChange={(value) => handleVoiceSettingChange('speed', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0.8">0.8x</SelectItem>
                            <SelectItem value="0.9">0.9x</SelectItem>
                            <SelectItem value="1.0">1.0x</SelectItem>
                            <SelectItem value="1.1">1.1x</SelectItem>
                            <SelectItem value="1.2">1.2x</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="voice-priority" className="text-sm font-normal">
                          {t('oracle.settings.priority', 'Alert Priority')}
                        </Label>
                        <Select 
                          defaultValue={profile?.settings?.voice_settings?.priority || "high"}
                          onValueChange={(value) => handleVoiceSettingChange('priority', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{t('oracle.priority.all', 'All Alerts')}</SelectItem>
                            <SelectItem value="high">{t('oracle.priority.high', 'High Only')}</SelectItem>
                            <SelectItem value="critical">{t('oracle.priority.critical', 'Critical Only')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Visualizer Selection */}
                  <div className="space-y-4 pt-4 border-t">
                    <OracleVisualizerSelector />
                  </div>

                  {/* User Interests */}
                  <div className="space-y-4 pt-4 border-t">
                    <UserInterestsManager />
                  </div>

                  {/* Test Oracle Button */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{t('oracle.test.title', 'Test Oracle Voice')}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('oracle.test.description', 'Hear how your Oracle sounds')}
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            speak(t('oracle.test.message', 'Hello, I am your Tagnetiq Oracle assistant. I\'m here to help you identify valuable opportunities.'));
                          }}
                          variant="outline"
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          {t('oracle.test.button', 'Test Voice')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
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