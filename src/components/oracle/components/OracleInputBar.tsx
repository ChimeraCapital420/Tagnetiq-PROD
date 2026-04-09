// FILE: src/components/oracle/components/OracleInputBar.tsx
// Oracle Input Bar — Media-first attachment system
//
// "+" opens a media picker bottom sheet:
//   📷 Camera      → vision mode sub-menu → device camera
//   🖼️  Gallery     → photo or video from library
//   📄 Document    → PDF, DOCX, TXT, CSV, JSON, MD
//   🔗 Web Link    → paste URL, Oracle fetches + analyzes
//
// Mobile-first:
//   - Images: compressed on device (canvas API)
//   - Videos: first-frame thumbnail extracted on device → see.ts
//   - Documents: text extracted on device → chat.ts
//   - URLs: server fetches (cross-origin blocked in browser)
//
// capture="environment" only on mobile — preserves desktop file picker

import React, {
  useRef, useState, useCallback, useMemo, useEffect,
} from 'react';
import {
  Send, Mic, MicOff, Loader2, X,
  Camera, Image as ImageIcon, FileText, Globe,
  Eye, Crosshair, BookOpen, Brain, ScanLine,
  Paperclip, Check, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  extractVideoThumbnail,
  getFileCategory,
  formatFileSize,
  getFileEmoji,
  isValidUrl,
} from '@/lib/oracle/ingest';
import type { VisionMode, CameraCapture } from '../types';

// =============================================================================
// TYPES
// =============================================================================

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
  /** Image / video vision analysis */
  onSendImage?: (capture: CameraCapture, mode: VisionMode, question?: string) => void;
  /** Quick hunt triage */
  onSendHunt?: (capture: CameraCapture, askingPrice?: number) => void;
  /** Document text analysis (PDF, DOCX, TXT…) */
  onSendDocument?: (file: File, question?: string) => void;
  /** Web URL analysis */
  onSendUrl?: (url: string, question?: string) => void;
}

// =============================================================================
// VISION MODES
// =============================================================================

const VISION_MODES: Array<{
  mode: VisionMode;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = [
  { mode: 'glance',    icon: <Eye className="w-4 h-4" />,       label: 'Glance',    description: 'Quick — what is this?' },
  { mode: 'identify',  icon: <Crosshair className="w-4 h-4" />, label: 'Identify',  description: 'Deep ID + value estimate' },
  { mode: 'hunt_scan', icon: <ScanLine className="w-4 h-4" />,  label: 'Hunt',      description: 'BUY/SKIP instant triage' },
  { mode: 'read',      icon: <BookOpen className="w-4 h-4" />,  label: 'Read',      description: 'Read text from image' },
  { mode: 'remember',  icon: <Brain className="w-4 h-4" />,     label: 'Remember',  description: 'Store to visual memory' },
  { mode: 'room_scan', icon: <ScanLine className="w-4 h-4" />,  label: 'Room Scan', description: 'Scan whole room' },
];

// =============================================================================
// DEVICE DETECTION
// =============================================================================

const isMobile = typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// =============================================================================
// DOCUMENT ACCEPT STRING
// =============================================================================

const DOCUMENT_ACCEPT = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  '.pdf', '.docx', '.txt', '.csv', '.md', '.json', '.xml', '.yaml', '.yml', '.tsv',
].join(',');

// =============================================================================
// COMPONENT
// =============================================================================

