// FILE: src/components/profile/BackgroundUploader.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Link2, X, Loader2, Image as ImageIcon, Check, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PendingUpload {
  file: File;
  localPreviewUrl: string;
}

export const BackgroundUploader: React.FC = () => {
  const { profile, setProfile } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Saved background from profile
  const [savedUrl, setSavedUrl] = useState(profile?.custom_background_url || '');
  
  // Pending states - preview before commit
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [pendingUrl, setPendingUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  
  // Loading states
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Current display URL (pending preview takes priority)
  const displayUrl = pendingUpload?.localPreviewUrl || pendingUrl || savedUrl;
  const hasPendingChanges = !!(pendingUpload || pendingUrl);

  // Sync savedUrl when profile changes
  useEffect(() => {
    if (profile?.custom_background_url !== undefined) {
      setSavedUrl(profile.custom_background_url || '');
    }
  }, [profile?.custom_background_url]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (pendingUpload?.localPreviewUrl) {
        URL.revokeObjectURL(pendingUpload.localPreviewUrl);
      }
    };
  }, [pendingUpload?.localPreviewUrl]);

  const validateImageUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Handle file selection - creates LOCAL preview only
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('background.invalidType', 'Please select an image file'));
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('background.tooLarge', 'Image must be less than 10MB'));
      return;
    }

    // Revoke old preview URL if exists
    if (pendingUpload?.localPreviewUrl) {
      URL.revokeObjectURL(pendingUpload.localPreviewUrl);
    }

    // Create local preview URL (no upload yet)
    const localPreviewUrl = URL.createObjectURL(file);
    
    // Clear any pending URL
    setPendingUrl('');
    setUrlInput('');
    
    // Set pending upload
    setPendingUpload({ file, localPreviewUrl });
    
    toast.info(t('background.previewReady', 'Preview ready - tap Save to apply'));
    
    // Reset file input for re-selection
    event.target.value = '';
  };

  // Handle URL preview - validates and shows preview
  const handleUrlPreview = async () => {
    if (!urlInput) return;

    if (!validateImageUrl(urlInput)) {
      toast.error(t('background.invalidUrl', 'Please enter a valid image URL'));
      return;
    }

    setUploading(true);

    try {
      // Test if image loads
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = urlInput;
      });

      // Clear any pending file upload
      if (pendingUpload?.localPreviewUrl) {
        URL.revokeObjectURL(pendingUpload.localPreviewUrl);
      }
      setPendingUpload(null);
      
      // Set pending URL
      setPendingUrl(urlInput);
      
      toast.info(t('background.previewReady', 'Preview ready - tap Save to apply'));
    } catch (error) {
      console.error('URL preview error:', error);
      toast.error(t('background.urlLoadFailed', 'Could not load image from URL'));
    } finally {
      setUploading(false);
    }
  };

  // Cancel pending changes
  const handleCancel = () => {
    if (pendingUpload?.localPreviewUrl) {
      URL.revokeObjectURL(pendingUpload.localPreviewUrl);
    }
    setPendingUpload(null);
    setPendingUrl('');
    setUrlInput('');
    toast.info(t('background.changesCanceled', 'Changes canceled'));
  };

  // Commit the pending changes - ACTUALLY uploads/saves
  const handleSave = async () => {
    if (!profile) return;
    
    setUploading(true);

    try {
      let newBackgroundUrl: string;

      if (pendingUpload) {
        // Upload file to Supabase Storage
        const file = pendingUpload.file;
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `bg-${Date.now()}.${fileExt}`;
        
        // User-isolated path: backgrounds/{userId}/{filename}
        const filePath = `backgrounds/${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-uploads')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-uploads')
          .getPublicUrl(filePath);

        newBackgroundUrl = urlData.publicUrl;
        
        // Cleanup local preview URL
        URL.revokeObjectURL(pendingUpload.localPreviewUrl);
        
      } else if (pendingUrl) {
        // Using external URL
        newBackgroundUrl = pendingUrl;
      } else {
        return; // Nothing to save
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ custom_background_url: newBackgroundUrl })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw new Error(`Failed to save: ${updateError.message}`);
      }

      // Delete old background from storage if it was a custom upload
      if (savedUrl && savedUrl.includes('user-uploads')) {
        try {
          const urlParts = savedUrl.split('/user-uploads/');
          if (urlParts[1]) {
            const oldPath = urlParts[1].split('?')[0];
            await supabase.storage.from('user-uploads').remove([oldPath]);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup old background:', cleanupError);
        }
      }

      // Update local state
      setProfile({ ...profile, custom_background_url: newBackgroundUrl });
      setSavedUrl(newBackgroundUrl);
      setPendingUpload(null);
      setPendingUrl('');
      setUrlInput('');
      
      toast.success(t('background.saved', 'Background saved!'));
      
    } catch (error: unknown) {
      console.error('Background save error:', error);
      const message = error instanceof Error ? error.message : t('background.saveFailed', 'Failed to save background');
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  // Remove background completely
  const handleRemove = async () => {
    if (!profile) return;

    setRemoving(true);

    try {
      // Remove from storage if it's a custom upload
      if (savedUrl && savedUrl.includes('user-uploads')) {
        try {
          const urlParts = savedUrl.split('/user-uploads/');
          if (urlParts[1]) {
            const filePath = urlParts[1].split('?')[0];
            await supabase.storage.from('user-uploads').remove([filePath]);
          }
        } catch (storageError) {
          console.warn('Storage cleanup error:', storageError);
        }
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({ custom_background_url: null })
        .eq('id', profile.id);

      if (error) throw error;

      // Clear all state
      if (pendingUpload?.localPreviewUrl) {
        URL.revokeObjectURL(pendingUpload.localPreviewUrl);
      }
      setProfile({ ...profile, custom_background_url: null });
      setSavedUrl('');
      setPendingUpload(null);
      setPendingUrl('');
      setUrlInput('');
      
      toast.success(t('background.removed', 'Background removed'));
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error(t('background.removeFailed', 'Failed to remove background'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t('background.title', 'Custom Background')}</span>
          {hasPendingChanges && (
            <span className="text-xs font-normal text-amber-500 animate-pulse">
              {t('background.unsaved', 'Unsaved changes')}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {t('background.description', 'Set a personal background image for the application')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Preview Area */}
        {displayUrl && (
          <div className="relative rounded-lg overflow-hidden border bg-muted">
            <img 
              src={displayUrl} 
              alt="Background preview" 
              className="w-full h-40 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '';
                toast.error(t('background.loadError', 'Failed to load image'));
              }}
            />
            
            {/* Overlay with actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                
                {/* Status badge */}
                <span className={`text-xs px-2 py-1 rounded-full ${
                  hasPendingChanges 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : 'bg-green-500/20 text-green-300 border border-green-500/30'
                }`}>
                  {hasPendingChanges 
                    ? t('background.preview', 'Preview') 
                    : t('background.active', 'Active')
                  }
                </span>

                {/* Action buttons */}
                <div className="flex gap-2">
                  {hasPendingChanges ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCancel}
                        disabled={uploading}
                        className="h-8"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {t('common.cancel', 'Cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={uploading}
                        className="h-8"
                      >
                        {uploading ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        {t('common.save', 'Save')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemove}
                      disabled={removing}
                      className="h-8"
                    >
                      {removing ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t('background.remove', 'Remove')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Methods */}
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="text-sm">
              <Upload className="mr-2 h-4 w-4" />
              {t('background.upload', 'Upload')}
            </TabsTrigger>
            <TabsTrigger value="url" className="text-sm">
              <Link2 className="mr-2 h-4 w-4" />
              {t('background.fromUrl', 'From URL')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-3 pt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <ImageIcon className="mr-2 h-5 w-5" />
              {t('background.selectImage', 'Select Image')}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {t('background.uploadHint', 'JPG, PNG, GIF or WebP • Max 10MB • Recommended 1920×1080+')}
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-3 pt-3">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={uploading}
                className="h-12"
              />
              <Button 
                onClick={handleUrlPreview}
                disabled={!urlInput || uploading}
                className="h-12 px-4"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t('background.preview', 'Preview')
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('background.urlHint', 'Enter a direct link to a publicly accessible image')}
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BackgroundUploader;