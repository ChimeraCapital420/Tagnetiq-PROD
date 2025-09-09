// FILE: src/components/profile/AvatarUploader.tsx

import React, { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const AvatarUploader: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('avatar.invalidType', 'Please select an image file'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error(t('avatar.tooLarge', 'Image must be less than 5MB'));
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success(t('avatar.uploaded', 'Avatar updated successfully'));

      // Clean up old avatar if exists
      if (profile.avatar_url && profile.avatar_url.includes('user-uploads')) {
        const oldPath = profile.avatar_url.split('/').slice(-3).join('/');
        await supabase.storage.from('user-uploads').remove([oldPath]);
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(t('avatar.uploadFailed', 'Failed to upload avatar'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;

    setUploading(true);

    try {
      // Remove from storage if it's a custom upload
      if (profile.avatar_url.includes('user-uploads')) {
        const filePath = profile.avatar_url.split('/').slice(-3).join('/');
        await supabase.storage.from('user-uploads').remove([filePath]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      if (error) throw error;

      // Update local state
      setProfile({ ...profile, avatar_url: null });
      toast.success(t('avatar.removed', 'Avatar removed successfully'));
    } catch (error) {
      console.error('Avatar removal error:', error);
      toast.error(t('avatar.removeFailed', 'Failed to remove avatar'));
    } finally {
      setUploading(false);
      setShowDeleteDialog(false);
    }
  };

  const getInitials = () => {
    if (!profile?.email) return '?';
    return profile.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative group">
        <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
          <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.email} />
          <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/60 rounded-full p-2">
            {uploading ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {t('avatar.upload', 'Upload Photo')}
        </Button>
        
        {profile?.avatar_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={uploading}
          >
            <X className="mr-2 h-4 w-4" />
            {t('avatar.remove', 'Remove')}
          </Button>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('avatar.removeTitle', 'Remove Avatar?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('avatar.removeDescription', 'This will remove your custom avatar and return to the default.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAvatar}>
              {t('common.remove', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground text-center">
        {t('avatar.requirements', 'JPG, PNG or GIF. Max size 5MB.')}
      </p>
    </div>
  );
};