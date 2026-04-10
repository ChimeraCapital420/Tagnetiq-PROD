// FILE: src/features/boardroom/components/ChatInput.tsx
// Board Chat Input — Media-aware attachment system
//
// v2.0 — Full media intelligence bar
//   📎 "+" opens picker:
//     📄 Document → PDF, DOCX, TXT extracted client-side
//     🌐 Web Link → domain-filtered research via Perplexity sonar-pro
//     📷 Camera  → device camera → GPT-4o board vision analysis
//     🖼️ Gallery → photo picker → GPT-4o board vision analysis
//
//   Each attachment shows a preview strip before sending.
//   Board member context passed to ingest so URL research and image
//   vision are domain-filtered (CFO gets financial lens, etc.).
//
// v2.1: Camera and Gallery enabled via processImage() Option B pipeline
//   Image → GPT-4o vision → structured board analysis (financial signals,
//   legal signals, technical signals, risk flags, questions for the board)
//   → each member applies their domain lens via Layer 10
//
//   Context input: after selecting an image, user can optionally add a
//   note before it's analyzed — "this is the contract clause I'm concerned
//   about" helps GPT-4o focus the analysis correctly.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Mic, MicOff, Paperclip, Loader2, X,
  StopCircle, FileText, Globe, Camera,
  AlertCircle, Check, Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useBoardroomIngest } from '../hooks/useBoardroomIngest';
