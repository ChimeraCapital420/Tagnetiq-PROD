// FILE: src/components/profile/AvatarUploader.tsx

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { User, Edit, Loader2 } from 'lucide-react';

export const AvatarUploader: React.FC = () => {
  const { profile, setProfile, session } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setIsUploading(true);
    const toastId = toast.loading('Uploading avatar...');

    try {
      if (!session) throw new Error("Not authenticated");
      
      const signedUrlResponse = await fetch('/api/user/avatar-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });

      if (!signedUrlResponse.ok) throw new Error('Could not get upload URL.');
      const { token, signedURL, filePath } = await signedUrlResponse.json();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .uploadToSignedUrl(filePath, token, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrlData.publicUrl })
        .eq('id', profile.id)
        .select()
        .single();
      
      if (profileError) throw profileError;

      setProfile(updatedProfile);
      toast.success('Avatar updated successfully!', { id: toastId });

    } catch (error) {
      toast.error('Upload failed', { id: toastId, description: (error as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2);
    }
    return profile?.email?.[0].toUpperCase() || '?';
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="h-24 w-24">
          <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || 'User Avatar'} />
          <AvatarFallback className="text-3xl"><User size={40} /></AvatarFallback>
        </Avatar>
        <Button 
          size="icon" 
          className="absolute bottom-0 right-0 rounded-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="animate-spin" /> : <Edit size={16} />}
        </Button>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept="image/png, image/jpeg"
      />
      <div className="text-center">
        <p className="font-semibold text-lg">{profile?.full_name || profile?.screen_name}</p>
        <p className="text-sm text-muted-foreground">{profile?.email}</p>
      </div>
    </div>
  );
};