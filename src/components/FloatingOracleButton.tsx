// FILE: src/components/FloatingOracleButton.tsx
// ═══════════════════════════════════════════════════════════════════════
// Context-Aware Floating Oracle Button
// ═══════════════════════════════════════════════════════════════════════
//
// A floating action button that follows the user through every screen
// and gives them instant voice or text access to Oracle with full
// awareness of what they're currently doing.
//
// CONTEXT MAPPING:
//   /dashboard + active scan result → "Ask about [itemName]" + item chips
//   /dashboard + no scan           → "Ask Oracle" + general chips
//   /vault                         → vault-specific chips
//   /arena/marketplace             → market-specific chips
//   /hunt                          → hunt-mode chips
//   /oracle                        → HIDDEN (already there)
//
// HIDDEN WHEN:
//   - On /oracle (already in Oracle)
//   - isScannerOpen (scanner is fullscreen)
//   - isAnalyzing (HYDRA is working, don't interrupt)
//
// VOICE FLOW:
//   1. Tap button → sheet slides up, mic auto-starts (getUserMedia gate)
//   2. Speak → interim transcript shown live
//   3. Voice ends → transcript fills input, user can edit
//   4. Tap chip OR Send → sessionStorage prefill → navigate to /oracle
//
// ORACLE PAGE WIRING (add to your Oracle page component):
//   useEffect(() => {
//     const prefill = sessionStorage.getItem('oracle_prefill');
//     if (prefill) {
//       sessionStorage.removeItem('oracle_prefill');
//       sendMessage(prefill); // or setInputValue(prefill)
//     }
//   }, []);
//
// PLACEMENT (App.tsx — inside AppProvider, after ResponsiveNavigation):
//   <FloatingOracleButton />
//
// ═══════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mic, MicOff, X, Send, Zap, ChevronRight } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useVoiceInput } from '@/features/boardroom/hooks/useVoiceInput';
import { cn } from '@/lib/utils';

// =============================================================================
// CONTEXT MAPPING
// =============================================================================

interface OracleScreenContext {
  /** Label shown on the floating pill */
  label: string;
  /** Pre-pended to voice/typed message for Oracle's awareness */
  systemContext: string;
  /** Quick-tap chips — most relevant first */
  chips: string[];
}

function deriveContext(
  pathname: string,
  itemName: string | null,
  estimatedValue: string | null,
  category: string | null,
): OracleScreenContext {
  const isHome = pathname === '/' || pathname.startsWith('/dashboard');

  // Active scan result on dashboard
  if (isHome && itemName) {
    const valueStr = estimatedValue ? ` (~$${estimatedValue})` : '';
    return {
      label: itemName.length > 22 ? itemName.slice(0, 20) + '…' : itemName,
      systemContext: `I just scanned a ${itemName}${valueStr}. `,
      chips: [
        'Is this a good price?',
        'Where should I sell it?',
        'What affects the value?',
        'How do I price it?',
      ],
    };
  }

  if (isHome) {
    return {
      label: 'Ask Oracle',
      systemContext: '',
      chips: [
        'What should I scan today?',
        'How does HYDRA work?',
        'Best items to resell?',
        'Help me find deals',
      ],
    };
  }

  if (pathname.startsWith('/vault')) {
    return {
      label: 'Vault',
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
      label: 'Marketplace',
      systemContext: "I'm browsing the marketplace. ",
      chips: [
        'Find underpriced items',
        'What categories are hot?',
        'Price trend for my area',
        'How to write a listing?',
      ],
    };
  }

  if (pathname.startsWith('/hunt')) {
    return {
      label: 'Hunt Mode',
      systemContext: "I'm in hunt mode, looking for items to buy and resell. ",
      chips: [
        'High margin categories?',
        'What to look for at estate sales?',
        'Red flags to avoid',
        'Best offer strategy?',
      ],
    };
  }

  return {
    label: 'Oracle',
    systemContext: '',
    chips: [
      'Ask me anything',
      'Help me scan something',
      'What should I sell?',
    ],
  };
}

