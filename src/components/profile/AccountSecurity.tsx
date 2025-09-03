// FILE: src/components/profile/AccountSecurity.tsx

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Key, Smartphone, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const AccountSecurity: React.FC = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error(t('security.password.mismatch', 'New passwords do not match'));
      return;
    }

    if (passwords.new.length < 8) {
      toast.error(t('security.password.tooShort', 'Password must be at least 8 characters'));
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;

      toast.success(t('security.password.updated', 'Password updated successfully'));
      setIsPasswordDialogOpen(false);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error('Password update error:', error);
      toast.error(t('security.password.updateFailed', 'Failed to update password'));
    } finally {
      setIsUpdating(false);
    }
  };

  const handle2FAToggle = async () => {
    // Placeholder for 2FA implementation
    toast.info(t('security.2fa.comingSoon', '2FA coming soon'));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('security.title', 'Security Settings')}</CardTitle>
          <CardDescription>{t('security.description', 'Manage your account security')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Key className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('security.password.title', 'Password')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('security.password.lastChanged', 'Last changed')}: {t('security.password.never', 'Never')}
                  </p>
                </div>
              </div>
              
              <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">{t('security.password.change', 'Change Password')}</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('security.password.changeTitle', 'Change Password')}</DialogTitle>
                    <DialogDescription>
                      {t('security.password.changeDescription', 'Enter your current password and choose a new one')}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">{t('security.password.current', 'Current Password')}</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwords.current}
                        onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{t('security.password.new', 'New Password')}</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwords.new}
                        onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{t('security.password.confirm', 'Confirm New Password')}</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPasswordDialogOpen(false)}
                      disabled={isUpdating}
                    >
                      {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handlePasswordChange} disabled={isUpdating}>
                      {t('security.password.update', 'Update Password')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{t('security.2fa.title', 'Two-Factor Authentication')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('security.2fa.description', 'Add an extra layer of security')}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handle2FAToggle}>
                {t('security.2fa.enable', 'Enable 2FA')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('security.sessions.title', 'Active Sessions')}</CardTitle>
          <CardDescription>{t('security.sessions.description', 'Devices currently logged into your account')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-4">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{t('security.sessions.current', 'Current Session')}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date().toLocaleString()} • {navigator.userAgent.substring(0, 50)}...
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-4 border border-dashed rounded-lg">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('security.sessions.noOther', 'No other active sessions')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">{t('security.danger.title', 'Danger Zone')}</CardTitle>
          </div>
          <CardDescription>{t('security.danger.description', 'Irreversible account actions')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            {t('security.danger.delete', 'Delete Account')}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {t('security.danger.deleteInfo', 'Account deletion is not available during beta')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};