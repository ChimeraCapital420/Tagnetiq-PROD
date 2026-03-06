// FILE: src/components/OracleBar.tsx
// ═══════════════════════════════════════════════════════════════════════
// Oracle Bar — Persistent bottom bar for always-on Oracle access
// ═══════════════════════════════════════════════════════════════════════
//
// Replaces the blue floating mic button (OracleVoiceButton).
//
// DESIGN:
//   Collapsed — 52px slim bar at the bottom of every screen:
//     [ ⚡  Ask Oracle...                    🎤 ]
//   Quiet. Matches the app chrome. Never fights content.
//
//   Expanded — sheet slides up from the bar:
//     Context chips pre-loaded from current screen + scan result
//     Voice input (mic auto-starts, getUserMedia gate from useVoiceInput v2.0)
//     Text input with send button
//
// CONTEXT AWARENESS:
//   /dashboard + active scan result → item-specific chips
//   /dashboard + no scan            → general chips
//   /vault                          → vault chips
//   /arena/marketplace              → market chips
//   /hunt                           → hunt chips
//   isScannerOpen                   → scanner tips chips
//   isAnalyzing                     → shows "Analyzing…" state, non-interactive
//
// HIDDEN ON:
//   /oracle only — user is already in Oracle, bar would be redundant.
//   Pre-auth — AppLayout already gates on {user}.
//
// NAVIGATION:
//   Tap chip or Send → sessionStorage.setItem('oracle_prefill', message)
//   → navigate('/oracle') → useOraclePrefill hook auto-sends on mount.
//
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, Mic, MicOff, Send, X, ChevronRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useVoiceInput } from '@/features/boardroom/hooks/useVoiceInput';
import { cn } from '@/lib/utils';

// =============================================================================
// CONTEXT MAPPING
// =============================================================================

interface ScreenContext {
  placeholder: string;
  systemContext: string;
  chips: string[];
}

