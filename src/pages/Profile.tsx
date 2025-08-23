// FILE: src/pages/Profile.tsx

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const ProfilePage: React.FC = () => {
  const { user, profile, setProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      });
      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || 'Failed to update profile.');
      }
      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Update Failed', { description: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    // Handle password update logic here
    toast.info('Password update functionality is not yet implemented.');
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password here.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit">Update Password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;