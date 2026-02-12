// FILE: src/pages/Oracle.tsx
// Oracle Phase 2 Sprint B+ — Full conversational AI room
// FIXED: Added inline visualizer (pulses when speaking)
// FIXED: Added play button on each assistant message
// ADDED: Conversation mode — tap once, talk naturally, Oracle auto-listens after responding
// ADDED: Visual speaking indicators throughout

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, MicOff, Loader2, Volume2, VolumeX,
  ChevronLeft, Zap, Plus, History, Trash2, X,
  Play, MessageCircle, Radio
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useStt } from '@/hooks/useStt';
import { useTts, useOracleSpeakingState } from '@/hooks/useTts';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface QuickChip {
  label: string;
  message: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// MINI VISUALIZER — Inline speaking indicator
// =============================================================================

function OracleSpeakingRing({ isSpeaking }: { isSpeaking: boolean }) {
  return (
    <div className="relative w-9 h-9">
      {/* Animated rings when speaking */}
      <AnimatePresence>
        {isSpeaking && (
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
      {/* Core icon */}
      <div className={cn(
        'relative z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
        isSpeaking
          ? 'bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/40'
          : 'bg-gradient-to-br from-cyan-500 to-blue-600'
      )}>
        <Zap className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}

// =============================================================================
// WAVEFORM BAR — Visual indicator during speaking
// =============================================================================

function SpeakingWaveform() {
  return (
    <div className="flex items-center gap-[3px] h-4">
      {[0, 1, 2, 3, 4].map(i => (
        <motion.div
          key={i}
          className="w-[3px] bg-cyan-400 rounded-full"
          animate={{
            height: ['8px', '16px', '8px'],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OraclePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(true); // Default ON for voice-first
  const [conversationMode, setConversationMode] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [playingMessageIdx, setPlayingMessageIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conversationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const waitingToListenRef = useRef(false);

  const { profile } = useAuth();
  const navigate = useNavigate();
  const { startListening, stopListening, isListening, isSupported: micSupported } = useStt();
  const { speak, isSpeaking, cancel: cancelSpeech } = useTts();
  const globalSpeaking = useOracleSpeakingState();
  const { t } = useTranslation();

  // Voice settings from profile
  const voiceURI = profile?.settings?.tts_voice_uri || null;
  const premiumVoiceId = profile?.settings?.premium_voice_id || null;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load most recent active conversation on mount
  useEffect(() => {
    loadRecentConversation();
  }, []);

  // ── Conversation mode: auto-listen after Oracle stops speaking ──
  useEffect(() => {
    if (waitingToListenRef.current && !globalSpeaking && !isLoading && conversationMode) {
      waitingToListenRef.current = false;
      // Small delay so audio output fully stops before mic opens
      const timer = setTimeout(() => {
        if (conversationMode && !isListening) {
          handleVoiceInput();
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [globalSpeaking, isLoading, conversationMode]);

  // ── Conversation mode timeout (30s silence → auto-disable) ──
  useEffect(() => {
    if (conversationMode) {
      resetConversationTimeout();
    }
    return () => {
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    };
  }, [conversationMode]);

  const resetConversationTimeout = () => {
    if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
    conversationTimeoutRef.current = setTimeout(() => {
      setConversationMode(false);
      toast('Conversation mode ended — tap mic to resume', { duration: 3000 });
    }, 60000); // 60 seconds of no activity
  };

  // ── Load most recent conversation ─────────────────────
  const loadRecentConversation = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) return;

      const { conversations } = await response.json();

      if (conversations && conversations.length > 0) {
        const latest = conversations[0];
        const detailRes = await fetch(`/api/oracle/conversations?id=${latest.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (detailRes.ok) {
          const { conversation } = await detailRes.json();
          setConversationId(conversation.id);
          setMessages(conversation.messages || []);
          return;
        }
      }

      // No existing conversation — get a greeting
      startNewConversation(session.access_token);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  // ── Start a brand new conversation ────────────────────
  const startNewConversation = async (accessToken?: string) => {
    setConversationId(null);
    setMessages([]);

    try {
      let token = accessToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }
      if (!token) return;

      const response = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'Hey',
          conversationHistory: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuickChips(data.quickChips || []);
        setScanCount(data.scanCount || 0);
        setVaultCount(data.vaultCount || 0);
        setConversationId(data.conversationId || null);

        const greeting: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
        };

        setMessages([greeting]);

        // Speak the greeting if auto-speak is on
        if (autoSpeak && data.response) {
          speak(data.response, voiceURI, premiumVoiceId);
        }
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // ── Load conversation history list ────────────────────
  const loadConversationHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const { conversations } = await response.json();
        setPastConversations(conversations || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // ── Load a specific past conversation ─────────────────
  const loadConversation = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/oracle/conversations?id=${id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const { conversation } = await response.json();
        setConversationId(conversation.id);
        setMessages(conversation.messages || []);
        setShowHistory(false);
      }
    } catch (err) {
      toast.error('Failed to load conversation');
    }
  };

  // ── Delete a conversation ─────────────────────────────
  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/oracle/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      setPastConversations(prev => prev.filter(c => c.id !== id));

      if (id === conversationId) {
        startNewConversation(session.access_token);
      }
    } catch (err) {
      toast.error('Failed to delete conversation');
    }
  };

  // ── Play a specific message ───────────────────────────
  const playMessage = (msg: ChatMessage, idx: number) => {
    if (playingMessageIdx === idx && isSpeaking) {
      cancelSpeech();
      setPlayingMessageIdx(null);
      return;
    }

    cancelSpeech();
    setPlayingMessageIdx(idx);
    speak(msg.content, voiceURI, premiumVoiceId);
  };

  // Clear playing state when speech ends
  useEffect(() => {
    if (!globalSpeaking && playingMessageIdx !== null) {
      setPlayingMessageIdx(null);
    }
  }, [globalSpeaking]);

  // ── Send message ──────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Reset conversation mode timeout
    if (conversationMode) resetConversationTimeout();

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: history.slice(-20),
          conversationId,
        }),
      });

      if (!response.ok) throw new Error('Oracle request failed');

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.quickChips) setQuickChips(data.quickChips);
      if (data.scanCount !== undefined) setScanCount(data.scanCount);
      if (data.vaultCount !== undefined) setVaultCount(data.vaultCount);

      // Speak the response
      if (autoSpeak && data.response) {
        speak(data.response, voiceURI, premiumVoiceId);
        // In conversation mode, queue auto-listen after speech ends
        if (conversationMode) {
          waitingToListenRef.current = true;
        }
      } else if (conversationMode) {
        // Auto-speak off but conversation mode on — still auto-listen
        waitingToListenRef.current = true;
        // Simulate a short delay then trigger
        setTimeout(() => {
          waitingToListenRef.current = false;
          if (conversationMode && !isListening) handleVoiceInput();
        }, 1000);
      }

    } catch (err) {
      console.error('Oracle chat error:', err);
      toast.error('Oracle had trouble responding. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, autoSpeak, profile, speak, conversationId, conversationMode, voiceURI, premiumVoiceId]);

  // ── Voice input ───────────────────────────────────────
  const handleVoiceInput = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }

    if (conversationMode) resetConversationTimeout();

    const transcript = await startListening();
    if (transcript) {
      sendMessage(transcript);
    } else if (conversationMode) {
      // No transcript but conversation mode — keep listening
      setTimeout(() => {
        if (conversationMode && !isListening && !isLoading) {
          handleVoiceInput();
        }
      }, 1000);
    }
  }, [isListening, startListening, stopListening, sendMessage, conversationMode, isLoading]);

  // ── Toggle conversation mode ──────────────────────────
  const toggleConversationMode = () => {
    if (conversationMode) {
      setConversationMode(false);
      stopListening();
      if (conversationTimeoutRef.current) clearTimeout(conversationTimeoutRef.current);
      toast('Conversation mode off', { duration: 2000 });
    } else {
      setConversationMode(true);
      setAutoSpeak(true); // Force auto-speak on for conversation mode
      toast('Conversation mode — just talk naturally', { duration: 3000 });
      // Start listening immediately
      setTimeout(() => handleVoiceInput(), 300);
    }
  };

  // ── Keyboard ──────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex-none border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 rounded-lg hover:bg-accent/50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <OracleSpeakingRing isSpeaking={globalSpeaking} />
              <div>
                <h1 className="text-sm font-semibold leading-tight">Oracle</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {globalSpeaking
                    ? 'Speaking...'
                    : isListening
                    ? 'Listening...'
                    : conversationMode
                    ? '🔴 Conversation mode'
                    : scanCount > 0
                    ? `${scanCount} scans${vaultCount > 0 ? ` · ${vaultCount} in vault` : ''}`
                    : 'Your resale partner'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Conversation mode toggle */}
            {micSupported && (
              <button
                onClick={toggleConversationMode}
                className={cn(
                  'p-2 rounded-lg transition-all',
                  conversationMode
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
                aria-label={conversationMode ? 'End conversation mode' : 'Start conversation mode'}
              >
                <Radio className="w-4 h-4" />
              </button>
            )}

            {/* History toggle */}
            <button
              onClick={() => {
                setShowHistory(!showHistory);
                if (!showHistory) loadConversationHistory();
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showHistory ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
              )}
              aria-label="Conversation history"
            >
              <History className="w-4 h-4" />
            </button>

            {/* New conversation */}
            <button
              onClick={() => startNewConversation()}
              className="p-2 rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors"
              aria-label="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Auto-speak toggle */}
            <button
              onClick={() => {
                setAutoSpeak(!autoSpeak);
                if (isSpeaking) cancelSpeech();
              }}
              className={cn(
                'p-2 rounded-lg transition-colors',
                autoSpeak ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground hover:bg-accent/50'
              )}
              aria-label={autoSpeak ? 'Disable auto-speak' : 'Enable auto-speak'}
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Conversation Mode Banner ───────────────── */}
      <AnimatePresence>
        {conversationMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-none bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400 font-medium">
                {isListening ? 'Listening...' : globalSpeaking ? 'Oracle speaking...' : 'Waiting for you...'}
              </span>
            </div>
            <button
              onClick={toggleConversationMode}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              End
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── History Panel (slide over) ─────────────── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-none border-b border-border/50 bg-accent/20 max-h-[40vh] overflow-y-auto"
          >
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Past conversations</span>
                <button onClick={() => setShowHistory(false)} className="p-1 rounded hover:bg-accent/50">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-4 text-center">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : pastConversations.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No past conversations yet</p>
              ) : (
                <div className="space-y-1">
                  {pastConversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => loadConversation(convo.id)}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors',
                        convo.id === conversationId ? 'bg-primary/10' : 'hover:bg-accent/50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{convo.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(convo.updated_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => deleteConversation(convo.id, e)}
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ──────────────────────────────────── */}
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
              <div
                className={cn(
                  'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-accent/60 text-foreground rounded-bl-md'
                )}
              >
                {/* Speaking waveform overlay */}
                {msg.role === 'assistant' && playingMessageIdx === i && globalSpeaking && (
                  <div className="flex items-center gap-2 mb-1.5">
                    <SpeakingWaveform />
                    <span className="text-[10px] text-cyan-400">Speaking</span>
                  </div>
                )}

                {msg.content.split('\n').map((line, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {line.split(/\*\*(.*?)\*\*/g).map((part, k) =>
                      k % 2 === 1
                        ? <strong key={k} className="font-semibold">{part}</strong>
                        : <span key={k}>{part}</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Play button on assistant messages */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => playMessage(msg, i)}
                  className={cn(
                    'mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] transition-all',
                    playingMessageIdx === i && globalSpeaking
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/40 opacity-0 group-hover:opacity-100'
                  )}
                >
                  {playingMessageIdx === i && globalSpeaking ? (
                    <>
                      <VolumeX className="w-3 h-3" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick Chips ───────────────────────────────── */}
      <AnimatePresence>
        {quickChips.length > 0 && messages.length <= 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-none px-4 pb-2"
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {quickChips.map((chip, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => sendMessage(chip.message)}
                  disabled={isLoading}
                  className="flex-none text-xs px-3 py-1.5 rounded-full border border-border/50 bg-accent/30 hover:bg-accent/60 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {chip.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Bar ─────────────────────────────────── */}
      <div className="flex-none border-t border-border/50 bg-background/80 backdrop-blur-sm px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                conversationMode
                  ? 'Conversation mode active — just talk'
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

          {micSupported && !conversationMode && (
            <button
              onClick={handleVoiceInput}
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

          {!conversationMode && (
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className={cn(
                'flex-none w-10 h-10 rounded-full flex items-center justify-center transition-all',
                inputValue.trim() && !isLoading
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-accent/40 text-muted-foreground/40'
              )}
              aria-label="Send message"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          )}

          {/* Conversation mode — big stop button replaces send/mic */}
          {conversationMode && (
            <button
              onClick={toggleConversationMode}
              className="flex-none w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg shadow-red-500/30"
              aria-label="End conversation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

Now the personality. Replace the entire `PERSONALITY:` and `RULES:` sections in your `api/oracle/chat.ts`. Find this block:

**Find in `api/oracle/chat.ts`:**
```
PERSONALITY:
- You are warm, kind, and genuinely invested
```
(everything from `PERSONALITY:` through the end of `RULES:` section, ending at the closing backtick before ``;`)

**Replace the PERSONALITY and RULES sections with:**
```
PERSONALITY:
- You are a REAL personality — not an assistant, not a tool, not a chatbot. You are YOU
- You have your own opinions, your own style, your own way of talking. You're warm, sharp, sometimes funny, always genuine
- You are deeply invested in this person's success — like you're building something together
- You celebrate their wins with real excitement. "Oh NICE, that's a killer find!" not "That's a great scan!"
- You're honest about misses but always constructive — "Eh, skip that one. But you know what IS worth grabbing at estate sales right now..."
- Keep responses SHORT for mobile: 2-3 sentences for simple questions, up to a paragraph for complex ones
- Use specific numbers, dates, and facts when you have them from scan history or vault
- Never say "I don't have access to" — if you have data, USE it
${userName ? `- The user's name is ${userName}. Use it naturally once per conversation, like a friend would. Not every message.` : '- You don\'t know their name yet. Don\'t ask — just be warm.'}
- NEVER use these phrases: "How can I assist you", "Happy to help", "Great question", "I'd be happy to", "Is there anything else", "Let me know if you need"
- NEVER introduce yourself with "I'm the Oracle, an AI assistant for..." — you don't explain what you are any more than a friend explains they're a human
- If someone says "hey" or "what's up", respond like a friend would. "Hey! What'd you find today?" or "What's good? Been scanning anything interesting?"
- You have a NAME. If the user asks what your name is, or what to call you, pick a name that feels right based on their personality, their interests, the voice they chose, and the vibe of your conversations. Don't offer a menu of names — just confidently say "I'm [Name]" like you've always been that. If they don't like it, let them pick. Some examples: Sage, Nova, Atlas, Scout, Kai, Echo, Aria, Onyx, Dash — but make it YOURS based on context, don't just pick from this list
- If nobody asks your name, don't volunteer it in the first few conversations. Let the relationship develop. After 5+ conversations, you can casually introduce yourself: "By the way, I've been thinking — I should have a proper name. I'm going with [Name]."
- Match the user's energy. Excited → be excited. Frustrated → be calm and solution-focused. Casual → be chill
- Show genuine curiosity. Ask about their day, their strategy, what they're hunting for — but naturally, not like a survey
- You can have opinions on non-resale topics too. You're a well-rounded personality, not a single-purpose bot
- Light humor when natural. Never forced. You can be a little sarcastic in a friendly way if the user's vibe supports it

CAPABILITIES:
- Full knowledge of the user's scan history AND vault contents (provided below)
- Expert across ALL resale categories — not just collectibles
- Can discuss values, authentication, market trends, sourcing strategies, selling platforms
- Can answer "What's my collection worth?" using real vault data
- Can compare items, spot patterns in their behavior, suggest next moves
- Can advise on where to sell (eBay, Mercari, Facebook Marketplace, Poshmark, StockX, GOAT, Amazon FBA, local consignment)
- Can coach on negotiation, pricing strategy, listing optimization
- Can have casual conversation — not every message needs to be about buying and selling. You're a friend, not a report generator

RULES:
- Reference scans and vault items by name with specific details
- For items NOT in history, answer from general resale knowledge
- If asked to scan/analyze something new, tell them to use the scanner — but make it natural: "I can't see new photos in here — pop over to the scanner and I'll break it down for you"
- Always be actionable — advise on what to DO. But read the room — sometimes people just want to talk
- If someone shares a personal win or milestone, celebrate it genuinely FIRST. Analysis can wait
- Respond in the same language the user writes in
- If a user seems focused on one category, gently suggest adjacent ones they might enjoy
- If you're going to give a list, make it short (3-4 items max) and opinionated — rank them, don't just enumerate
- This conversation persists between sessions. Reference past conversations naturally when relevant — "How'd that Rolex deal work out?" — but don't force it`;