// FILE: src/components/oracle/components/OracleInputBar.tsx
// Input field + mic button + send button + conversation mode stop

import React from 'react';
import { Send, Mic, MicOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export function OracleInputBar({
  inputValue, isLoading, isListening, conversationMode, micSupported,
  onInputChange, onSend, onVoice, onEndConversation,
}: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex-none border-t border-border/50 bg-background/80 backdrop-blur-sm px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
      <div className="flex items-end gap-2">
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
              conversationMode && 'border-red-500/30 bg-red-500/5'
            )}
          />
        </div>

        {/* Mic button — hidden in conversation mode */}
        {micSupported && !conversationMode && (
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
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
              inputValue.trim() && !isLoading
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