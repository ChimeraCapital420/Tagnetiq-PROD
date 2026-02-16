// FILE: src/pages/Settings.tsx
// v2.2: Premium voice section now links to full /voices page experience

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Bluetooth, Camera, Wifi, WifiOff, Plus, Volume2, ChevronRight } from 'lucide-react';
import { useBluetoothManager } from '@/hooks/useBluetoothManager';
import DevicePairingModal from '@/components/DevicePairingModal';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme, themeMode, setThemeMode } = useAppContext();
  const { profile, setProfile } = useAuth();
  const { voices } = useTts();
  const { i18n } = useTranslation();
  const { connectedDevice, disconnect } = useBluetoothManager();
  const [showPairingModal, setShowPairingModal] = useState(false);

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

  // Get the current premium voice name for display
  const currentPremiumVoice = profile?.settings?.premium_voice_id;
  const premiumVoiceLabel = currentPremiumVoice
    ? currentPremiumVoice.replace('oracle-', '').replace(/-[a-z]{2}$/, '').replace(/^el-/, 'ElevenLabs: ').replace(/^\w/, (c: string) => c.toUpperCase())
    : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Manage your application settings and preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* --- Theme Settings --- */}
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
            
            {/* --- Voice Assistant Settings --- */}
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

                  {/* Premium Oracle Voice — links to full /voices page */}
                  <div className="space-y-2 pt-4">
                    <Label>Premium Oracle Voice</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose a high-quality, natural-sounding voice for your AI partner.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      onClick={() => navigate('/voices')}
                    >
                      <div className="flex items-center gap-3">
                        <Volume2 className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          {premiumVoiceLabel ? (
                            <>
                              <p className="text-sm font-medium">{premiumVoiceLabel}</p>
                              <p className="text-xs text-muted-foreground">Tap to change voice</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium">Choose a Voice</p>
                              <p className="text-xs text-muted-foreground">Browse Oracle voices & ElevenLabs library</p>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Connected Devices Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-blue-500" />
              Connected Devices
            </CardTitle>
            <CardDescription>
              Manage your connected external cameras and smart devices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectedDevice ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                      <Wifi className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">{connectedDevice.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Connected via Bluetooth • Active
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      disconnect();
                      toast.success('Device disconnected');
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  This device is available as a camera source in the scanner.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-muted rounded-full">
                    <WifiOff className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">No devices connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connect smart glasses, external cameras, or other Bluetooth devices
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <Button
              onClick={() => setShowPairingModal(true)}
              className="w-full"
              variant={connectedDevice ? "outline" : "default"}
            >
              <Plus className="w-4 h-4 mr-2" />
              {connectedDevice ? 'Pair Another Device' : 'Pair New Device'}
            </Button>
            
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2 text-sm">Compatible Devices</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Camera className="w-3 h-3" />
                  Ray-Ban Meta Smart Glasses
                </li>
                <li className="flex items-center gap-2">
                  <Camera className="w-3 h-3" />
                  GoPro cameras (Bluetooth enabled)
                </li>
                <li className="flex items-center gap-2">
                  <Camera className="w-3 h-3" />
                  DJI Pocket cameras
                </li>
                <li className="flex items-center gap-2">
                  <Camera className="w-3 h-3" />
                  Other Bluetooth video devices
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Device Pairing Modal */}
      <DevicePairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onDeviceConnected={() => {
          setShowPairingModal(false);
          toast.success('Device paired successfully');
        }}
      />
    </div>
  );
};

export default Settings;
