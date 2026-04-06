// FILE: src/components/OracleBar.tsx
// ═══════════════════════════════════════════════════════════════════════
// Oracle Bar — Persistent bottom bar. Your Oracle is always with you.
// ═══════════════════════════════════════════════════════════════════════
//
// Replaces OracleVoiceButton (the blue circle).
//
// DESIGN — collapsed (52px, always visible):
//   [ ⚡  Ask your Oracle…                   🔊  🎤 ]
//   Quiet. Matches app chrome. Never fights content above it.
//
// DESIGN — expanded (sheet slides up):
//   Context chips pre-loaded from current screen + active scan result.
//   Voice input — mic auto-starts on expand (getUserMedia gate).
//   Oracle response appears inline — user never leaves their screen.
//   Oracle speaks the response unless muted.
//   "Open full chat →" link if they want deeper conversation.
//
// MUTE TOGGLE:
//   Speaker icon in collapsed bar. One tap → Oracle goes silent.
//   Persisted to localStorage — survives page refresh.
//   Use case: auction floor, private home, competitors nearby.
//
// CONTEXT AWARENESS:
//   isScannerOpen   → scanner tips chips, Oracle helps with the shot
//   active scan     → item-specific chips (List this, Is this a good price?)
//   /vault          → vault chips
//   /marketplace    → market chips
//   /hunt           → hunt chips
//
// HIDDEN ON: /oracle (user is already in full chat)
//
// API: Calls /api/oracle/chat directly. Same body shape as useSendMessage.
//      Maintains its own lightweight conversationId so Oracle has context
//      across bar interactions. Full conversation lives on /oracle.
//
// RULES OF HOOKS: All hooks declared before any conditional return.
// ═══════════════════════════════════════════════════════════════════════

import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Zap, Mic, MicOff, Send, X, ChevronRight,
  Volume2, VolumeX, Loader2, ExternalLink,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useOracleVoice } from '@/hooks/useOracleVoice';
