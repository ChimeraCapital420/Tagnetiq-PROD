// FILE: src/components/oracle/components/OracleChatMessages.tsx
// Message list with play buttons and speaking indicators

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMessageContent } from '../utils';
import type { ChatMessage, QuickChip } from '../types';

// =============================================================================
// WAVEFORM — shows during active speech playback
// =============================================================================

function SpeakingWaveform() {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="w-[3px] bg-cyan-400 rounded-full"
          animate={{ height: ['8px', '16px', '8px'] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  quickChips: QuickChip[];
  playingIdx: number | null;
  isSpeaking: boolean;
  onPlay: (msg: ChatMessage, idx: number) => void;
  onChipClick: (message: string) => void;
}

export function OracleChatMessages({
  messages, isLoading, quickChips, playingIdx, isSpeaking,
  onPlay, onChipClick,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            key={`${msg.timestamp}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div className={cn(
              'max-w-[85%] group',
              msg.role === 'user' ? 'flex flex-col items-end' : 'flex flex-col items-start'
            )}>
              {/* Bubble */}
              <div className={cn(
                'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-accent/60 text-foreground rounded-bl-md'
              )}>
                {/* Waveform overlay when playing this message */}
                {msg.role === 'assistant' && playingIdx === i && isSpeaking && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <SpeakingWaveform />
                    <span className="text-[10px] text-cyan-400">Speaking</span>
                  </div>
                )}
                {formatMessageContent(msg.content)}
              </div>

              {/* Play / Stop button on assistant messages */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => onPlay(msg, i)}
                  className={cn(
                    'mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-all',
                    playingIdx === i && isSpeaking
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/40',
                    // Always visible on mobile (no hover), hidden on desktop until hover
                    playingIdx === i && isSpeaking ? '' : 'sm:opacity-0 sm:group-hover:opacity-100'
                  )}
                >
                  {playingIdx === i && isSpeaking ? (
                    <><VolumeX className="w-3 h-3" /><span>Stop</span></>
                  ) : (
                    <><Play className="w-3 h-3" /><span>Listen</span></>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Quick chips — only shown early in conversation */}
      {quickChips.length > 0 && messages.length <= 2 && (
        <div className="flex-none px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {quickChips.map((chip, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => onChipClick(chip.message)}
                disabled={isLoading}
                className="flex-none text-xs px-3 py-1.5 rounded-full border border-border/50 bg-accent/30 hover:bg-accent/60 transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {chip.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}