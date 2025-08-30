// FILE: src/pages/Settings.tsx
// STATUS: Surgically updated to add the PremiumVoiceSelector. No other functionality was altered.

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
// --- ORACLE SURGICAL ADDITION START ---
// This is the only new import required for this operation.
import PremiumVoiceSelector from '@/components/PremiumVoiceSelector';
// --- ORACLE SURGICAL ADDITION END ---

const Settings: React.FC = () => {
  const { theme, setTheme, themeMode, setThemeMode } = useAppContext();
  const { profile, setProfile } = useAuth();
  const { voices } = useTts();
  const { i18n } = useTranslation();

  const handleTtsEnabledChange = async (enabled: boolean) => {
    if (!profile) return;
    
    const newSettings = { ...profile.settings, tts_enabled: enabled };
    
    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

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

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to save voice preference.');
       setProfile(oldProfile);
    } else {
      toast.success('Voice preference saved.');
    }
  };

  const filteredVoices = voices.filter(voice => voice.lang.startsWith(i18n.language));

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your application settings and preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* --- Theme Settings (Unaffected by this operation) --- */}
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
          
          {/* --- Voice Assistant Settings (Surgically Updated) --- */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Voice Assistant (Oracle)</h3>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <Label htmlFor="tts-enabled" className="flex flex-col gap-1">
                <span>Enable Voice Readouts</span>
                <span className="font-normal leading-snug text-muted-foreground">
                  Allow the Oracle to speak analysis results and provide feedback.
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
                <div className="space-y-2">
                  <Label htmlFor="tts-voice">Standard System Voice</Label>
                   <p className="text-xs text-muted-foreground">
                        A generic voice from your browser or operating system.
                    </p>
                  <Select
                    value={profile?.settings?.tts_voice_uri || ''}
                    onValueChange={handleVoiceChange}
                    disabled={filteredVoices.length === 0}
                  >
                    <SelectTrigger id="tts-voice">
                      <SelectValue placeholder="Select a default voice for your language..." />
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

                {/* --- START: ORACLE SURGICAL ADDITION --- */}
                {/* This block adds the premium voice selection UI without altering the standard voice selector above. */}
                <div className="space-y-2 pt-4">
                    <Label>Premium Oracle Voice</Label>
                    <p className="text-sm text-muted-foreground">
                        Choose a high-quality, natural-sounding voice for your AI partner.
                    </p>
                    <PremiumVoiceSelector />
                </div>
                {/* --- END: ORACLE SURGICAL ADDITION --- */}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;

