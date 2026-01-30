// FILE: src/features/boardroom/components/VoiceInputButton.tsx
// Mobile-first voice input button for speaking to the board
// Supports push-to-talk and continuous listening modes

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  MicOff, 
  Loader2, 
  Radio,
  Square,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceInput } from '../hooks/useVoiceInput';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onSend?: (text: string) => void;
  disabled?: boolean;
  mode?: 'push-to-talk' | 'toggle' | 'continuous';
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  showTranscript?: boolean;
  autoSendOnStop?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  onSend,
  disabled = false,
  mode = 'toggle',
  className,
  size = 'default',
  showTranscript = true,
  autoSendOnStop = false,
}) => {
  const [lastTranscript, setLastTranscript] = useState('');

  const voice = useVoiceInput({
    continuous: mode === 'continuous',
    interimResults: true,
    onTranscript: (text) => {
      onTranscript(text);
      setLastTranscript(text);
    },
    onFinalTranscript: (text) => {
      if (autoSendOnStop && mode === 'push-to-talk') {
        onSend?.(text);
      }
    },
  });

  // Handle push-to-talk release
  const handlePushToTalkRelease = () => {
    if (mode === 'push-to-talk' && voice.isListening) {
      voice.stopListening();
      if (autoSendOnStop && lastTranscript) {
        onSend?.(lastTranscript);
        voice.clearTranscript();
        setLastTranscript('');
      }
    }
  };

  // Size configurations
  const sizeConfig = {
    sm: { button: 'h-10 w-10', icon: 'h-4 w-4', pulse: 'h-12 w-12' },
    default: { button: 'h-12 w-12', icon: 'h-5 w-5', pulse: 'h-14 w-14' },
    lg: { button: 'h-16 w-16', icon: 'h-6 w-6', pulse: 'h-20 w-20' },
    xl: { button: 'h-20 w-20', icon: 'h-8 w-8', pulse: 'h-24 w-24' },
  };

  const config = sizeConfig[size];

  // Not supported state
  if (!voice.isSupported) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        className={cn(config.button, 'rounded-full', className)}
        title="Voice input not supported"
      >
        <MicOff className={cn(config.icon, 'text-muted-foreground')} />
      </Button>
    );
  }

  // Error state
  if (voice.error && !voice.isListening) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => voice.startListening()}
          disabled={disabled}
          className={cn(config.button, 'rounded-full border-destructive', className)}
          title={voice.error}
        >
          <AlertCircle className={cn(config.icon, 'text-destructive')} />
        </Button>
        <span className="text-xs text-destructive max-w-[120px] text-center">
          {voice.error}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Main button with pulse animation when listening */}
      <div className="relative">
        {voice.isListening && (
          <>
            {/* Pulsing rings */}
            <div className={cn(
              "absolute inset-0 rounded-full bg-red-500/20 animate-ping",
              config.pulse,
              "-translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"
            )} />
            <div className={cn(
              "absolute inset-0 rounded-full bg-red-500/30 animate-pulse",
              config.button,
            )} />
          </>
        )}
        
        <Button
          variant={voice.isListening ? "destructive" : "default"}
          size="icon"
          className={cn(
            config.button,
            'rounded-full relative z-10 transition-all duration-200',
            voice.isListening && 'scale-110 shadow-lg shadow-red-500/25',
            className
          )}
          disabled={disabled || voice.isProcessing}
          onClick={() => {
            if (mode === 'toggle' || mode === 'continuous') {
              voice.toggleListening();
            }
          }}
          onMouseDown={() => {
            if (mode === 'push-to-talk') {
              voice.startListening();
            }
          }}
          onMouseUp={handlePushToTalkRelease}
          onMouseLeave={handlePushToTalkRelease}
          onTouchStart={() => {
            if (mode === 'push-to-talk') {
              voice.startListening();
            }
          }}
          onTouchEnd={handlePushToTalkRelease}
          title={voice.isListening ? 'Stop listening' : 'Start listening'}
        >
          {voice.isProcessing ? (
            <Loader2 className={cn(config.icon, 'animate-spin')} />
          ) : voice.isListening ? (
            mode === 'push-to-talk' ? (
              <Radio className={cn(config.icon, 'animate-pulse')} />
            ) : (
              <Square className={config.icon} />
            )
          ) : (
            <Mic className={config.icon} />
          )}
        </Button>
      </div>

      {/* Status indicator */}
      {voice.isListening && (
        <Badge variant="destructive" className="animate-pulse">
          {mode === 'push-to-talk' ? 'Recording...' : 'Listening...'}
        </Badge>
      )}

      {voice.isProcessing && (
        <Badge variant="secondary">
          Processing...
        </Badge>
      )}

      {/* Live transcript preview */}
      {showTranscript && (voice.transcript || voice.interimTranscript) && (
        <div className="max-w-xs text-center">
          <p className="text-sm">
            <span>{voice.transcript}</span>
            {voice.interimTranscript && (
              <span className="text-muted-foreground italic">
                {voice.interimTranscript}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MOBILE VOICE BAR COMPONENT
// Full-width voice input bar for mobile screens
// ============================================================================

interface MobileVoiceBarProps {
  onTranscript: (text: string) => void;
  onSend: (text: string) => void;
  textInput: string;
  onTextChange: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MobileVoiceBar: React.FC<MobileVoiceBarProps> = ({
  onTranscript,
  onSend,
  textInput,
  onTextChange,
  disabled = false,
  placeholder = "Speak or type your message...",
}) => {
  const voice = useVoiceInput({
    continuous: false,
    interimResults: true,
    onTranscript: (text) => {
      onTextChange(text);
    },
  });

  const handleSend = () => {
    if (textInput.trim()) {
      onSend(textInput);
      voice.clearTranscript();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 border-t bg-background">
      {/* Voice button */}
      <Button
        variant={voice.isListening ? "destructive" : "ghost"}
        size="icon"
        className={cn(
          "h-10 w-10 rounded-full shrink-0",
          voice.isListening && "animate-pulse"
        )}
        onClick={() => voice.toggleListening()}
        disabled={disabled || voice.isProcessing}
      >
        {voice.isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : voice.isListening ? (
          <Square className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {/* Text input / Transcript display */}
      <div className="flex-1 relative">
        <input
          type="text"
          value={textInput}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={voice.isListening ? "Listening..." : placeholder}
          disabled={disabled || voice.isListening}
          className={cn(
            "w-full h-10 px-4 rounded-full border bg-muted/50",
            "focus:outline-none focus:ring-2 focus:ring-primary",
            voice.isListening && "border-red-500 bg-red-50 dark:bg-red-950/20"
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        
        {/* Interim transcript overlay */}
        {voice.isListening && voice.interimTranscript && (
          <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
            <span className="text-muted-foreground italic truncate">
              {voice.interimTranscript}
            </span>
          </div>
        )}
      </div>

      {/* Send button */}
      <Button
        size="icon"
        className="h-10 w-10 rounded-full shrink-0"
        onClick={handleSend}
        disabled={disabled || !textInput.trim() || voice.isListening}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </Button>
    </div>
  );
};

export default VoiceInputButton;