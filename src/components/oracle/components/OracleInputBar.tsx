// FILE: src/components/oracle/components/OracleInputBar.tsx
// Input field + camera + mic + send + conversation mode
// Mobile-first: camera uses device camera directly via capture="environment"
// Image compression done client-side to reduce server load

import React, { useRef, useState, useCallback } from 'react';
import { Send, Mic, MicOff, Loader2, X, Camera, Image, Eye, Crosshair, BookOpen, Brain, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisionMode, CameraCapture } from '../types';

interface Props {
  inputValue: string;
  isLoading: boolean;
  isListening: boolean;
  conversationMode: boolean;
  micSupported: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onVoice: () => void;
  onEndConversation: () => void;
  /** NEW: Send image for vision analysis */
  onSendImage?: (capture: CameraCapture, mode: VisionMode, question?: string) => void;
  /** NEW: Quick hunt triage (camera shortcut) */
  onSendHunt?: (capture: CameraCapture, askingPrice?: number) => void;
}

// Vision mode config
const VISION_MODES: Array<{ mode: VisionMode; icon: React.ReactNode; label: string; description: string }> = [
  { mode: 'glance',    icon: <Eye className="w-4 h-4" />,       label: 'Glance',   description: 'Quick — what is this?' },
  { mode: 'identify',  icon: <Crosshair className="w-4 h-4" />, label: 'Identify',  description: 'Deep ID + value estimate' },
  { mode: 'hunt_scan', icon: <ScanLine className="w-4 h-4" />,  label: 'Hunt',      description: 'BUY/SKIP instant triage' },
  { mode: 'read',      icon: <BookOpen className="w-4 h-4" />,  label: 'Read',      description: 'Read text from image' },
  { mode: 'remember',  icon: <Brain className="w-4 h-4" />,     label: 'Remember',  description: 'Store to visual memory' },
  { mode: 'room_scan', icon: <ScanLine className="w-4 h-4" />,  label: 'Room Scan', description: 'Scan whole room for items' },
];

