// FILE: src/components/messaging/MessageAttachment.tsx
// Displays message attachments with E2E encryption support
// Mobile-first design with progressive loading

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Image, File, Download, X, Loader2, ExternalLink, Lock, AlertCircle } from 'lucide-react';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import { useAuth } from '../../contexts/AuthContext';
import { decryptFileToUrl, fetchAndDecryptFile, type FileEncryptionMetadata } from '../../lib/encryption';

interface MessageAttachmentProps {
  url: string;
  type: 'image' | 'document' | 'other';
  name?: string;
  // Encryption metadata (if file is encrypted)
  encryptionMetadata?: FileEncryptionMetadata;
  // Legacy support - if true, file is not encrypted
  isEncrypted?: boolean;
}

export function MessageAttachment({ 
  url, 
  type, 
  name, 
  encryptionMetadata,
  isEncrypted = false 
}: MessageAttachmentProps) {
  const { user } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const { signedUrl, loading, error } = useSignedUrl(url);

  const fileName = name || encryptionMetadata?.originalName || url.split('/').pop() || 'attachment';
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = encryptionMetadata?.originalType || getMimeType(fileExtension, type);

  // Cleanup decrypted URLs on unmount
  useEffect(() => {
    return () => {
      if (decryptedUrl) {
        URL.revokeObjectURL(decryptedUrl);
      }
    };
  }, [decryptedUrl]);

  // Decrypt file when signed URL is available (for encrypted files)
  useEffect(() => {
    if (!signedUrl || !isEncrypted || !encryptionMetadata || !user?.id) {
      return;
    }

    let cancelled = false;
    
    const decrypt = async () => {
      setDecrypting(true);
      setDecryptError(null);
      setDownloadProgress(0);

      try {
        const { objectUrl } = await fetchAndDecryptFile(
          signedUrl,
          encryptionMetadata,
          user.id,
          (loaded, total) => {
            if (!cancelled) {
              setDownloadProgress(Math.round((loaded / total) * 100));
            }
          }
        );

        if (!cancelled) {
          setDecryptedUrl(objectUrl);
        }
      } catch (err: any) {
        console.error('Decryption failed:', err);
        if (!cancelled) {
          setDecryptError(err.message || 'Failed to decrypt file');
        }
      } finally {
        if (!cancelled) {
          setDecrypting(false);
        }
      }
    };

    decrypt();

    return () => {
      cancelled = true;
    };
  }, [signedUrl, isEncrypted, encryptionMetadata, user?.id]);

  // Get the display URL (decrypted for encrypted files, signed for legacy)
  const displayUrl = isEncrypted ? decryptedUrl : signedUrl;

  const getFileIcon = () => {
    if (type === 'image') return Image;
    if (type === 'document') return FileText;
    if (['pdf'].includes(fileExtension)) return FileText;
    if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) return FileText;
    return File;
  };

  const Icon = getFileIcon();

  // Handle download
  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!displayUrl) return;

    try {
      const response = await fetch(displayUrl);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [displayUrl, fileName]);

  // Loading state
  if (loading || decrypting) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <div className="flex-1">
          <span className="text-sm text-gray-400">
            {decrypting ? 'Decrypting...' : 'Loading...'}
          </span>
          {decrypting && downloadProgress > 0 && (
            <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
        </div>
        {isEncrypted && <Lock className="w-4 h-4 text-green-400" />}
      </div>
    );
  }

  // Error state
  if (error || decryptError || (!displayUrl && !loading)) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
        <AlertCircle className="w-5 h-5 text-red-400" />
        <div className="flex-1">
          <span className="text-sm text-red-400">Failed to load attachment</span>
          <p className="text-xs text-red-400/60 truncate">{decryptError || error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  // Image display
  if (type === 'image' && !imageError && displayUrl) {
    return (
      <>
        <div
          className="relative cursor-pointer group max-w-xs rounded-lg overflow-hidden border border-white/10"
          onClick={() => setShowPreview(true)}
        >
          <img
            src={displayUrl}
            alt={fileName}
            className="rounded-lg max-h-48 object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              <ExternalLink className="w-4 h-4" />
              <span>Click to preview</span>
            </div>
          </div>
          
          {/* Encryption indicator */}
          {isEncrypted && (
            <div className="absolute top-2 left-2 p-1.5 bg-green-500/80 rounded-full" title="End-to-end encrypted">
              <Lock className="w-3 h-3 text-white" />
            </div>
          )}
          
          {/* Download button */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDownload}
              className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fullscreen preview modal */}
        {showPreview && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setShowPreview(false)}
          >
            <button
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="absolute top-4 left-4 flex items-center gap-2 text-white/60 text-sm max-w-md">
              {isEncrypted && <Lock className="w-4 h-4 text-green-400" />}
              <span className="truncate">{fileName}</span>
            </div>

            <img
              src={displayUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Non-image file display
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors group">
      <div className="p-2 bg-blue-500/20 rounded-lg relative">
        <Icon className="w-6 h-6 text-blue-400" />
        {isEncrypted && (
          <div className="absolute -top-1 -right-1 p-0.5 bg-green-500 rounded-full">
            <Lock className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{fileName}</p>
        <p className="text-xs text-gray-400">
          {fileExtension.toUpperCase()} file
          {encryptionMetadata?.originalSize && (
            <span className="ml-1">• {formatFileSize(encryptionMetadata.originalSize)}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {displayUrl && (
          <>
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Helper: Get MIME type from extension
function getMimeType(extension: string, type: 'image' | 'document' | 'other'): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
  };
  
  return mimeTypes[extension] || (type === 'image' ? 'image/jpeg' : 'application/octet-stream');
}

// Helper: Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}