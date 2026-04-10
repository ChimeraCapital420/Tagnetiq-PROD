// FILE: src/features/boardroom/components/ChatInput.tsx
// Board Chat Input — Media-aware attachment system
//
// v2.0 — Full media intelligence bar
//   📎 "+" opens picker:
//     📄 Document → PDF, DOCX, TXT extracted client-side
//     🌐 Web Link → domain-filtered research via Perplexity sonar-pro
//     📷 Image   → camera or gallery (future: Oracle see.ts)
//   Each attachment shows a preview strip before sending.
//   Board member context passed to ingest so URL research is
//   domain-filtered (CFO gets cash flow, Legal gets liability).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Mic, MicOff, Paperclip, Loader2, X,
  StopCircle, FileText, Globe, Camera,
  AlertCircle, Check,
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
  const [message, setMessage]           = useState('');
  const [showPicker, setShowPicker]     = useState(false);
  const [showUrlEntry, setShowUrlEntry] = useState(false);
  const [urlValue, setUrlValue]         = useState('');

  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const docInputRef  = useRef<HTMLInputElement>(null);
  const urlInputRef  = useRef<HTMLInputElement>(null);

  const urlValid = isValidUrl(urlValue.trim());

  // ── Ingest hook (domain-aware) ──────────────────────────
  const ingest = useBoardroomIngest(activeMember || null);

  // ── Voice input ─────────────────────────────────────────
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

  // ── Send ─────────────────────────────────────────────────
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
    setUrlValue('');
    resetTranscript();

    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [message, ingest, onSend, resetTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && urlValid) {
      e.preventDefault();
      handleUrlSubmit();
    }
    if (e.key === 'Escape') { setShowUrlEntry(false); setUrlValue(''); }
  };

  // ── Document handler ──────────────────────────────────────
  const handleDocChange = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';

    const category = getFileCategory(file);
    if (category !== 'document') return;

    setShowPicker(false);
    await ingest.processDocument(file);
  }, [ingest]);

  // ── URL handler ───────────────────────────────────────────
  const handleUrlSubmit = useCallback(async () => {
    if (!urlValid) return;
    const url = urlValue.trim();
    setShowUrlEntry(false);
    setUrlValue('');
    setShowPicker(false);
    await ingest.processUrl(url);
  }, [urlValid, urlValue, ingest]);

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
        <div className="mb-3 grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-2 duration-200">
          {[
            {
              id: 'document',
              icon: <FileText className="w-5 h-5" />,
              label: 'Document',
              desc: 'PDF, Word, text',
              action: () => { setShowPicker(false); setTimeout(() => docInputRef.current?.click(), 50); },
            },
            {
              id: 'url',
              icon: <Globe className="w-5 h-5" />,
              label: 'Web Research',
              desc: `${activeMember?.name || 'Board'} analyzes`,
              action: () => { setShowPicker(false); setShowUrlEntry(true); },
            },
            {
              id: 'image',
              icon: <Camera className="w-5 h-5" />,
              label: 'Image',
              desc: 'Coming soon',
              action: () => {},
              disabled: true,
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

      {/* Attachment Previews */}
      {hasAttachments && (
        <div className="mb-3 space-y-1.5">
          {ingest.state.attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-xl bg-accent/30 border border-border/30 animate-in slide-in-from-bottom-1 duration-150"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/60 flex items-center justify-center text-lg flex-none">
                {att.type === 'document' ? getFileEmoji({ name: att.fileName || '', type: att.mimeType || '' } as File) : '🌐'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {att.type === 'url' ? (att.title || att.domain || att.url) : att.fileName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {att.type === 'url'
                    ? `${att.domainFiltered ? 'Domain-filtered · ' : ''}${att.citations?.length || 0} sources`
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
      {ingest.state.isProcessing && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Processing...</span>
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
                ? 'Processing...'
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