export function OracleInputBar({
  inputValue, isLoading, isListening, conversationMode, micSupported,
  onInputChange, onSend, onVoice, onEndConversation,
  onSendImage, onSendHunt, onSendDocument, onSendUrl,
}: Props) {

  // ── File input refs (3 separate — different accept/capture attributes) ──
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef     = useRef<HTMLInputElement>(null);

  // ── Picker state ─────────────────────────────────────────────────────
  const [showMediaPicker, setShowMediaPicker]   = useState(false);
  const [showVisionModes, setShowVisionModes]   = useState(false);
  const [showUrlEntry,    setShowUrlEntry]       = useState(false);

  // ── Image attachment ──────────────────────────────────────────────────
  const [selectedImage,    setSelectedImage]    = useState<CameraCapture | null>(null);
  const [imagePreviewUrl,  setImagePreviewUrl]  = useState<string | null>(null);
  const [selectedMode,     setSelectedMode]     = useState<VisionMode>('glance');

  // ── Document attachment ───────────────────────────────────────────────
  const [selectedDoc,      setSelectedDoc]      = useState<File | null>(null);
  const [docError,         setDocError]         = useState<string | null>(null);

  // ── URL attachment ────────────────────────────────────────────────────
  const [urlValue,         setUrlValue]         = useState('');
  const urlValid = useMemo(() => isValidUrl(urlValue.trim()), [urlValue]);

  // ── Processing ────────────────────────────────────────────────────────
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────
  const hasAnyAttachment = !!selectedImage || !!selectedDoc || (showUrlEntry && urlValid);
  const hasCapability    = !!(onSendImage || onSendDocument || onSendUrl);

  const canSend = !isLoading && !isProcessingMedia && (
    (!hasAnyAttachment && inputValue.trim().length > 0) ||
    !!selectedImage ||
    !!selectedDoc ||
    (showUrlEntry && urlValid)
  );

  // ── Auto-focus URL input when shown ──────────────────────────────────
  useEffect(() => {
    if (showUrlEntry) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [showUrlEntry]);

  // ── Clear all attachments ─────────────────────────────────────────────
  const clearAll = useCallback(() => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(null);
    setImagePreviewUrl(null);
    setSelectedDoc(null);
    setDocError(null);
    setUrlValue('');
    setShowUrlEntry(false);
    setShowVisionModes(false);
    setShowMediaPicker(false);
  }, [imagePreviewUrl]);

  // ── Media picker option tap ───────────────────────────────────────────
  const handlePickerOption = useCallback((option: 'camera' | 'gallery' | 'document' | 'link') => {
    setShowMediaPicker(false);

    switch (option) {
      case 'camera':
        if (onSendImage) setShowVisionModes(true);
        break;
      case 'gallery':
        setTimeout(() => galleryInputRef.current?.click(), 50);
        break;
      case 'document':
        if (onSendDocument) setTimeout(() => documentInputRef.current?.click(), 50);
        break;
      case 'link':
        if (onSendUrl) setShowUrlEntry(true);
        break;
    }
  }, [onSendImage, onSendDocument, onSendUrl]);

  // ── Vision mode selected → trigger camera ────────────────────────────
  const handleVisionModeSelect = useCallback((mode: VisionMode) => {
    setSelectedMode(mode);
    setShowVisionModes(false);
    setTimeout(() => cameraInputRef.current?.click(), 50);
  }, []);

  // ── Camera / gallery file selected ───────────────────────────────────
  const handleMediaFileChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (e.target) e.target.value = '';

    const category = getFileCategory(file);

    if (category === 'image') {
      setIsProcessingMedia(true);
      try {
        const capture = await compressImageFile(file);
        setSelectedImage(capture);
        setImagePreviewUrl(URL.createObjectURL(file));
      } catch (err: any) {
        console.error('[OracleInputBar] Image compress failed:', err);
        alert('Could not process that image. Try a different photo.');
      } finally {
        setIsProcessingMedia(false);
      }
      return;
    }

    if (category === 'video') {
      if (!onSendImage) return; // Videos route through image pipeline via thumbnail
      setIsProcessingMedia(true);
      try {
        const extracted = await extractVideoThumbnail(file);
        const capture: CameraCapture = {
          base64: extracted.thumbnailBase64,
          mimeType: 'image/jpeg',
          width: extracted.width,
          height: extracted.height,
          sizeBytes: Math.round(extracted.thumbnailBase64.length * 0.75),
        };
        setSelectedImage(capture);
        // Show video thumbnail as preview
        const dataUrl = `data:image/jpeg;base64,${extracted.thumbnailBase64}`;
        setImagePreviewUrl(dataUrl);
        setSelectedMode('glance'); // Videos default to glance mode
      } catch (err: any) {
        console.error('[OracleInputBar] Video thumb failed:', err);
        alert(err.message || 'Could not extract video preview.');
      } finally {
        setIsProcessingMedia(false);
      }
      return;
    }

    alert('Select an image or video from your gallery.');
  }, [onSendImage]);

  // ── Document file selected ────────────────────────────────────────────
  const handleDocumentFileChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    setDocError(null);
    const category = getFileCategory(file);

    if (category !== 'document') {
      setDocError('Unsupported file. Try PDF, DOCX, TXT, or CSV.');
      return;
    }

    // Max 25 MB for documents
    if (file.size > 25 * 1024 * 1024) {
      setDocError('File too large. Maximum 25 MB.');
      return;
    }

    setSelectedDoc(file);
  }, []);

  // ── Main send handler ─────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!canSend) return;

    // Image / video thumbnail → see.ts
    if (selectedImage && onSendImage) {
      if (selectedMode === 'hunt_scan' && onSendHunt) {
        onSendHunt(selectedImage, extractPrice(inputValue) || undefined);
      } else {
        onSendImage(selectedImage, selectedMode, inputValue.trim() || undefined);
      }
      clearAll();
      onInputChange('');
      return;
    }

    // Document → ingest → chat.ts
    if (selectedDoc && onSendDocument) {
      onSendDocument(selectedDoc, inputValue.trim() || undefined);
      clearAll();
      onInputChange('');
      return;
    }

    // URL → ingest.ts → chat.ts
    if (showUrlEntry && urlValid && onSendUrl) {
      onSendUrl(urlValue.trim(), inputValue.trim() || undefined);
      clearAll();
      onInputChange('');
      return;
    }

    // Plain text
    if (inputValue.trim()) {
      onSend();
    }
  }, [
    canSend, selectedImage, selectedDoc, showUrlEntry, urlValid, urlValue,
    selectedMode, inputValue, onSendImage, onSendHunt, onSendDocument, onSendUrl,
    onSend, clearAll, onInputChange,
  ]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && urlValid) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') clearAll();
  }, [urlValid, handleSend, clearAll]);

  // ── Attachment previews ───────────────────────────────────────────────

  const imageModeLabel = VISION_MODES.find(m => m.mode === selectedMode)?.label ?? 'Vision';

  const inputPlaceholder = conversationMode
    ? 'Conversation mode — just talk'
    : isListening
    ? 'Listening...'
    : selectedImage
    ? 'Add a question (optional)...'
    : selectedDoc
    ? 'Ask about this document (optional)...'
    : showUrlEntry && urlValid
    ? 'Ask about this page (optional)...'
    : 'Ask Oracle anything...';

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="flex-none border-t border-border/50 bg-background/80 backdrop-blur-sm px-3 py-2 pb-[env(safe-area-inset-bottom,8px)]">

      {/* ── Hidden file inputs ─────────────────────────────────────── */}
      {/* Camera — capture="environment" on mobile only */}
      {onSendImage && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          {...(isMobile ? { capture: 'environment' } : {})}
          onChange={handleMediaFileChange}
          className="hidden"
          aria-hidden
        />
      )}
      {/* Gallery — photo + video, no capture attribute */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaFileChange}
        className="hidden"
        aria-hidden
      />
      {/* Documents */}
      {onSendDocument && (
        <input
          ref={documentInputRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          onChange={handleDocumentFileChange}
          className="hidden"
          aria-hidden
        />
      )}

      {/* ── Media Picker Sheet ─────────────────────────────────────── */}
      {showMediaPicker && !conversationMode && (
        <div className="mb-2 grid grid-cols-2 gap-1.5 animate-in slide-in-from-bottom-2 duration-200">
          {([
            {
              id: 'camera' as const,
              icon: <Camera className="w-5 h-5" />,
              label: 'Camera',
              desc: 'Take a photo',
              enabled: !!onSendImage,
            },
            {
              id: 'gallery' as const,
              icon: <ImageIcon className="w-5 h-5" />,
              label: 'Gallery',
              desc: 'Photos & video',
              enabled: true,
            },
            {
              id: 'document' as const,
              icon: <FileText className="w-5 h-5" />,
              label: 'Document',
              desc: 'PDF, Word, text',
              enabled: !!onSendDocument,
            },
            {
              id: 'link' as const,
              icon: <Globe className="w-5 h-5" />,
              label: 'Web Link',
              desc: 'URL or article',
              enabled: !!onSendUrl,
            },
          ] as const).filter(o => o.enabled).map(({ id, icon, label, desc }) => (
            <button
              key={id}
              onClick={() => handlePickerOption(id)}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                'bg-accent/40 hover:bg-accent/70 active:scale-95',
                'border border-border/30',
              )}
            >
              <span className="text-primary flex-none">{icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="text-[10px] text-muted-foreground/70">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Vision Mode Sub-Sheet ──────────────────────────────────── */}
      {showVisionModes && !conversationMode && (
        <div className="mb-2 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Vision Mode
            </p>
            <button
              onClick={() => setShowVisionModes(false)}
              className="text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {VISION_MODES.map(({ mode, icon, label, description }) => (
              <button
                key={mode}
                onClick={() => handleVisionModeSelect(mode)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs transition-all',
                  'bg-accent/40 hover:bg-accent/70 active:scale-95',
                  'border border-border/30',
                )}
              >
                <span className="text-primary">{icon}</span>
                <span className="font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground/70 leading-tight text-center">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── URL Entry Strip ────────────────────────────────────────── */}
      {showUrlEntry && !selectedImage && !selectedDoc && (
        <div className="mb-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-xl border transition-colors',
            urlValid
              ? 'bg-primary/5 border-primary/30'
              : 'bg-accent/30 border-border/30',
          )}>
            <Globe className="w-4 h-4 text-muted-foreground flex-none" />
            <input
              ref={urlInputRef}
              type="url"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-w-0"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {urlValid && (
              <Check className="w-4 h-4 text-emerald-400 flex-none" />
            )}
            <button
              onClick={clearAll}
              className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {urlValue && !urlValid && (
            <p className="text-[10px] text-muted-foreground/60 px-2 pt-0.5 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Enter a full URL starting with https://
            </p>
          )}
          {urlValid && (
            <p className="text-[10px] text-emerald-500/70 px-2 pt-0.5">
              {(() => { try { return new URL(urlValue).hostname.replace(/^www\./, ''); } catch { return ''; } })()}
            </p>
          )}
        </div>
      )}

      {/* ── Image Preview Strip ────────────────────────────────────── */}
      {selectedImage && imagePreviewUrl && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/30 animate-in slide-in-from-bottom-1 duration-150">
          <img
            src={imagePreviewUrl}
            alt="Preview"
            className="w-12 h-12 rounded-lg object-cover flex-none"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{imageModeLabel}</p>
            <p className="text-[10px] text-muted-foreground">
              {(selectedImage.sizeBytes / 1024).toFixed(0)} KB
              {' · '}{selectedImage.width}×{selectedImage.height}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowVisionModes(true)}
              className="text-[10px] px-2 py-1 rounded-lg bg-accent/50 hover:bg-accent/80 transition-colors text-muted-foreground"
            >
              Change
            </button>
            <button
              onClick={clearAll}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Document Preview Strip ─────────────────────────────────── */}
      {selectedDoc && (
        <div className="mb-2 flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/30 animate-in slide-in-from-bottom-1 duration-150">
          <div className="w-12 h-12 rounded-lg bg-accent/60 flex items-center justify-center text-2xl flex-none">
            {getFileEmoji(selectedDoc)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedDoc.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatFileSize(selectedDoc.size)}
              {' · '}
              {selectedDoc.name.split('.').pop()?.toUpperCase()}
            </p>
            {docError && (
              <p className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5">
                <AlertCircle className="w-3 h-3" />
                {docError}
              </p>
            )}
          </div>
          <button
            onClick={clearAll}
            className="flex-none w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Main Input Row ─────────────────────────────────────────── */}
      <div className="flex items-end gap-1.5">

        {/* Attachment button — opens media picker */}
        {hasCapability && !conversationMode && (
          <button
            onClick={() => {
              if (hasAnyAttachment) {
                clearAll();
              } else {
                setShowMediaPicker(prev => !prev);
                setShowVisionModes(false);
              }
            }}
            disabled={isLoading || isProcessingMedia}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              hasAnyAttachment
                ? 'bg-primary/20 text-primary'
                : showMediaPicker || showVisionModes
                ? 'bg-accent/70 text-foreground'
                : 'bg-accent/40 text-muted-foreground hover:bg-accent/60',
            )}
            aria-label={hasAnyAttachment ? 'Clear attachment' : 'Attach media'}
          >
            {isProcessingMedia
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : hasAnyAttachment
              ? <Paperclip className="w-4 h-4" />
              : <Paperclip className="w-4 h-4" />
            }
          </button>
        )}

        {/* Text input */}
        <div className="flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={inputPlaceholder}
            disabled={isLoading || isListening || conversationMode}
            className={cn(
              'w-full px-4 py-2.5 rounded-full text-sm',
              'bg-accent/40 border border-border/50',
              'placeholder:text-muted-foreground/60',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
              'disabled:opacity-50',
              isListening    && 'border-red-500/50 bg-red-500/10',
              conversationMode && 'border-red-500/30 bg-red-500/5',
              hasAnyAttachment && 'border-primary/30 bg-primary/5',
            )}
          />
        </div>

        {/* Mic — hidden when conversation mode or attachment selected */}
        {micSupported && !conversationMode && !hasAnyAttachment && (
          <button
            onClick={onVoice}
            disabled={isLoading}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-accent/40 text-muted-foreground hover:bg-accent/60',
            )}
            aria-label={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}

        {/* Send */}
        {!conversationMode && (
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              canSend
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-accent/40 text-muted-foreground/40',
            )}
            aria-label="Send"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        )}

        {/* End conversation mode */}
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
// =============================================================================

async function compressImageFile(
  file: File,
  maxDim = 1024,
  quality = 0.80,
): Promise<CameraCapture> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(url);

        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }

        ctx.imageSmoothingEnabled  = true;
        ctx.imageSmoothingQuality  = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const base64    = canvas.toDataURL('image/jpeg', quality);
        const sizeBytes = Math.round((base64.length - 'data:image/jpeg;base64,'.length) * 0.75);

        resolve({
          base64: base64.split(',')[1],
          mimeType: 'image/jpeg',
          width,
          height,
          sizeBytes,
        });
      } catch (err) {
        reject(err);
      }
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

function extractPrice(text: string): number | undefined {
  const m = text.match(/\$?(\d+(?:\.\d{2})?)/);
  return m ? parseFloat(m[1]) : undefined;
}