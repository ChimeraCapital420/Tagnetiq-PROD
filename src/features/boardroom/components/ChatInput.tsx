// FILE: src/features/boardroom/components/ChatInput.tsx
// Chat input with integrated voice input button

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, Image, Loader2, X, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  activeMember?: { id: string; name: string } | null;
  onVoiceModeToggle?: (enabled: boolean) => void;
  className?: string;
}

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
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input hook
  const {
    isListening,
    isSupported: voiceSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error: voiceError,
  } = useVoiceInput({
    onTranscript: (text) => {
      setMessage(text);
    },
    continuous: true,
  });

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  // Notify parent of voice mode changes
  useEffect(() => {
    onVoiceModeToggle?.(isListening);
  }, [isListening, onVoiceModeToggle]);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;
    
    onSend(trimmedMessage, attachments.length > 0 ? attachments : undefined);
    setMessage('');
    setAttachments([]);
    resetTranscript();
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files].slice(0, 5)); // Max 5 attachments
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const displayMessage = isListening 
    ? (transcript + (interimTranscript ? ` ${interimTranscript}` : '')).trim() || message
    : message;

  return (
    <div className={cn("border-t bg-background p-4", className)}>
      {/* Active member indicator */}
      {activeMember && (
        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
          <span>Speaking to:</span>
          <span className="font-medium text-foreground">{activeMember.name}</span>
        </div>
      )}

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm"
            >
              <Image className="w-4 h-4" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 p-0"
                onClick={() => removeAttachment(i)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
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

      {/* Voice error */}
      {voiceError && !isListening && (
        <div className="text-sm text-red-500 mb-2">{voiceError}</div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isLoading}
          className="shrink-0"
        >
          <Paperclip className="w-5 h-5" />
        </Button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={displayMessage}
            onChange={(e) => {
              if (!isListening) {
                setMessage(e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : placeholder}
            disabled={disabled || isLoading || isListening}
            className="min-h-[44px] max-h-[150px] resize-none pr-24"
            rows={1}
          />
          
          {/* Voice button inside textarea */}
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {/* Voice toggle */}
            {voiceSupported && (
              <Button
                variant={isListening ? "destructive" : "ghost"}
                size="icon"
                onClick={toggleListening}
                disabled={disabled || isLoading}
                className={cn(
                  "w-8 h-8 transition-all",
                  isListening && "animate-pulse"
                )}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}

            {/* Send button */}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={disabled || isLoading || (!displayMessage.trim() && attachments.length === 0)}
              className="w-8 h-8"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>Press Enter to send, Shift+Enter for new line</span>
        {voiceSupported && (
          <span className="flex items-center gap-1">
            <Mic className="w-3 h-3" />
            Voice input available
          </span>
        )}
      </div>
    </div>
  );
};

export default ChatInput;