import { supabase } from '@/lib/supabase';
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
  if (isScannerOpen) {
    return {
      placeholder: 'Ask your Oracle for scanning tips…',
      systemContext: "I have the scanner open and I'm about to photograph an item. ",
      chips: [
        'Best angle for this shot?',
        'Tips for bad lighting?',
        'What details matter most?',
        'Reflective surface tips?',
      ],
    };
  }

  const isHome = pathname === '/' || pathname.startsWith('/dashboard');

  if (isHome && itemName) {
    const val = estimatedValue ? ` (~$${estimatedValue})` : '';
    return {
      placeholder: `Ask your Oracle about ${itemName}…`,
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
      placeholder: 'Ask your Oracle anything…',
      systemContext: '',
      chips: [
        'What should I scan today?',
        'Best items to resell?',
        'How does HYDRA work?',
        'Help me find deals',
      ],
    };
  }

  if (pathname.startsWith('/vault')) {
    return {
      placeholder: 'Ask your Oracle about your vault…',
      systemContext: "I'm reviewing my vault. ",
      chips: [
        "What's my collection worth?",
        'Best items to sell now?',
        'Compare to market',
        'Set a price alert',
      ],
    };
  }

  if (pathname.includes('/marketplace') || pathname.startsWith('/arena')) {
    return {
      placeholder: 'Ask your Oracle about the market…',
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
      placeholder: 'Ask your Oracle for hunt tips…',
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
    placeholder: 'Ask your Oracle anything…',
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

  // ── All state/refs declared first — Rules of Hooks ─────────────────
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oracleResponse, setOracleResponse] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messageHistory, setMessageHistory] = useState<Array<{ role: string; content: string }>>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Voice input (mic → text) ────────────────────────────────────────
  const voice = useVoiceInput({
    continuous: false,
    interimResults: true,
    onFinalTranscript: (text) => {
      setInputText(prev => prev ? `${prev} ${text}`.trim() : text);
    },
  });

  // ── Oracle voice output (text → speech) ──────────────────────────────
  const oracle = useOracleVoice();

  // ── Computed values (no hooks below this line) ──────────────────────
  const isOnOracle = location.pathname.startsWith('/oracle');
  const itemName = oracleAnalysisContext?.itemName ?? null;
  const estimatedValue = oracleAnalysisContext?.estimatedValue ?? null;

  const context = deriveContext(
    location.pathname,
    isScannerOpen,
    isAnalyzing,
    itemName,
    estimatedValue,
  );

  // ── Collapse on route change ────────────────────────────────────────
  useEffect(() => {
    setIsExpanded(false);
    voice.stopListening();
    voice.reset();
    setInputText('');
    setOracleResponse(null);
    // Don't clear conversationId — Oracle remembers the thread
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rules of Hooks satisfied — early return is safe here ───────────
  if (isOnOracle) return null;

  // ── Expand ──────────────────────────────────────────────────────────
  const expand = () => {
    setIsExpanded(true);
    setOracleResponse(null);
    setInputText('');
    setTimeout(() => {
      if (voice.isSupported && !isAnalyzing) void voice.startListening();
      inputRef.current?.focus();
    }, 300);
  };

  const collapse = () => {
    setIsExpanded(false);
    voice.stopListening();
    voice.reset();
    setInputText('');
    oracle.stop();
  };

  // ── Call Oracle API inline ──────────────────────────────────────────
  const askOracle = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const fullMessage = context.systemContext
      ? `${context.systemContext}${trimmed}`
      : trimmed;

    setIsLoading(true);
    setOracleResponse(null);

    // Update local history
    const newHistory = [
      ...messageHistory,
      { role: 'user', content: fullMessage },
    ].slice(-20); // keep last 20 turns

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: fullMessage,
          conversationHistory: newHistory.slice(0, -1), // history before this message
          conversationId: conversationId || undefined,
          analysisContext: oracleAnalysisContext || undefined,
          clientContext: {
            deviceType: 'mobile',
            timestamp: Date.now(),
            source: 'oracle_bar',
          },
        }),
      });

      if (!res.ok) throw new Error('Oracle is thinking — try again.');

      const data = await res.json();
      const response: string = data.response || "I'm here — what do you need?";

      // Store conversation state for continuity
      if (data.conversationId) setConversationId(data.conversationId);
      setMessageHistory([
        ...newHistory,
        { role: 'assistant', content: response },
      ]);

      setOracleResponse(response);

      // Oracle speaks — unless muted
      oracle.speak(response);

    } catch (err: any) {
      const msg = err?.message || 'Something went wrong. Try again.';
      setOracleResponse(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    const text = (inputText || voice.interimTranscript).trim();
    if (text) {
      voice.stopListening();
      askOracle(text);
      setInputText('');
    }
  };

  const handleChip = (chip: string) => {
    askOracle(chip);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const goToFullChat = () => {
    if (oracleResponse) {
      // Carry the thread into the full Oracle page
      sessionStorage.setItem('oracle_bar_thread', JSON.stringify({
        conversationId,
        lastMessage: inputText || voice.interimTranscript,
        lastResponse: oracleResponse,
      }));
    }
    collapse();
    navigate('/oracle');
  };

  const displayText = inputText || voice.interimTranscript || '';
  const canSend = displayText.trim().length > 0 && !isLoading;

  const barLabel = isAnalyzing
    ? 'Analyzing…'
    : oracle.isSpeaking
      ? 'Oracle is speaking…'
      : itemName
        ? `Ask your Oracle about ${itemName.length > 16 ? itemName.slice(0, 14) + '…' : itemName}`
        : 'Ask your Oracle…';

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px]"
          onClick={collapse}
          aria-hidden="true"
        />
      )}

      {/* ── Expanded sheet ─────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed left-0 right-0 z-50',
          'bg-background border-t border-border/50',
          'shadow-2xl rounded-t-2xl',
          'transform transition-transform duration-300 ease-out',
          // Sits directly above the collapsed bar
          'bottom-[calc(52px+env(safe-area-inset-bottom,0px))]',
          isExpanded ? 'translate-y-0' : 'translate-y-full pointer-events-none',
        )}
        style={{ maxHeight: '65vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="px-4 pb-3 overflow-y-auto space-y-3"
          style={{ maxHeight: 'calc(65vh - 32px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                <Zap className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm font-semibold">Oracle</span>
              {oracle.isSpeaking && (
                <span className="text-[10px] text-primary animate-pulse">speaking…</span>
              )}
            </div>
            <button onClick={collapse} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Chips — only when no response yet and not loading */}
          {!oracleResponse && !isLoading && (
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
              {context.chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChip(chip)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1 min-h-[36px]',
                    'text-xs px-3 py-2 rounded-full whitespace-nowrap',
                    'bg-muted hover:bg-muted/70 border border-border/40',
                    'transition-colors',
                  )}
                >
                  {chip}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-2 py-3 px-1">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <span className="text-sm text-muted-foreground">Oracle is thinking…</span>
            </div>
          )}

          {/* Oracle response */}
          {oracleResponse && !isLoading && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/60 border border-border/30 px-3 py-3">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {oracleResponse}
                </p>
              </div>

              {/* Actions after response */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    oracle.isSpeaking ? oracle.stop() : oracle.speak(oracleResponse);
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {oracle.isSpeaking
                    ? <><VolumeX className="h-3.5 w-3.5" /> Stop speaking</>
                    : <><Volume2 className="h-3.5 w-3.5" /> Hear it again</>
                  }
                </button>
                <button
                  onClick={goToFullChat}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Full conversation
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>

              {/* New question input after response */}
              <div className="flex gap-2 items-end pt-1">
                <textarea
                  ref={inputRef}
                  value={displayText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up…"
                  rows={1}
                  disabled={voice.isListening || isLoading}
                  className={cn(
                    'flex-1 resize-none rounded-xl border border-border/50',
                    'bg-muted/50 px-3 py-2 text-sm',
                    'placeholder:text-muted-foreground/50',
                    'focus:outline-none focus:ring-1 focus:ring-primary/30',
                  )}
                />
                <button
                  onClick={voice.isListening ? voice.stopListening : () => void voice.startListening()}
                  disabled={!voice.isSupported}
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    voice.isListening ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                  )}
                >
                  {voice.isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    canSend ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground opacity-30 cursor-not-allowed',
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Initial input — when no response yet */}
          {!oracleResponse && !isLoading && (
            <div>
              {/* Listening indicator */}
              {voice.isListening && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-end gap-[3px] h-3">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-[3px] rounded-full bg-red-500 animate-pulse"
                        style={{ height: `${45 + i * 11}%`, animationDelay: `${i * 90}ms` }} />
                    ))}
                  </div>
                  <span className="text-xs text-red-400 font-medium">Listening…</span>
                  <button onClick={voice.stopListening} className="ml-auto text-xs text-red-400 underline">Done</button>
                </div>
              )}

              {voice.error && (
                <p className="text-xs text-destructive mb-2 px-1">{voice.error}</p>
              )}

              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={displayText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={context.placeholder}
                  rows={2}
                  disabled={voice.isListening || isLoading}
                  className={cn(
                    'flex-1 resize-none rounded-xl border border-border/50',
                    'bg-muted/50 px-3 py-2.5 text-sm',
                    'placeholder:text-muted-foreground/50',
                    'focus:outline-none focus:ring-1 focus:ring-primary/30',
                    voice.isListening && 'opacity-50',
                  )}
                />
                <button
                  onClick={voice.isListening ? voice.stopListening : () => void voice.startListening()}
                  disabled={!voice.isSupported}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    voice.isListening ? 'bg-red-500 text-white shadow-md shadow-red-500/25' : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    !voice.isSupported && 'opacity-30 cursor-not-allowed',
                  )}
                  aria-label={voice.isListening ? 'Stop' : 'Speak to Oracle'}
                >
                  {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
                    canSend ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground opacity-30 cursor-not-allowed',
                  )}
                  aria-label="Ask Oracle"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      </div>

      {/* ── Collapsed bar — always visible ───────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-background/96 backdrop-blur-sm border-t border-border/40',
          'flex items-center px-4 gap-3',
        )}
        style={{ height: 'calc(52px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Oracle icon */}
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          isAnalyzing ? 'bg-primary/20' : 'bg-primary/10',
        )}>
          <Zap className={cn(
            'h-3.5 w-3.5',
            isAnalyzing ? 'text-primary animate-pulse' : 'text-primary/70',
          )} />
        </div>

        {/* Tap target */}
        <button
          onClick={isAnalyzing ? undefined : expand}
          disabled={isAnalyzing}
          className="flex-1 text-left text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors focus:outline-none"
          aria-label="Ask Oracle"
          aria-expanded={isExpanded}
        >
          {barLabel}
        </button>

        {/* Mute toggle — one tap silences Oracle */}
        <button
          onClick={oracle.toggleMute}
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
            oracle.isMuted
              ? 'text-muted-foreground/40 hover:text-muted-foreground'
              : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted',
          )}
          aria-label={oracle.isMuted ? 'Unmute Oracle' : 'Mute Oracle'}
          title={oracle.isMuted ? 'Oracle is muted — tap to unmute' : 'Mute Oracle'}
        >
          {oracle.isMuted
            ? <VolumeX className="h-3.5 w-3.5" />
            : <Volume2 className="h-3.5 w-3.5" />
          }
        </button>

        {/* Mic shortcut */}
        {!isAnalyzing && (
          <button
            onClick={expand}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Speak to Oracle"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  );
};

export default OracleBar;