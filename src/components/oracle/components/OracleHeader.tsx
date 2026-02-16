// FILE: src/components/oracle/components/OracleHeader.tsx
// Header bar — speaking ring, status, toggles
// Sprint N+: Display mode toggle (full/voice/silent)

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Zap, Plus, History, Volume2, VolumeX, Radio,
  MessageSquare, Headphones, VolumeOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// =============================================================================
// SPEAKING RING — animates when Oracle is speaking
// =============================================================================

function SpeakingRing({ active }: { active: boolean }) {
  return (
    <div className="relative w-9 h-9">
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-cyan-500/30"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full bg-cyan-500/20"
              initial={{ scale: 1, opacity: 0.4 }}
              animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            />
          </>
        )}
      </AnimatePresence>
      <div className={cn(
        'relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
        active
          ? 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/40'
          : 'bg-gradient-to-br from-cyan-500 to-blue-600'
      )}>
        <Zap className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

// =============================================================================
// DISPLAY MODE ICON — shows current mode
// =============================================================================

type DisplayMode = 'full' | 'voice' | 'silent';

function DisplayModeIcon({ mode }: { mode: DisplayMode }) {
  switch (mode) {
    case 'full':
      return <MessageSquare className="w-4 h-4" />;
    case 'voice':
      return <Headphones className="w-4 h-4" />;
    case 'silent':
      return <VolumeOff className="w-4 h-4" />;
  }
}

function getDisplayModeLabel(mode: DisplayMode): string {
  switch (mode) {
    case 'full': return 'Full';
    case 'voice': return 'Voice';
    case 'silent': return 'Silent';
  }
}

// =============================================================================
// HEADER
// =============================================================================

interface Props {
  isSpeaking: boolean;
  isListening: boolean;
  conversationMode: boolean;
  autoSpeak: boolean;
  scanCount: number;
  vaultCount: number;
  showHistory: boolean;
  micSupported: boolean;
  displayMode?: DisplayMode;
  onToggleConversationMode: () => void;
  onToggleHistory: () => void;
  onNewConversation: () => void;
  onToggleAutoSpeak: () => void;
  onCycleDisplayMode?: () => void;
}

export function OracleHeader({
  isSpeaking, isListening, conversationMode, autoSpeak,
  scanCount, vaultCount, showHistory, micSupported,
  displayMode = 'full',
  onToggleConversationMode, onToggleHistory, onNewConversation,
  onToggleAutoSpeak, onCycleDisplayMode,
}: Props) {
  const navigate = useNavigate();

  const status = isSpeaking
    ? 'Speaking...'
    : isListening
    ? 'Listening...'
    : conversationMode
    ? '🔴 Conversation mode'
    : displayMode === 'voice'
    ? '🎧 Voice mode'
    : displayMode === 'silent'
    ? '🔇 Silent mode'
    : scanCount > 0
    ? `${scanCount} scans${vaultCount > 0 ? ` · ${vaultCount} in vault` : ''}`
    : 'Your Oracle partner';

  return (
    <div className="flex-none border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: back + avatar + status */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 -ml-1 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <SpeakingRing active={isSpeaking} />
            <div>
              <h1 className="text-sm font-semibold leading-tight">Oracle</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">{status}</p>
            </div>
          </div>
        </div>

        {/* Right: toggles */}
        <div className="flex items-center gap-1">
          {/* Display mode toggle — cycles full → voice → silent */}
          {onCycleDisplayMode && (
            <button
              onClick={onCycleDisplayMode}
              className={cn(
                'p-2 rounded-lg transition-all',
                displayMode === 'voice'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : displayMode === 'silent'
                  ? 'bg-muted text-muted-foreground'
                  : 'text-muted-foreground hover:bg-accent/50'
              )}
              aria-label={`Display mode: ${getDisplayModeLabel(displayMode)}`}
              title={`Mode: ${getDisplayModeLabel(displayMode)} — tap to cycle`}
            >
              <DisplayModeIcon mode={displayMode} />
            </button>
          )}

          {micSupported && (
            <button
              onClick={onToggleConversationMode}
              className={cn(
                'p-2 rounded-lg transition-all',
                conversationMode
                  ? 'bg-red-500/20 text-red-400 animate-pulse'
                  : 'text-muted-foreground hover:bg-accent/50'
              )}
              aria-label="Toggle conversation mode"
            >
              <Radio className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleHistory}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showHistory ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
            )}
            aria-label="History"
          >
            <History className="w-4 h-4" />
          </button>
          <button onClick={onNewConversation} className="p-2 rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors" aria-label="New conversation">
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleAutoSpeak}
            className={cn(
              'p-2 rounded-lg transition-colors',
              autoSpeak ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground hover:bg-accent/50'
            )}
            aria-label="Toggle auto-speak"
          >
            {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