import { cn } from '@/lib/utils';
import {
  getFileCategory,
  formatFileSize,
  getFileEmoji,
  isValidUrl,
} from '@/lib/oracle/ingest';
import type { MediaAttachment } from '../../../../api/boardroom/lib/prompt-builder/media-context.js';
import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ChatInputProps {
  onSend: (message: string, mediaAttachments?: MediaAttachment[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  activeMember?: BoardMember | null;
  onVoiceModeToggle?: (enabled: boolean) => void;
  className?: string;
}

// =============================================================================
// DOCUMENT ACCEPT
// =============================================================================

const DOCUMENT_ACCEPT = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain', 'text/csv', 'text/markdown', 'application/json',
  '.pdf', '.docx', '.txt', '.csv', '.md', '.json',
].join(',');

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp';

// =============================================================================
// COMPONENT
// =============================================================================

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  placeholder = "Ask your board of advisors...",
  disabled = false,
  isLoading = false,
  activeMember,
  onVoiceModeToggle,
  className,
}) => {
  const [message, setMessage]               = useState('');
  const [showPicker, setShowPicker]         = useState(false);
  const [showUrlEntry, setShowUrlEntry]     = useState(false);
  const [urlValue, setUrlValue]             = useState('');
  // v2.1: Context note for image — optional user annotation before analysis
  const [showImageContext, setShowImageContext] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imageContext, setImageContext]     = useState('');

  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const docInputRef     = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const urlInputRef     = useRef<HTMLInputElement>(null);

  const urlValid = isValidUrl(urlValue.trim());

  // ── Ingest hook (domain-aware) ──────────────────────────────────────
  const ingest = useBoardroomIngest(activeMember || null);

  // ── Voice input ─────────────────────────────────────────────────────
  const {
    isListening, isSupported: voiceSupported,
    transcript, interimTranscript,
    stopListening, toggleListening, resetTranscript,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: (text) => setMessage(text),
    continuous: true,
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  useEffect(() => {
    onVoiceModeToggle?.(isListening);
  }, [isListening, onVoiceModeToggle]);

  // Auto-focus URL input
  useEffect(() => {
    if (showUrlEntry) setTimeout(() => urlInputRef.current?.focus(), 100);
  }, [showUrlEntry]);

  // Auto-focus image context input
  useEffect(() => {
    if (showImageContext) setTimeout(() => {
      document.getElementById('board-image-context')?.focus();
    }, 100);
  }, [showImageContext]);

  // ── Send ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed && ingest.state.attachments.length === 0) return;

    onSend(trimmed, ingest.state.attachments.length > 0
      ? ingest.state.attachments
      : undefined
    );

    setMessage('');
    ingest.clearAttachments();
    setShowPicker(false);
    setShowUrlEntry(false);
    setShowImageContext(false);
    setUrlValue('');
    setImageContext('');
    setPendingImageFile(null);
    resetTranscript();

    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [message, ingest, onSend, resetTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && urlValid) { e.preventDefault(); handleUrlSubmit(); }
    if (e.key === 'Escape') { setShowUrlEntry(false); setUrlValue(''); }
  };

  // ── Document handler ──────────────────────────────────────────────────
  const handleDocChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    setShowPicker(false);
    await ingest.processDocument(file);
  }, [ingest]);

  // ── URL handler ───────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(async () => {
    if (!urlValid) return;
    const url = urlValue.trim();
    setShowUrlEntry(false);
    setUrlValue('');
    setShowPicker(false);
    await ingest.processUrl(url);
  }, [urlValid, urlValue, ingest]);

  // ── Image handler — v2.1 ──────────────────────────────────────────────
  // After selecting an image (camera or gallery), show a context input
  // so the user can annotate before analysis — "this is the contract
  // clause I'm worried about" helps GPT-4o focus correctly.

  const handleImageFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setShowPicker(false);
    setPendingImageFile(file);
    setImageContext('');
    setShowImageContext(true);
  }, []);

  const handleGalleryChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    handleImageFile(file);
  }, [handleImageFile]);

  const handleCameraChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    handleImageFile(file);
  }, [handleImageFile]);

  const handleImageAnalyze = useCallback(async () => {
    if (!pendingImageFile) return;
    const context = imageContext.trim() || undefined;
    setShowImageContext(false);
    setPendingImageFile(null);
    setImageContext('');
    await ingest.processImage(pendingImageFile, context);
  }, [pendingImageFile, imageContext, ingest]);

  const handleImageCancel = useCallback(() => {
    setShowImageContext(false);
    setPendingImageFile(null);
    setImageContext('');
  }, []);

  const displayMessage = isListening
    ? (transcript + (interimTranscript ? ` ${interimTranscript}` : '')).trim() || message
    : message;

  const hasAttachments = ingest.state.attachments.length > 0;
  const canSend = (displayMessage.trim() || hasAttachments) && !isLoading && !ingest.state.isProcessing;

  return (
    <div className={cn("border-t bg-background p-4", className)}>

      {/* Active member indicator */}
      {activeMember && (
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <span>Speaking to:</span>
          <span className="font-medium text-foreground">{activeMember.name}</span>
          {activeMember.title && (
            <Badge variant="outline" className="text-[10px]">{activeMember.title}</Badge>
          )}
        </div>
      )}

      {/* Media Picker */}
      {showPicker && (
        <div className="mb-3 grid grid-cols-2 gap-2 animate-in slide-in-from-bottom-2 duration-200">
          {[
            {
              id: 'document',
              icon: <FileText className="w-5 h-5" />,
              label: 'Document',
              desc: 'PDF, Word, text',
              action: () => { setShowPicker(false); setTimeout(() => docInputRef.current?.click(), 50); },
              disabled: false,
            },
            {
              id: 'url',
              icon: <Globe className="w-5 h-5" />,
              label: 'Web Research',
              desc: `${activeMember?.name || 'Board'} analyzes`,
              action: () => { setShowPicker(false); setShowUrlEntry(true); },
              disabled: false,
            },
            {
              id: 'camera',
              icon: <Camera className="w-5 h-5" />,
              label: 'Camera',
              desc: 'Board vision analysis',
              action: () => { setShowPicker(false); setTimeout(() => cameraInputRef.current?.click(), 50); },
              disabled: false,
            },
            {
              id: 'gallery',
              icon: <ImageIcon className="w-5 h-5" />,
              label: 'Gallery',
              desc: 'Photo or screenshot',
              action: () => { setShowPicker(false); setTimeout(() => galleryInputRef.current?.click(), 50); },
              disabled: false,
            },
          ].map(({ id, icon, label, desc, action, disabled: dis }) => (
            <button
              key={id}
              onClick={action}
              disabled={dis}
              className={cn(
                'flex flex-col items-center gap-1.5 p-3 rounded-xl text-sm transition-all',
                'border border-border/40',
                dis
                  ? 'opacity-40 cursor-not-allowed bg-muted/30'
                  : 'bg-accent/30 hover:bg-accent/60 active:scale-95 cursor-pointer',
              )}
            >
              <span className={cn('text-primary', dis && 'text-muted-foreground')}>{icon}</span>
              <span className="font-medium text-xs">{label}</span>
              <span className="text-[10px] text-muted-foreground text-center">{desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* URL Entry */}
      {showUrlEntry && (
        <div className="mb-3 animate-in slide-in-from-bottom-2 duration-150">
          {activeMember && (
            <p className="text-[11px] text-muted-foreground mb-1.5">
              {activeMember.name} will research this through a {activeMember.title} lens
            </p>
          )}
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-xl border transition-colors',
            urlValid ? 'bg-primary/5 border-primary/30' : 'bg-accent/30 border-border/30',
          )}>
            <Globe className="w-4 h-4 text-muted-foreground flex-none" />
            <input
              ref={urlInputRef}
              type="url"
              value={urlValue}
              onChange={e => setUrlValue(e.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {urlValid && <Check className="w-4 h-4 text-emerald-400 flex-none" />}
            <button
              onClick={() => { setShowUrlEntry(false); setUrlValue(''); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {urlValid && (
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={handleUrlSubmit}
              disabled={ingest.state.isProcessing}
            >
              {ingest.state.isProcessing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Researching...</>
                : <>Research this URL</>
              }
            </Button>
          )}
        </div>
      )}

      {/* Image Context Entry — v2.1 */}
      {/* Shows after camera/gallery selection. Optional annotation before GPT-4o analysis. */}
      {showImageContext && pendingImageFile && (
        <div className="mb-3 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-primary flex-none" />
            <span className="text-sm font-medium">{pendingImageFile.name}</span>
            <Badge variant="outline" className="text-[10px]">
              {Math.round(pendingImageFile.size / 1024)}KB
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            Optional: add context to focus the board's analysis
          </p>
          <input
            id="board-image-context"
            type="text"
            value={imageContext}
            onChange={e => setImageContext(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleImageAnalyze(); }
              if (e.key === 'Escape') handleImageCancel();
            }}
            placeholder={`e.g. "This is the contract clause I'm concerned about"`}
            className="w-full text-sm bg-accent/30 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-primary/40 placeholder:text-muted-foreground/50 mb-2"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleImageAnalyze}
              disabled={ingest.state.isProcessing}
            >
              {ingest.state.isProcessing
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Analyzing...</>
                : <>Analyze with Board Vision</>
              }
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleImageCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Attachment Previews */}
      {hasAttachments && (
        <div className="mb-3 space-y-1.5">
          {ingest.state.attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/30 animate-in slide-in-from-bottom-1 duration-150"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center text-lg flex-none">
                {att.type === 'url'
                  ? '🌐'
                  : att.type === 'image'
                  ? '📸'
                  : getFileEmoji({ name: att.fileName || '', type: att.mimeType || '' } as File)
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {att.type === 'url'
                    ? (att.title || att.domain || att.url)
                    : att.type === 'image'
                    ? (att.imageDescription || 'Visual analysis complete')
                    : att.fileName
                  }
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {att.type === 'url'
                    ? `${att.domainFiltered ? 'Domain-filtered · ' : ''}${att.citations?.length || 0} sources`
                    : att.type === 'image'
                    ? 'Board vision analysis — each member reads through their lens'
                    : `${att.wordCount || 0} words${att.pageCount ? ` · ${att.pageCount} pages` : ''}`
                  }
                </p>
              </div>
              <button
                onClick={() => ingest.removeAttachment(i)}
                className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Processing indicator */}
      {ingest.state.isProcessing && !showImageContext && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>
            {ingest.state.attachments.length === 0
              ? 'Running board vision analysis...'
              : 'Processing...'}
          </span>
        </div>
      )}

      {/* Ingest error */}
      {ingest.state.error && (
        <div className="mb-3 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-none" />
          <span>{ingest.state.error}</span>
        </div>
      )}

      {/* Voice listening indicator */}
      {isListening && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="relative">
            <Mic className="w-4 h-4 text-red-500" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </div>
          <span className="text-sm text-red-600 dark:text-red-400">Listening...</span>
          {interimTranscript && (
            <span className="text-sm text-muted-foreground italic ml-2 truncate flex-1">
              {interimTranscript}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={stopListening}
            className="text-red-500 hover:text-red-600"
          >
            <StopCircle className="w-4 h-4 mr-1" />
            Stop
          </Button>
        </div>
      )}

      {voiceError && !isListening && (
        <div className="text-sm text-red-500 mb-2">{voiceError}</div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={docInputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        onChange={handleDocChange}
        className="hidden"
        aria-hidden
      />
      {/* Gallery — no capture attribute, opens photo library */}
      <input
        ref={galleryInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={handleGalleryChange}
        className="hidden"
        aria-hidden
      />
      {/* Camera — capture="environment" opens back camera directly on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        onChange={handleCameraChange}
        className="hidden"
        aria-hidden
      />

      {/* Main input row */}
      <div className="flex items-end gap-2">

        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (hasAttachments) {
              ingest.clearAttachments();
            } else {
              setShowPicker(prev => !prev);
              setShowUrlEntry(false);
              setShowImageContext(false);
            }
          }}
          disabled={disabled || isLoading || ingest.state.isProcessing}
          className={cn(
            'shrink-0 transition-all',
            hasAttachments && 'text-primary bg-primary/10',
            showPicker && 'bg-accent/70',
          )}
        >
          {ingest.state.isProcessing
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Paperclip className="w-5 h-5" />
          }
        </Button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={displayMessage}
            onChange={(e) => { if (!isListening) setMessage(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={
              ingest.state.isProcessing
                ? 'Analyzing...'
                : isListening
                ? 'Listening...'
                : hasAttachments
                ? 'Add a question about the attachment (optional)...'
                : placeholder
            }
            disabled={disabled || isLoading || isListening}
            className={cn(
              'min-h-[44px] max-h-[150px] resize-none pr-24',
              hasAttachments && 'border-primary/30 bg-primary/5',
            )}
            rows={1}
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {voiceSupported && (
              <Button
                variant={isListening ? 'destructive' : 'ghost'}
                size="icon"
                onClick={toggleListening}
                disabled={disabled || isLoading}
                className={cn('w-8 h-8 transition-all', isListening && 'animate-pulse')}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="w-8 h-8"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Enter to send · Shift+Enter for new line</span>
        {voiceSupported && (
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3" /> Voice available
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatInput;