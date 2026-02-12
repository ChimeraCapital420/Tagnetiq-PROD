// FILE: src/pages/Oracle.tsx
// Oracle Phase 2 Sprint B — Full-page chat with conversation persistence
// Conversations survive between sessions — Oracle remembers
// Mobile-first, voice + text, auto-speak toggle

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Loader2, Volume2, VolumeX, ChevronLeft, Zap, Plus, History, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useStt } from '@/hooks/useStt';
import { useTts } from '@/hooks/useTts';
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
// COMPONENT
// =============================================================================

export default function OraclePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { profile } = useAuth();
  const navigate = useNavigate();
  const { startListening, stopListening, isListening, isSupported: micSupported } = useStt();
  const { speak, isSpeaking, cancel: cancelSpeech } = useTts();
  const { t } = useTranslation();

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load most recent active conversation on mount
  useEffect(() => {
    loadRecentConversation();
  }, []);

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
        // Load the most recent conversation
        const latest = conversations[0];
        const detailRes = await fetch(`/api/oracle/conversations?id=${latest.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (detailRes.ok) {
          const { conversation } = await detailRes.json();
          setConversationId(conversation.id);
          setMessages(conversation.messages || []);
          // Get fresh chips
          loadChips(session.access_token);
          return;
        }
      }

      // No existing conversation — start fresh
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
          message: 'Hello',
          conversationHistory: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuickChips(data.quickChips || []);
        setScanCount(data.scanCount || 0);
        setVaultCount(data.vaultCount || 0);
        setConversationId(data.conversationId || null);

        setMessages([{
          role: 'assistant',
          content: data.response,
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  // ── Load chips only ───────────────────────────────────
  const loadChips = async (accessToken: string) => {
    try {
      const response = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: 'refresh chips',
          conversationHistory: messages.slice(-2),
          conversationId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuickChips(data.quickChips || []);
        setScanCount(data.scanCount || 0);
        setVaultCount(data.vaultCount || 0);
      }
    } catch { /* silent */ }
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

      // If we deleted the active conversation, start fresh
      if (id === conversationId) {
        startNewConversation(session.access_token);
      }
    } catch (err) {
      toast.error('Failed to delete conversation');
    }
  };

  // ── Send message ──────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

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

      // Update state
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.quickChips) setQuickChips(data.quickChips);
      if (data.scanCount !== undefined) setScanCount(data.scanCount);
      if (data.vaultCount !== undefined) setVaultCount(data.vaultCount);

      // Auto-speak
      if (autoSpeak && data.response) {
        const voiceURI = profile?.settings?.tts_voice_uri || null;
        const premiumVoiceId = profile?.settings?.premium_voice_id || null;
        speak(data.response, voiceURI, premiumVoiceId);
      }

    } catch (err) {
      console.error('Oracle chat error:', err);
      toast.error('Oracle had trouble responding. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, autoSpeak, profile, speak, conversationId]);

  // ── Voice input ───────────────────────────────────────
  const handleVoiceInput = useCallback(async () => {
    if (isListening) {
      stopListening();
      return;
    }
    const transcript = await startListening();
    if (transcript) sendMessage(transcript);
  }, [isListening, startListening, stopListening, sendMessage]);

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
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold leading-tight">Oracle</h1>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {scanCount > 0
                    ? `${scanCount} scans${vaultCount > 0 ? ` · ${vaultCount} vault items` : ''}`
                    : 'Ready to assist'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            key={`${msg.timestamp}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-accent/60 text-foreground rounded-bl-md'
              )}
            >
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
              placeholder={isListening ? 'Listening...' : 'Ask Oracle anything...'}
              disabled={isLoading || isListening}
              className={cn(
                'w-full px-4 py-2.5 rounded-full text-sm',
                'bg-accent/40 border border-border/50',
                'placeholder:text-muted-foreground/60',
                'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                'disabled:opacity-50',
                isListening && 'border-red-500/50 bg-red-500/10'
              )}
            />
          </div>

          {micSupported && (
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
        </div>
      </div>
    </div>
  );
}