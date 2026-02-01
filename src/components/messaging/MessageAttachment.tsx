// FILE: src/components/messaging/MessageAttachment.tsx
import React, { useState } from 'react';
import { FileText, Image, File, Download, X, Loader2, ExternalLink } from 'lucide-react';
import { useSignedUrl } from '../../hooks/useSignedUrl';

interface MessageAttachmentProps {
  url: string;
  type: 'image' | 'document' | 'other';
  name?: string;
}

export function MessageAttachment({ url, type, name }: MessageAttachmentProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { signedUrl, loading, error } = useSignedUrl(url, 'message-attachments');

  const fileName = name || url.split('/').pop() || 'attachment';
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

  const getFileIcon = () => {
    if (type === 'image') return Image;
    if (type === 'document') return FileText;
    if (['pdf'].includes(fileExtension)) return FileText;
    if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) return FileText;
    return File;
  };

  const Icon = getFileIcon();

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Loading attachment...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
        <File className="w-5 h-5 text-red-400" />
        <div className="flex-1">
          <span className="text-sm text-red-400">Failed to load attachment</span>
          <p className="text-xs text-red-400/60">{fileName}</p>
        </div>
      </div>
    );
  }

  if (type === 'image' && !imageError) {
    return (
      <React.Fragment>
        <div
          className="relative cursor-pointer group max-w-xs rounded-lg overflow-hidden border border-white/10"
          onClick={() => setShowPreview(true)}
        >
          <img
            src={signedUrl}
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
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            
              href={signedUrl}
              download={fileName}
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-black/60 hover:bg-black/80 rounded-full text-white"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>

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

            <div className="absolute top-4 left-4 text-white/60 text-sm max-w-md truncate">
              {fileName}
            </div>

            <img
              src={signedUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              
                href={signedUrl}
                download={fileName}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </a>
              
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open</span>
              </a>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors group">
      <div className="p-2 bg-blue-500/20 rounded-lg">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{fileName}</p>
        <p className="text-xs text-gray-400">{fileExtension.toUpperCase()} file</p>
      </div>
      <div className="flex items-center gap-1">
        
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        
          href={signedUrl}
          download={fileName}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          title="Download"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}