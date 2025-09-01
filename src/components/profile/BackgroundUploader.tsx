// FILE: src/components/profile/BackgroundUploader.tsx

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

export const BackgroundUploader: React.FC = () => {
  const { profile, setProfile, session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setIsUploading(true);
    const toastId = toast.loading('Uploading custom background...');

    try {
      if (!session) throw new Error("Not authenticated");
      
      const signedUrlResponse = await fetch('/api/user/background-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });

      if (!signedUrlResponse.ok) throw new Error('Could not get upload URL.');
      const { token, filePath } = await signedUrlResponse.json();
      
      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .uploadToSignedUrl(filePath, token, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(filePath);

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ custom_background_url: publicUrlData.publicUrl })
        .eq('id', profile.id)
        .select()
        .single();
      
      if (profileError) throw profileError;
      
      setProfile(updatedProfile);
      toast.success('Custom background updated!', { id: toastId });
    } catch (error) {
      toast.error('Upload failed', { id: toastId, description: (error as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="background-upload">Custom Background Image</Label>
      <Button asChild variant="outline" className="w-full">
        <label htmlFor="background-upload-input" className="cursor-pointer">
          {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <Upload className="mr-2" />}
          {isUploading ? 'Uploading...' : 'Upload Image'}
          <input id="background-upload-input" type="file" onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
        </label>
      </Button>
    </div>
  );
};