export function OracleInputBar({
  inputValue, isLoading, isListening, conversationMode, micSupported,
  onInputChange, onSend, onVoice, onEndConversation, onSendImage, onSendHunt,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModes, setShowModes] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CameraCapture | null>(null);
  const [selectedMode, setSelectedMode] = useState<VisionMode>('glance');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // ── Handle camera/gallery capture ──────────────────────
  const handleCameraClick = useCallback(() => {
    if (selectedImage) {
      // Clear current image
      clearImage();
      return;
    }
    // Show mode selector, or directly open camera for speed
    setShowModes(prev => !prev);
  }, [selectedImage]);

  const triggerCapture = useCallback((mode: VisionMode) => {
    setSelectedMode(mode);
    setShowModes(false);
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const capture = await compressImage(file);
      setSelectedImage(capture);
      setImagePreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      console.error('[OracleInput] Image processing failed:', err);
    }

    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const clearImage = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(null);
    setImagePreviewUrl(null);
  }, [imagePreviewUrl]);

  // ── Send handler (text or image) ──────────────────────
  const handleSend = useCallback(() => {
    if (selectedImage && onSendImage) {
      // Send image with optional text question
      if (selectedMode === 'hunt_scan' && onSendHunt) {
        const askingPrice = extractPrice(inputValue);
        onSendHunt(selectedImage, askingPrice);
      } else {
        onSendImage(selectedImage, selectedMode, inputValue.trim() || undefined);
      }
      clearImage();
      onInputChange('');
      return;
    }

    if (inputValue.trim()) {
      onSend();
    }
  }, [selectedImage, selectedMode, inputValue, onSendImage, onSendHunt, onSend, clearImage, onInputChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasImageCapability = !!onSendImage;

  return (
    <div className="flex-none border-t border-border/50 bg-background/80 backdrop-blur-sm px-3 py-2 pb-[env(safe-area-inset-bottom,8px)]">
      {/* Hidden file input — uses device camera on mobile */}
      {hasImageCapability && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      )}

      {/* Vision mode selector */}
      {showModes && hasImageCapability && (
        <div className="mb-2 grid grid-cols-3 gap-1.5 animate-in slide-in-from-bottom-2 duration-200">
          {VISION_MODES.map(({ mode, icon, label, description }) => (
            <button
              key={mode}
              onClick={() => triggerCapture(mode)}
              className={cn(
                'flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs transition-all',
                'bg-accent/40 hover:bg-accent/70 active:scale-95',
                'border border-border/30',
              )}
            >
              <span className="text-primary">{icon}</span>
              <span className="font-medium">{label}</span>
              <span className="text-[10px] text-muted-foreground/70 leading-tight">{description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Image preview strip */}
      {selectedImage && imagePreviewUrl && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/30 animate-in slide-in-from-bottom-1 duration-150">
          <img
            src={imagePreviewUrl}
            alt="Captured"
            className="w-12 h-12 rounded-lg object-cover flex-none"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {VISION_MODES.find(m => m.mode === selectedMode)?.label || 'Vision'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {(selectedImage.sizeBytes / 1024).toFixed(0)}KB • {selectedImage.width}×{selectedImage.height}
            </p>
          </div>
          <button
            onClick={clearImage}
            className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-1.5">
        {/* Camera button */}
        {hasImageCapability && !conversationMode && (
          <button
            onClick={handleCameraClick}
            disabled={isLoading}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              selectedImage
                ? 'bg-primary/20 text-primary'
                : showModes
                  ? 'bg-accent/70 text-foreground'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent/60',
            )}
            aria-label={selectedImage ? 'Clear image' : 'Camera'}
          >
            {selectedImage ? (
              <Image className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Text input */}
        <div className="flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              conversationMode
                ? 'Conversation mode — just talk'
                : isListening
                ? 'Listening...'
                : selectedImage
                ? 'Add a question (optional)...'
                : 'Ask Oracle anything...'
            }
            disabled={isLoading || isListening || conversationMode}
            className={cn(
              'w-full px-4 py-2.5 rounded-full text-sm',
              'bg-accent/40 border border-border/50',
              'placeholder:text-muted-foreground/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
              'disabled:opacity-50',
              isListening && 'border-red-500/50 bg-red-500/10',
              conversationMode && 'border-red-500/30 bg-red-500/5',
              selectedImage && 'border-primary/30 bg-primary/5',
            )}
          />
        </div>

        {/* Mic button — hidden in conversation mode */}
        {micSupported && !conversationMode && !selectedImage && (
          <button
            onClick={onVoice}
            disabled={isLoading}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-accent/40 text-muted-foreground hover:bg-accent/60'
            )}
            aria-label={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Send button — hidden in conversation mode */}
        {!conversationMode && (
          <button
            onClick={handleSend}
            disabled={(!inputValue.trim() && !selectedImage) || isLoading}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              (inputValue.trim() || selectedImage) && !isLoading
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-accent/40 text-muted-foreground/40'
            )}
            aria-label="Send"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        )}

        {/* Stop button — only in conversation mode */}
        {conversationMode && (
          <button
            onClick={onEndConversation}
            className="flex-none w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-500/30"
            aria-label="End conversation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CLIENT-SIDE IMAGE COMPRESSION
// Reduces server load — device does the heavy lifting
// =============================================================================

async function compressImage(file: File, maxDim = 1024, quality = 0.8): Promise<CameraCapture> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Draw to canvas for compression
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64 JPEG (smaller than PNG for photos)
      const base64 = canvas.toDataURL('image/jpeg', quality);
      const sizeBytes = Math.round((base64.length - 'data:image/jpeg;base64,'.length) * 0.75);

      resolve({
        base64: base64.split(',')[1], // strip data URI prefix
        mimeType: 'image/jpeg',
        width,
        height,
        sizeBytes,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/** Extract a price from user input like "$25" or "asking 25" */
function extractPrice(text: string): number | undefined {
  const match = text.match(/\$?(\d+(?:\.\d{2})?)/);
  return match ? parseFloat(match[1]) : undefined;
}
