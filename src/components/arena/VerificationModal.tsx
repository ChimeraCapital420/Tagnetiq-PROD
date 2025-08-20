// FILE: src/components/arena/VerificationModal.tsx

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

interface VerificationModalProps {
  challengeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({ challengeId, isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = (acceptedFiles: File[]) => {
    setFile(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'image/*': [] },
  });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    toast.info("Uploading verification photo...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // 1. Get a signed URL from our new endpoint
      const signedUrlRes = await fetch('/api/arena/request-verification-upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            challengeId,
            fileName: file.name,
            fileType: file.type,
        }),
      });
      if (!signedUrlRes.ok) throw new Error('Could not get secure upload link.');
      const { token, signedURL, filePath } = await signedUrlRes.json();

      // 2. Upload the file directly to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('arena-verification-photos')
        .uploadToSignedUrl(filePath, token, file);
      if (uploadError) throw uploadError;

      // 3. Confirm the upload with our backend to update the database
      const completeRes = await fetch('/api/arena/complete-verification', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ challengeId, photoUrl: filePath }),
      });
      if (!completeRes.ok) throw new Error('Failed to finalize verification.');

      toast.success("Possession Verified!");
      onSuccess();
      onClose();

    } catch (error) {
      toast.error("Verification Failed", { description: (error as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Item Possession</DialogTitle>
          <DialogDescription>
            Take a photo of the item next to a piece of paper with your username and today's date written on it.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}>
            <input {...getInputProps()} />
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            {file ? (
              <p className="font-semibold">{file.name}</p>
            ) : isDragActive ? (
              <p>Drop the photo here...</p>
            ) : (
              <p>Drag & drop a photo, or click to select</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="mr-2 animate-spin" /> : <CheckCircle className="mr-2" />}
            {isUploading ? 'Verifying...' : 'Submit for Verification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};