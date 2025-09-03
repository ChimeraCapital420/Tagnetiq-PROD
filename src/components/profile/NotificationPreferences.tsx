// FILE: src/components/profile/NotificationPreferences.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Mail, MessageSquare, TrendingUp, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface NotificationSetting {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  settingKey: string;
}

export const NotificationPreferences: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { t } = useTranslation();

  const notificationSettings: NotificationSetting[] = [
    {
      id: 'arena_activity',
      icon: <Shield className="h-4 w-4" />,
      title: t('notifications.arena.title', 'Arena Activity'),
      description: t('notifications.arena.description', 'Challenges, offers, and messages'),
      settingKey: 'notifications_arena'
    },
    {
      id: 'valuation_updates',
      icon: <TrendingUp className="h-4 w-4" />,
      title: t('notifications.valuation.title', 'Valuation Updates'),
      description: t('notifications.valuation.description', 'Price changes for vaulted assets'),
      settingKey: 'notifications_valuations'
    },
    {
      id: 'beta_updates',
      icon: <Sparkles className="h-4 w-4" />,
      title: t('notifications.beta.title', 'Beta Program'),
      description: t('notifications.beta.description', 'New features and missions'),
      settingKey: 'notifications_beta'
    },
    {
      id: 'marketing',
      icon: <Mail className="h-4 w-4" />,
      title: t('notifications.marketing.title', 'Product Updates'),
      description: t('notifications.marketing.description', 'News and announcements'),
      settingKey: 'notifications_marketing'
    }
  ];

  const handleToggle = async (settingKey: string, enabled: boolean) => {
    if (!profile) return;

    const newSettings = {
      ...profile.settings,
      [settingKey]: enabled
    };

    const oldProfile = profile;
    setProfile({ ...profile, settings: newSettings });

    const { error } = await supabase
      .from('profiles')
      .update({ settings: newSettings })
      .eq('id', profile.id);

    if (error) {
      setProfile(oldProfile);
      toast.error(t('notifications.saveFailed', 'Failed to update notification preferences'));
    } else {
      toast.success(t('notifications.saved', 'Notification preferences updated'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {t('notifications.title', 'Email Notifications')}
        </CardTitle>
        <CardDescription>
          {t('notifications.description', 'Choose which emails you want to receive')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notificationSettings.map((setting) => (
          <div
            key={setting.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 bg-muted rounded-full">
                {setting.icon}
              </div>
              <div>
                <Label htmlFor={setting.id} className="text-base font-medium cursor-pointer">
                  {setting.title}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {setting.description}
                </p>
              </div>
            </div>
            <Switch
              id={setting.id}
              checked={profile?.settings?.[setting.settingKey] ?? true}
              onCheckedChange={(checked) => handleToggle(setting.settingKey, checked)}
            />
          </div>
        ))}

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('notifications.important.title', 'Important Emails')}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('notifications.important.description', 'You\'ll always receive emails about account security, legal updates, and critical system notifications.')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};