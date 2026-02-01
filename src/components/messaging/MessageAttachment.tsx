// FILE: src/components/messaging/MessageAttachment.tsx
import React, { useState } from 'react';
import { FileText, File, Download, X, Loader2 } from 'lucide-react';
import { useSignedUrl } from '../../hooks/useSignedUrl';

interface MessageAttachmentProps {
  url: string;
  type: 'image' | 'document' | 'other';
  name?: string;
}

export function MessageAttachment({ url, type, name }: MessageAttachmentProps) {
  const [showPreview, setShowPreview] = useState(false);
  const { signedUrl, loading, error } = useSignedUrl(url, 'message-attachments');
  const fileName = name || url.split('/').pop() || 'attachment';

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        <span className="text-sm text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-lg">
        <File className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-400">Failed to load</span>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <React.Fragment>
        <div className="relative cursor-pointer group max-w-xs" onClick={() => setShowPreview(true)}>
          <img src={signedUrl} alt={fileName} className="rounded-lg max-h-48 object-cover" />
        </div>
        {showPreview && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
            <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
            <img src={signedUrl} alt={fileName} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
            <a href={signedUrl} download={fileName} onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white">
              <Download className="w-4 h-4" />
              <span>Download</span>
            </a>
          </div>
        )}
      </React.Fragment>
    );
  }

  const Icon = type === 'document' ? FileText : File;

  return (
    <a href={signedUrl} download={fileName} className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
      <Icon className="w-8 h-8 text-blue-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{fileName}</p>
        <p className="text-xs text-gray-400">Click to download</p>
      </div>
      <Download className="w-4 h-4 text-gray-400" />
    </a>
  );
}