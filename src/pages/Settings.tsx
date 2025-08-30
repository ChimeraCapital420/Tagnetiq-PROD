// FILE: src/pages/Settings.tsx
// STATUS: Surgically updated to restore the Voice Assistant (Oracle) controls. No other functionality was altered.

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTts } from '@/hooks/useTts';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const Settings: React.FC = () => {
  const { theme, setTheme, themeMode, setThemeMode } = useAppContext();
  const { profile, setProfile } = useAuth();
  const { voices } = useTts();
  // --- ORACLE SURGICAL ADDITION ---
  // The i18n instance is required to filter voices by the user's selected language.
  const { i18n } = useTranslation();

  const handleTtsEnabledChange = async (enabled: boolean) => {
    if (!profile) return;
    
    // This is existing logic from your file, confirmed to be correct.
    const newSettings = { ...profile.settings, tts_enabled: enabled };
    
    // --- ORACLE SURGICAL ADDITION ---
    // Optimistically update the local profile state for immediate UI feedback.
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to save setting.');
      // Revert optimistic update on error
      setProfile(oldProfile);
    } else {
      toast.success(`Voice Assistant ${enabled ? 'enabled' : 'disabled'}.`);
    }
  };

  const handleVoiceChange = async (voiceURI: string) => {
    if (!profile) return;

    // This is existing logic from your file, confirmed to be correct.
    const newSettings = { ...profile.settings, tts_voice_uri: voiceURI };

    // --- ORACLE SURGICAL ADDITION ---
    // Optimistically update the local profile state.
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to save voice preference.');
       // Revert optimistic update on error
       setProfile(oldProfile);
    } else {
      toast.success('Voice preference saved.');
    }
  };

  // --- ORACLE SURGICAL ADDITION ---
  // Filter voices to only show those that match the user's currently selected language.
  const filteredVoices = voices.filter(voice => voice.lang.startsWith(i18n.language));

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your application settings and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* --- Theme Settings (Unaffected) --- */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Appearance</h3>
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
          </div>
          
          {/* --- START: ORACLE SURGICAL ADDITION --- */}
          {/* This entire block is the restored Voice Assistant settings panel. */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Voice Assistant (Oracle)</h3>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <Label htmlFor="tts-enabled" className="flex flex-col gap-1">
                <span>Enable Voice Readouts</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Automatically read analysis results aloud.
                </span>
              </Label>
              <Switch
                id="tts-enabled"
                checked={profile?.settings?.tts_enabled ?? false}
                onCheckedChange={handleTtsEnabledChange}
              />
            </div>
            {profile?.settings?.tts_enabled && (
              <div className="space-y-2">
                <Label htmlFor="tts-voice">Preferred Voice</Label>
                <Select
                  value={profile?.settings?.tts_voice_uri || ''}
                  onValueChange={handleVoiceChange}
                  disabled={filteredVoices.length === 0}
                >
                  <SelectTrigger id="tts-voice">
                    <SelectValue placeholder="Select a voice for your language..." />
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
            )}
          </div>
          {/* --- END: ORACLE SURGICAL ADDITION --- */}

        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;

