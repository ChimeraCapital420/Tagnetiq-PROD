// FILE: src/components/social/PrivacySettings.tsx
// Privacy settings card for profile page

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Shield, Eye, MessageCircle, Loader2, Users, Lock, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

interface PrivacyOption {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const PrivacySettings: React.FC = () => {
  const [visibility, setVisibility] = useState('public');
  const [messaging, setMessaging] = useState('everyone');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/user/privacy', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to load settings');

      const data = await response.json();
      setVisibility(data.profile_visibility || 'public');
      setMessaging(data.allow_messages_from || 'everyone');
    } catch (error) {
      console.error('Privacy settings fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (field: string, value: string) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/user/privacy', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      if (field === 'profile_visibility') setVisibility(value);
      if (field === 'allow_messages_from') setMessaging(value);

      toast.success('Settings updated');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const visibilityOptions: PrivacyOption[] = [
    {
      value: 'public',
      label: 'Public',
      description: 'Anyone can view your profile and stats',
      icon: <Globe className="h-4 w-4 text-green-400" />,
    },
    {
      value: 'friends_only',
      label: 'Friends Only',
      description: 'Only friends can view your full profile',
      icon: <Users className="h-4 w-4 text-blue-400" />,
    },
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can see your profile details',
      icon: <Lock className="h-4 w-4 text-red-400" />,
    },
  ];

  const messagingOptions: PrivacyOption[] = [
    {
      value: 'everyone',
      label: 'Everyone',
      description: 'Anyone can send you direct messages',
      icon: <Globe className="h-4 w-4 text-green-400" />,
    },
    {
      value: 'friends_only',
      label: 'Friends Only',
      description: 'Only friends can message you directly',
      icon: <Users className="h-4 w-4 text-blue-400" />,
    },
    {
      value: 'nobody',
      label: 'Disabled',
      description: 'No one can send you direct messages',
      icon: <Lock className="h-4 w-4 text-red-400" />,
    },
  ];

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control who can see your profile and contact you
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Profile Visibility */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-zinc-400" />
            <Label className="text-sm font-medium">Profile Visibility</Label>
          </div>

          <RadioGroup
            value={visibility}
            onValueChange={(value) => updateSetting('profile_visibility', value)}
            disabled={saving}
            className="space-y-3"
          >
            {visibilityOptions.map((option) => (
              <div
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  visibility === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-zinc-800 bg-zinc-900/30'
                }`}
              >
                <RadioGroupItem value={option.value} id={`vis-${option.value}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`vis-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    {option.icon}
                    <span className="font-medium">{option.label}</span>
                  </Label>
                  <p className="text-xs text-zinc-500 mt-1">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Messaging */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-zinc-400" />
            <Label className="text-sm font-medium">Direct Messages</Label>
          </div>

          <RadioGroup
            value={messaging}
            onValueChange={(value) => updateSetting('allow_messages_from', value)}
            disabled={saving}
            className="space-y-3"
          >
            {messagingOptions.map((option) => (
              <div
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  messaging === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-zinc-800 bg-zinc-900/30'
                }`}
              >
                <RadioGroupItem value={option.value} id={`msg-${option.value}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`msg-${option.value}`} className="flex items-center gap-2 cursor-pointer">
                    {option.icon}
                    <span className="font-medium">{option.label}</span>
                  </Label>
                  <p className="text-xs text-zinc-500 mt-1">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        {saving && (
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PrivacySettings;