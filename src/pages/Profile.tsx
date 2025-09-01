// FILE: src/pages/Profile.tsx (OVERHAULED)

import React from 'react';
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
import PremiumVoiceSelector from '@/components/PremiumVoiceSelector';
import { LanguageSelector } from '@/components/LanguageSelector';
import { AvatarUploader } from '@/components/profile/AvatarUploader';
import { BackgroundUploader } from '@/components/profile/BackgroundUploader';

const ProfilePage: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { theme, setTheme, themeMode, setThemeMode } = useAppContext();
  const { voices } = useTts();
  const { i18n } = useTranslation();

  const handleTtsEnabledChange = async (enabled: boolean) => {
    if (!profile) return;
    const newSettings = { ...profile.settings, tts_enabled: enabled };
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });
    const { error } = await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);
    if (error) {
      toast.error('Failed to save setting.');
      setProfile(oldProfile);
    } else {
      toast.success(`Voice Assistant ${enabled ? 'enabled' : 'disabled'}.`);
    }
  };

  const handleVoiceChange = async (voiceURI: string) => {
    if (!profile) return;
    const newSettings = { ...profile.settings, tts_voice_uri: voiceURI };
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });
    const { error } = await supabase.from('profiles').update({ settings: newSettings }).eq('id', profile.id);
    if (error) {
      toast.error('Failed to save voice preference.');
      setProfile(oldProfile);
    } else {
      toast.success('Voice preference saved.');
    }
  };

  const filteredVoices = voices.filter(voice => voice.lang.startsWith(i18n.language));

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>User Control Panel</CardTitle>
              <CardDescription>Your personal space within Tagnetiq.</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUploader />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Settings Cards */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Button variant={themeMode === 'light' ? 'default' : 'outline'} onClick={() => setThemeMode('light')}>Light</Button>
                  <Button variant={themeMode === 'dark' ? 'default' : 'outline'} onClick={() => setThemeMode('dark')}>Dark</Button>
                </div>
              </div>
              <BackgroundUploader />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice Assistant (Oracle)</CardTitle>
              <CardDescription>Manage your voice and speech settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <Label htmlFor="tts-enabled" className="flex flex-col gap-1">
                  <span>Enable Voice Readouts</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Allow the Oracle to speak analysis results.
                  </span>
                </Label>
                <Switch id="tts-enabled" checked={profile?.settings?.tts_enabled ?? false} onCheckedChange={handleTtsEnabledChange} />
              </div>
              {profile?.settings?.tts_enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="tts-voice">Standard System Voice</Label>
                    <p className="text-xs text-muted-foreground">A generic voice from your browser or operating system.</p>
                    <Select value={profile?.settings?.tts_voice_uri || ''} onValueChange={handleVoiceChange} disabled={filteredVoices.length === 0}>
                      <SelectTrigger id="tts-voice"><SelectValue placeholder="Select a default voice..." /></SelectTrigger>
                      <SelectContent>
                        {filteredVoices.map((voice) => (
                          <SelectItem key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 pt-4">
                    <Label>Premium Oracle Voice</Label>
                    <p className="text-sm text-muted-foreground">Choose a high-quality, natural-sounding voice.</p>
                    <PremiumVoiceSelector />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language & Region</CardTitle>
              <CardDescription>Choose the language for the application UI and voice assistant.</CardDescription>
            </CardHeader>
            <CardContent>
              <LanguageSelector />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;