// =============================================================================
// HOOK — voice shortcut to Oracle
// =============================================================================

// Routes where the button should be completely hidden
const HIDDEN_ROUTES = ['/oracle', '/boardroom'];

// =============================================================================
// COMPONENT
// =============================================================================

const FloatingOracleButton: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isScannerOpen, isAnalyzing, oracleAnalysisContext } = useAppContext();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // ── Derive context from current screen ──────────────────────────────
  const context = deriveContext(
    location.pathname,
    oracleAnalysisContext?.itemName ?? null,
    oracleAnalysisContext?.estimatedValue ?? null,
    oracleAnalysisContext?.category ?? null,
  );

  // ── Voice input (fixed v2.0 — getUserMedia gate) ─────────────────────
  const voice = useVoiceInput({
    continuous: false,
    interimResults: true,
    onFinalTranscript: (text) => {
      setInputText(prev => prev ? `${prev} ${text}`.trim() : text);
    },
    onError: (err) => {
      console.warn('[FloatingOracle] Voice error:', err);
    },
  });

  // ── Visibility guard ─────────────────────────────────────────────────
  const isHidden =
    HIDDEN_ROUTES.some(r => location.pathname.startsWith(r)) ||
    isScannerOpen ||
    isAnalyzing;

  // ── Sheet open/close ─────────────────────────────────────────────────
  const openSheet = useCallback(() => {
    setIsSheetOpen(true);
    setInputText('');
    // Small delay so sheet animation completes before mic starts
    setTimeout(() => {
      if (voice.isSupported) {
        void voice.startListening();
      }
      inputRef.current?.focus();
    }, 320);
  }, [voice]);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    voice.stopListening();
    voice.reset();
    setInputText('');
  }, [voice]);

  // Close sheet on backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      closeSheet();
    }
  }, [closeSheet]);

  // Close on route change
  useEffect(() => {
    closeSheet();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send to Oracle ────────────────────────────────────────────────────
  const sendToOracle = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Prepend screen context so Oracle knows what the user is looking at
    const fullMessage = context.systemContext
      ? `${context.systemContext}${trimmed}`
      : trimmed;

    // Store for Oracle page to auto-send on mount
    sessionStorage.setItem('oracle_prefill', fullMessage);

    closeSheet();
    navigate('/oracle');
  }, [context.systemContext, closeSheet, navigate]);

  const handleSend = useCallback(() => {
    const text = inputText.trim() || voice.interimTranscript.trim();
    if (text) sendToOracle(text);
  }, [inputText, voice.interimTranscript, sendToOracle]);

  const handleChip = useCallback((chip: string) => {
    sendToOracle(chip);
  }, [sendToOracle]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Don't render when hidden ─────────────────────────────────────────
  if (isHidden) return null;

  // ── Display transcript (final + interim) ─────────────────────────────
  const displayText = inputText
    || (voice.interimTranscript
        ? (inputText ? `${inputText} ${voice.interimTranscript}` : voice.interimTranscript)
        : '');

  const canSend = (inputText.trim() || voice.interimTranscript.trim()).length > 0;

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* ── Bottom Sheet ──────────────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed left-0 right-0 bottom-0 z-50',
          'bg-background/98 border-t border-border/60',
          'rounded-t-2xl shadow-2xl',
          'transform transition-transform duration-300 ease-out',
          'will-change-transform',
          isSheetOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
        style={{ maxHeight: '70vh' }}
        role="dialog"
        aria-label="Ask Oracle"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-4 pb-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 40px)' }}>

          {/* ── Header row ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-yellow-500/20">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">Oracle</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{context.label}</p>
              </div>
            </div>
            <button
              onClick={closeSheet}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Quick chips ───────────────────────────────────────────── */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {context.chips.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChip(chip)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1',
                  'text-xs px-3 py-1.5 rounded-full',
                  'bg-muted hover:bg-muted/80 text-foreground',
                  'border border-border/50 hover:border-border',
                  'transition-colors whitespace-nowrap',
                  'min-h-[36px]', // 44px touch target via line-height
                )}
              >
                {chip}
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* ── Voice status ──────────────────────────────────────────── */}
          {voice.isListening && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              {/* Animated mic bars */}
              <div className="flex items-end gap-0.5 h-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-red-500 animate-pulse"
                    style={{
                      height: `${40 + Math.random() * 60}%`,
                      animationDelay: `${i * 80}ms`,
                      animationDuration: `${600 + i * 100}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-red-400 font-medium">Listening…</span>
              <button
                onClick={voice.stopListening}
                className="ml-auto text-xs text-red-400 hover:text-red-300 underline"
              >
                Done
              </button>
            </div>
          )}

          {voice.error && (
            <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">{voice.error}</p>
            </div>
          )}

          {/* ── Text input ────────────────────────────────────────────── */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={displayText}
                onChange={(e) => {
                  setInputText(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  voice.isListening
                    ? 'Listening… (tap Done when finished)'
                    : oracleAnalysisContext
                      ? `Ask about ${oracleAnalysisContext.itemName}…`
                      : 'Ask Oracle anything…'
                }
                rows={2}
                className={cn(
                  'w-full resize-none rounded-xl border border-border/60',
                  'bg-muted/50 px-3 py-2.5',
                  'text-sm placeholder:text-muted-foreground/60',
                  'focus:outline-none focus:ring-2 focus:ring-yellow-500/30 focus:border-yellow-500/50',
                  'transition-colors',
                  voice.isListening && 'opacity-60',
                )}
                disabled={voice.isListening}
              />
            </div>

            {/* Mic toggle */}
            <button
              onClick={voice.isListening ? voice.stopListening : () => void voice.startListening()}
              disabled={!voice.isSupported}
              className={cn(
                'flex items-center justify-center',
                'w-11 h-11 rounded-xl shrink-0',
                'transition-all duration-200',
                voice.isListening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-105'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                !voice.isSupported && 'opacity-40 cursor-not-allowed',
              )}
              aria-label={voice.isListening ? 'Stop listening' : 'Start voice input'}
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
                'flex items-center justify-center',
                'w-11 h-11 rounded-xl shrink-0',
                'transition-all duration-200',
                canSend
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                  : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed',
              )}
              aria-label="Send to Oracle"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Safe area spacer for bottom notch */}
          <div className="h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>

      {/* ── Floating Pill Button ───────────────────────────────────────── */}
      <button
        onClick={openSheet}
        className={cn(
          'fixed bottom-6 right-4 z-40',
          'flex items-center gap-2',
          'pl-3 pr-4 h-12 rounded-full',
          'bg-background border border-border/80',
          'shadow-lg shadow-black/20',
          'hover:shadow-xl hover:shadow-black/30 hover:scale-105',
          'active:scale-95',
          'transition-all duration-200',
          'touch-manipulation select-none',
          // Subtle gold glow when item is active
          oracleAnalysisContext && 'border-yellow-500/40 shadow-yellow-500/10',
        )}
        aria-label="Ask Oracle"
        aria-expanded={isSheetOpen}
      >
        {/* Mic icon with pulse ring when idle */}
        <div className="relative flex items-center justify-center w-7 h-7">
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              oracleAnalysisContext
                ? 'bg-yellow-500/20 animate-ping'
                : 'bg-primary/10',
            )}
            style={{ animationDuration: '3s' }}
          />
          <div className={cn(
            'relative flex items-center justify-center w-7 h-7 rounded-full',
            oracleAnalysisContext ? 'bg-yellow-500/20' : 'bg-primary/10',
          )}>
            <Mic className={cn(
              'h-3.5 w-3.5',
              oracleAnalysisContext ? 'text-yellow-500' : 'text-primary',
            )} />
          </div>
        </div>

        {/* Label */}
        <span className="text-xs font-medium text-foreground max-w-[120px] truncate">
          {context.label}
        </span>
      </button>
    </>
  );
};

export default FloatingOracleButton;