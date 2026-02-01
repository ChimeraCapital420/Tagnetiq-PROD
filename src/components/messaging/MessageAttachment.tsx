// FILE: src/components/messaging/MessageAttachment.tsx
// Display message attachments with signed URLs

import { useState } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { 
  FileText, 
  File, 
  Download, 
  Loader2, 
  AlertCircle,
  Maximize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageAttachmentProps {
  url: string;
  type?: string;
  name?: string;
  className?: string;
}

export function MessageAttachment({ 
  url, 
  type = '', 
  name = 'Attachment',
  className 
}: MessageAttachmentProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  
  // Extract path from full URL if needed
  const path = url.includes('message-attachments/') 
    ? url.split('message-attachments/')[1]
    : url;
  
  const { signedUrl, loading, error } = useSignedUrl(path);

  const isImage = type.startsWith('image/') || 
    /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isPdf = type === 'application/pdf' || url.endsWith('.pdf');

  const handleOpenFullscreen = () => setShowFullscreen(true);
  const handleCloseFullscreen = () => setShowFullscreen(false);

  if (loading) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4 bg-gray-800/50 rounded-lg",
        className
      )}>
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm",
        className
      )}>
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>Failed to load attachment</span>
      </div>
    );
  }

  // Image attachment
  if (isImage) {
    return (
      <>
        <button 
          type="button"
          className={cn(
            "relative group cursor-pointer rounded-lg overflow-hidden max-w-[280px] block",
            className
          )}
          onClick={handleOpenFullscreen}
        >
          <img 
            src={signedUrl} 
            alt={name}
            className="w-full h-auto rounded-lg"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        {showFullscreen && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={handleCloseFullscreen}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={handleCloseFullscreen}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={signedUrl} 
              alt={name}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
              href={signedUrl}
              download={name}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        )}
      </>
    );
  }

  // PDF attachment
  if (isPdf) {
    return (
      
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors",
          className
        )}
      >
        <div className="p-2 bg-red-500/20 rounded-lg">
          <FileText className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{name}</p>
          <p className="text-xs text-gray-500">PDF Document</p>
        </div>
        <Download className="w-4 h-4 text-gray-400" />
      </a>
    );
  }

  // Generic file attachment
  return (
    
      href={signedUrl}
      download={name}
      className={cn(
        "flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors",
        className
      )}
    >
      <div className="p-2 bg-gray-700 rounded-lg">
        <File className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{name}</p>
        <p className="text-xs text-gray-500">{type || 'File'}</p>
      </div>
      <Download className="w-4 h-4 text-gray-400" />
    </a>
  );
}