function deriveContext(
  pathname: string,
  isScannerOpen: boolean,
  isAnalyzing: boolean,
  itemName: string | null,
  estimatedValue: string | null,
): ScreenContext {
  // Scanner open — tips for the current environment
  if (isScannerOpen) {
    return {
      placeholder: 'Ask Oracle for scanning tips…',
      systemContext: "I have the scanner open and I'm about to photograph an item. ",
      chips: [
        'Best angle for this shot?',
        'How to handle bad lighting?',
        'What details matter most?',
        'Tips for reflective surfaces?',
      ],
    };
  }

  const isHome = pathname === '/' || pathname.startsWith('/dashboard');

  // Dashboard with active scan result
  if (isHome && itemName) {
    const val = estimatedValue ? ` (~$${estimatedValue})` : '';
    return {
      placeholder: `Ask about ${itemName}…`,
      systemContext: `I just scanned a ${itemName}${val}. `,
      chips: [
        'List this item for me',
        'Is this a good price?',
        'Where should I sell it?',
        'What affects the value?',
      ],
    };
  }

  if (isHome) {
    return {
      placeholder: 'Ask Oracle anything…',
      systemContext: '',
      chips: [
        'What should I scan today?',
        'Best items to resell?',
        'Help me find deals',
        'How does HYDRA work?',
      ],
    };
  }

  if (pathname.startsWith('/vault')) {
    return {
      placeholder: 'Ask about your vault…',
      systemContext: "I'm reviewing my vault. ",
      chips: [
        "What's my collection worth?",
        'Best items to sell now?',
        'Set a price alert',
        'Compare to market',
      ],
    };
  }

  if (pathname.includes('/marketplace') || pathname.startsWith('/arena')) {
    return {
      placeholder: 'Ask about the marketplace…',
      systemContext: "I'm browsing the marketplace. ",
      chips: [
        'Find underpriced items',
        'What categories are hot?',
        'How to write a listing?',
        'Best offer strategy?',
      ],
    };
  }

  if (pathname.startsWith('/hunt')) {
    return {
      placeholder: 'Ask for hunt tips…',
      systemContext: "I'm in hunt mode looking for items to buy and resell. ",
      chips: [
        'High margin categories?',
        'What to look for here?',
        'Red flags to avoid',
        'Best offer strategy?',
      ],
    };
  }

  return {
    placeholder: 'Ask Oracle anything…',
    systemContext: '',
    chips: [
      'Ask me anything',
      'Help me scan something',
      'What should I sell?',
    ],
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

const OracleBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isScannerOpen, isAnalyzing, oracleAnalysisContext } = useAppContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Hide on /oracle — user is already there
  const isOnOracle = location.pathname.startsWith('/oracle');
  if (isOnOracle) return null;

  const itemName = oracleAnalysisContext?.itemName ?? null;
  const estimatedValue = oracleAnalysisContext?.estimatedValue ?? null;

  const context = deriveContext(
    location.pathname,
    isScannerOpen,
    isAnalyzing,
    itemName,
    estimatedValue,
  );

  // ── Voice ──────────────────────────────────────────────────────────
  const voice = useVoiceInput({
    continuous: false,
    interimResults: true,
    onFinalTranscript: (text) => {
      setInputText(prev => prev ? `${prev} ${text}`.trim() : text);
    },
  });

  // ── Expand / collapse ──────────────────────────────────────────────
  const expand = useCallback(() => {
    setIsExpanded(true);
    setInputText('');
    // Auto-start mic after sheet animation
    setTimeout(() => {
      if (voice.isSupported && !isAnalyzing) {
        void voice.startListening();
      }
      inputRef.current?.focus();
    }, 300);
  }, [voice, isAnalyzing]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    voice.stopListening();
    voice.reset();
    setInputText('');
  }, [voice]);

  // Collapse on route change
  useEffect(() => {
    collapse();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send to Oracle ─────────────────────────────────────────────────
  const sendToOracle = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const fullMessage = context.systemContext
      ? `${context.systemContext}${trimmed}`
      : trimmed;

    sessionStorage.setItem('oracle_prefill', fullMessage);
    collapse();
    navigate('/oracle');
  }, [context.systemContext, collapse, navigate]);

  const handleSend = useCallback(() => {
    const text = (inputText || voice.interimTranscript).trim();
    if (text) sendToOracle(text);
  }, [inputText, voice.interimTranscript, sendToOracle]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayText = inputText || voice.interimTranscript || '';
  const canSend = displayText.trim().length > 0;

  // ── Collapsed bar label ────────────────────────────────────────────
  const barLabel = isAnalyzing
    ? 'Analyzing…'
    : itemName
      ? `Ask about ${itemName.length > 18 ? itemName.slice(0, 16) + '…' : itemName}`
      : 'Ask Oracle…';

  return (
    <>
      {/* ── Backdrop (sheet open only) ─────────────────────────────── */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={collapse}
          aria-hidden="true"
        />
      )}

      {/* ── Expanded sheet ─────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 bottom-[52px] z-50',
          'bg-background border-t border-border/50',
          'shadow-2xl rounded-t-2xl',
          'transform transition-transform duration-300 ease-out',
          isExpanded ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="px-4 pb-4 space-y-3">

          {/* Context chips */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
            {context.chips.map((chip) => (
              <button
                key={chip}
                onClick={() => sendToOracle(chip)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1',
                  'text-xs px-3 py-2 rounded-full min-h-[36px]',
                  'bg-muted hover:bg-muted/70 text-foreground',
                  'border border-border/40',
                  'transition-colors whitespace-nowrap',
                )}
              >
                {chip}
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>

          {/* Listening indicator */}
          {voice.isListening && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-end gap-[3px] h-3.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-red-500 animate-pulse"
                    style={{
                      height: `${50 + i * 12}%`,
                      animationDelay: `${i * 90}ms`,
                      animationDuration: `${700 + i * 80}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-red-400 font-medium">Listening…</span>
              <button
                onClick={voice.stopListening}
                className="ml-auto text-xs text-red-400 underline"
              >
                Done
              </button>
            </div>
          )}

          {/* Voice error */}
          {voice.error && (
            <p className="text-xs text-destructive px-1">{voice.error}</p>
          )}

          {/* Input row */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={displayText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={context.placeholder}
              rows={2}
              disabled={voice.isListening}
              className={cn(
                'flex-1 resize-none rounded-xl border border-border/50',
                'bg-muted/60 px-3 py-2.5 text-sm',
                'placeholder:text-muted-foreground/50',
                'focus:outline-none focus:ring-2 focus:ring-primary/20',
                'transition-colors',
                voice.isListening && 'opacity-50',
              )}
            />

            {/* Mic */}
            <button
              onClick={voice.isListening ? voice.stopListening : () => void voice.startListening()}
              disabled={!voice.isSupported}
              className={cn(
                'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
                'transition-all duration-200',
                voice.isListening
                  ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                  : 'bg-muted hover:bg-muted/70 text-muted-foreground',
                !voice.isSupported && 'opacity-30 cursor-not-allowed',
              )}
              aria-label={voice.isListening ? 'Stop' : 'Speak'}
            >
              {voice.isListening
                ? <MicOff className="h-4 w-4" />
                : <Mic className="h-4 w-4" />
              }
            </button>

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'w-10 h-10 rounded-xl shrink-0 flex items-center justify-center',
                'transition-all duration-200',
                canSend
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground opacity-30 cursor-not-allowed',
              )}
              aria-label="Send to Oracle"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Safe area for notch */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>

      {/* ── Collapsed bar — always visible ───────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'h-[52px] bg-background/95 backdrop-blur-sm',
          'border-t border-border/40',
          'flex items-center px-4 gap-3',
          // Safe area padding for phones with home indicator
          'pb-[env(safe-area-inset-bottom,0px)]',
        )}
        style={{ height: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Oracle icon */}
        <div className={cn(
          'flex items-center justify-center w-7 h-7 rounded-full shrink-0',
          isAnalyzing ? 'bg-primary/20' : 'bg-primary/10',
        )}>
          <Zap className={cn(
            'h-3.5 w-3.5',
            isAnalyzing ? 'text-primary animate-pulse' : 'text-primary/70',
          )} />
        </div>

        {/* Tap target — full width placeholder */}
        <button
          onClick={isAnalyzing ? undefined : expand}
          disabled={isAnalyzing}
          className={cn(
            'flex-1 text-left text-sm text-muted-foreground/60',
            'focus:outline-none',
            !isAnalyzing && 'hover:text-muted-foreground transition-colors',
          )}
          aria-label="Ask Oracle"
          aria-expanded={isExpanded}
        >
          {barLabel}
        </button>

        {/* Mic shortcut — tap to expand + auto-start mic */}
        {!isAnalyzing && (
          <button
            onClick={expand}
            className={cn(
              'w-8 h-8 rounded-full shrink-0 flex items-center justify-center',
              'text-muted-foreground/50 hover:text-muted-foreground',
              'hover:bg-muted transition-colors',
            )}
            aria-label="Voice input"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Close button when expanded */}
        {isExpanded && (
          <button
            onClick={collapse}
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  );
};

export default OracleBar;