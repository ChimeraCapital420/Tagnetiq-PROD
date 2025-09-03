// FILE: src/components/profile/BackgroundUploader.tsx

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Link2, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const BackgroundUploader: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState(profile?.custom_background_url || '');

  const validateImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error(t('background.invalidType', 'Please select an image file'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit for backgrounds
      toast.error(t('background.tooLarge', 'Image must be less than 10MB'));
      return;
    }

    setUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-bg-${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

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
        .update({ custom_background_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile({ ...profile, custom_background_url: publicUrl });
      setPreviewUrl(publicUrl);
      toast.success(t('background.uploaded', 'Background updated successfully'));

      // Clean up old background if exists
      if (profile.custom_background_url && profile.custom_background_url.includes('user-uploads')) {
        const oldPath = profile.custom_background_url.split('/').slice(-2).join('/');
        await supabase.storage.from('user-uploads').remove([oldPath]);
      }
    } catch (error) {
      console.error('Background upload error:', error);
      toast.error(t('background.uploadFailed', 'Failed to upload background'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = async () => {
    if (!imageUrl || !profile) return;

    if (!validateImageUrl(imageUrl)) {
      toast.error(t('background.invalidUrl', 'Please enter a valid image URL'));
      return;
    }

    setUploading(true);

    try {
      // Test if image loads
      const img = new Image();
      img.onerror = () => {
        throw new Error('Failed to load image');
      };
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ custom_background_url: imageUrl })
        .eq('id', profile.id);

      if (error) throw error;

      // Clean up old uploaded background if switching from upload to URL
      if (profile.custom_background_url && profile.custom_background_url.includes('user-uploads')) {
        const oldPath = profile.custom_background_url.split('/').slice(-2).join('/');
        await supabase.storage.from('user-uploads').remove([oldPath]);
      }

      // Update local state
      setProfile({ ...profile, custom_background_url: imageUrl });
      setPreviewUrl(imageUrl);
      setImageUrl('');
      toast.success(t('background.updated', 'Background updated successfully'));
    } catch (error) {
      console.error('Background URL error:', error);
      toast.error(t('background.urlFailed', 'Failed to set background from URL'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!profile) return;

    setUploading(true);

    try {
      // Remove from storage if it's a custom upload
      if (profile.custom_background_url?.includes('user-uploads')) {
        const filePath = profile.custom_background_url.split('/').slice(-2).join('/');
        await supabase.storage.from('user-uploads').remove([filePath]);
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ custom_background_url: null })
        .eq('id', profile.id);

      if (error) throw error;

      // Update local state
      setProfile({ ...profile, custom_background_url: null });
      setPreviewUrl('');
      toast.success(t('background.removed', 'Custom background removed'));
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error(t('background.removeFailed', 'Failed to remove background'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('background.title', 'Custom Background')}</CardTitle>
        <CardDescription>
          {t('background.description', 'Set a personal background image for the application')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl && (
          <div className="relative group rounded-lg overflow-hidden border">
            <img 
              src={previewUrl} 
              alt="Background preview" 
              className="w-full h-32 object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRemoveBackground}
                disabled={uploading}
              >
                <X className="mr-2 h-4 w-4" />
                {t('background.remove', 'Remove Background')}
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              {t('background.upload', 'Upload')}
            </TabsTrigger>
            <TabsTrigger value="url">
              <Link2 className="mr-2 h-4 w-4" />
              {t('background.fromUrl', 'From URL')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="mr-2 h-4 w-4" />
              )}
              {t('background.selectImage', 'Select Image')}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {t('background.uploadRequirements', 'JPG, PNG or GIF. Max size 10MB. Recommended: 1920x1080 or higher.')}
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="image-url">{t('background.imageUrl', 'Image URL')}</Label>
              <div className="flex gap-2">
                <Input
                  id="image-url"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  disabled={uploading}
                />
                <Button 
                  onClick={handleUrlSubmit}
                  disabled={!imageUrl || uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('common.apply', 'Apply')
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('background.urlRequirements', 'Enter a direct link to an image. The image must be publicly accessible.')}
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};