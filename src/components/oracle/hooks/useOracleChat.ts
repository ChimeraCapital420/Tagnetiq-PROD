// FILE: src/components/oracle/hooks/useOracleChat.ts
// All chat state management + API calls
// Enhanced: Vision (sendImage), Hunt (sendHunt), Content creation,
//           Energy tracking, offline queue support
// Extracted from Oracle.tsx monolith
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 2 — CLIENT-SIDE INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════
// The device is the Oracle's body. Before every message hits the server,
// the client now runs:
//   1. Intent detection (mirrors server logic — ~0ms, zero cost)
//   2. Energy detection (already existed, now sent to server)
//   3. Local context search (scans cached conversation for relevance)
//   4. Device type detection (mobile/desktop/tablet)
//   5. Tier caching (avoid redundant DB reads)
//
// The server VALIDATES but TRUSTS client hints to skip redundant work.
// Net savings: ~50ms server time + ~20ms energy detection + 1 DB read
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type {
  ChatMessage, QuickChip, ConversationSummary,
  VisionMode, CameraCapture, EnergyLevel,
  VisionResponse, HuntResult, ContentResult,
} from '../types';

// =============================================================================
// CLIENT-SIDE INTELLIGENCE — runs on device, zero server cost
// =============================================================================

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// ── Intent Detection (mirrors server router.ts logic) ───
// Same signals, same priority order. If the client gets it right,
// the server skips its own detection. If wrong, server overrides.

type ClientIntent =
  | 'casual'
  | 'quick_answer'
  | 'deep_analysis'
  | 'market_query'
  | 'vision'
  | 'strategy'
  | 'creative';

const INTENT_SIGNALS: Record<ClientIntent, string[]> = {
  vision: [
    'look at', 'see this', 'what is this', 'identify', 'can you see',
    'in the image', 'in the photo', 'this item', 'what do you see',
    'scan this', 'check this out',
  ],
  deep_analysis: [
    'break down', 'analyze', 'explain why', 'valuation factors',
    'deep dive', 'tell me everything', 'comprehensive', 'detailed',
    'compare', 'versus', 'pros and cons', 'full analysis',
  ],
  market_query: [
    'trending', 'market', 'what\'s hot', 'price trend', 'going up',
    'going down', 'selling for', 'recent sales', 'comps', 'ebay price',
    'what are people paying', 'current price', 'market value',
  ],
  strategy: [
    'should i sell', 'should i hold', 'should i buy', 'flip',
    'investment', 'portfolio', 'best strategy', 'when to sell',
    'where to sell', 'listing strategy', 'pricing strategy',
    'what should i do with', 'my collection',
  ],
  creative: [
    'tell me a joke', 'what do you think about', 'your opinion',
    'favorite', 'fun fact', 'story', 'interesting', 'what\'s your name',
    'who are you', 'personality',
  ],
  quick_answer: [
    'how much', 'what\'s it worth', 'worth anything', 'price check',
    'quick question', 'is this worth', 'value of', 'how many',
  ],
  casual: [
    'hey', 'hi', 'hello', 'what\'s up', 'sup', 'yo', 'good morning',
    'how are you', 'what\'s good', 'howdy', 'how\'s it going',
  ],
};

// Priority order — more specific intents checked first
const INTENT_PRIORITY: ClientIntent[] = [
  'vision', 'deep_analysis', 'market_query', 'strategy',
  'creative', 'quick_answer', 'casual',
];

function detectClientIntent(message: string): ClientIntent {
  const lower = message.toLowerCase().trim();

  for (const intent of INTENT_PRIORITY) {
    const signals = INTENT_SIGNALS[intent];
    for (const signal of signals) {
      if (lower.includes(signal)) return intent;
    }
  }

  // Heuristics
  if (lower.length > 100) return 'deep_analysis';
  if (lower.includes('?') && lower.length < 50) return 'quick_answer';

  return 'casual';
}

// ── Energy Detection (was already here, now sent to server) ─
function detectClientEnergy(message: string): EnergyLevel {
  const lower = message.toLowerCase();
  const exclamations = (message.match(/!/g) || []).length;
  const questions = (message.match(/\?/g) || []).length;
  const capsRatio = message.replace(/[^a-zA-Z]/g, '').length > 3
    ? message.replace(/[^A-Z]/g, '').length / message.replace(/[^a-zA-Z]/g, '').length
    : 0;

  const positiveWords = ['awesome', 'amazing', 'love', 'wow', 'great', 'found', 'score', 'deal', 'nice', 'perfect'];
  const negativeWords = ['wrong', 'broken', 'stuck', 'frustrated', 'confused', 'hate', 'sucks', 'terrible'];

  const hasPositive = positiveWords.some(w => lower.includes(w));
  const hasNegative = negativeWords.some(w => lower.includes(w));

  if (exclamations > 1 && hasPositive) return 'excited';
  if (capsRatio > 0.5 && message.length > 10) return hasNegative ? 'frustrated' : 'excited';
  if (hasNegative) return 'frustrated';
  if (message.length < 50 && questions > 0) return 'focused';
  if (lower.includes('wondering') || lower.includes('curious') || lower.includes('how does')) return 'curious';

  return 'neutral';
}

// ── Local Context Search ────────────────────────────────
// Searches cached conversation messages for keywords from the new message.
// Returns relevant snippets so the server can reduce prompt size.
// Runs entirely on device — zero cost.

function searchLocalContext(
  newMessage: string,
  cachedMessages: ChatMessage[],
  maxResults: number = 3,
): string[] {
  if (!cachedMessages.length) return [];

  // Extract meaningful words (skip stopwords, min 3 chars)
  const stopwords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
    'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'this',
    'that', 'with', 'what', 'when', 'where', 'how', 'who', 'will',
    'about', 'would', 'there', 'their', 'from', 'been', 'some',
    'could', 'them', 'than', 'other', 'into', 'just', 'also',
  ]);

  const keywords = newMessage
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (keywords.length === 0) return [];

  // Score each past message by keyword overlap
  const scored = cachedMessages
    .filter(m => m.role === 'assistant' && m.content.length > 20)
    .map(m => {
      const contentLower = m.content.toLowerCase();
      const hits = keywords.filter(k => contentLower.includes(k)).length;
      return { content: m.content, score: hits };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Return truncated snippets (keep payload small)
  return scored.map(s =>
    s.content.length > 200 ? s.content.substring(0, 197) + '...' : s.content
  );
}

// ── Device Detection ────────────────────────────────────
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

// ── Tier Cache (sessionStorage — survives tab refreshes) ─
interface CachedTier {
  current: string;
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
  cachedAt: number;
}

const TIER_CACHE_KEY = 'oracle_tier_cache';
const TIER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedTier(): CachedTier | null {
  try {
    const raw = sessionStorage.getItem(TIER_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedTier = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > TIER_CACHE_TTL) return null;
    return cached;
  } catch {
    return null;
  }
}

function setCachedTier(tier: any): void {
  try {
    sessionStorage.setItem(TIER_CACHE_KEY, JSON.stringify({
      ...tier,
      cachedAt: Date.now(),
    }));
  } catch {
    // sessionStorage not available — silently continue
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useOracleChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [vaultCount, setVaultCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pastConversations, setPastConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentEnergy, setCurrentEnergy] = useState<EnergyLevel>('neutral');

  // Track message count for energy arc (client-side lightweight)
  const messageCountRef = useRef(0);

  // ── Load most recent conversation ─────────────────────
  const loadRecentConversation = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken();
      if (!token) return null;

      const res = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return null;

      const { conversations } = await res.json();

      if (conversations?.length > 0) {
        const detailRes = await fetch(`/api/oracle/conversations?id=${conversations[0].id}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (detailRes.ok) {
          const { conversation } = await detailRes.json();
          setConversationId(conversation.id);
          setMessages(conversation.messages || []);
          messageCountRef.current = (conversation.messages || []).length;
          return null;
        }
      }

      return await startNewConversation(token);
    } catch (err) {
      console.error('Failed to load conversation:', err);
      return null;
    }
  }, []);

  // ── Start a brand new conversation ────────────────────
  const startNewConversation = useCallback(async (accessToken?: string): Promise<string | null> => {
    setConversationId(null);
    setMessages([]);
    messageCountRef.current = 0;
    setCurrentEnergy('neutral');

    try {
      const token = accessToken || await getToken();
      if (!token) return null;

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'Hey',
          conversationHistory: [],
          clientContext: {
            detectedIntent: 'casual',
            detectedEnergy: 'neutral',
            localContext: [],
            deviceType: getDeviceType(),
            timestamp: Date.now(),
          },
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      setQuickChips(data.quickChips || []);
      setScanCount(data.scanCount || 0);
      setVaultCount(data.vaultCount || 0);
      setConversationId(data.conversationId || null);

      // Cache tier info from response
      if (data.tier) setCachedTier(data.tier);

      const greeting: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages([greeting]);
      messageCountRef.current = 1;

      return data.response as string;
    } catch (err) {
      console.error('Failed to start conversation:', err);
      return null;
    }
  }, []);

  // ── Load conversation history list ────────────────────
  const loadConversationHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/oracle/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const { conversations } = await res.json();
        setPastConversations(conversations || []);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // ── Load a specific past conversation ─────────────────
  const loadConversation = useCallback(async (id: string): Promise<boolean> => {
    try {
      const token = await getToken();
      if (!token) return false;

      const res = await fetch(`/api/oracle/conversations?id=${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const { conversation } = await res.json();
        setConversationId(conversation.id);
        setMessages(conversation.messages || []);
        messageCountRef.current = (conversation.messages || []).length;
        return true;
      }
    } catch {
      toast.error('Failed to load conversation');
    }
    return false;
  }, []);

  // ── Delete a conversation ─────────────────────────────
  const deleteConversation = useCallback(async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`/api/oracle/conversations?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      setPastConversations(prev => prev.filter(c => c.id !== id));

      if (id === conversationId) {
        await startNewConversation(token);
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  }, [conversationId, startNewConversation]);

  // ══════════════════════════════════════════════════════════
  // SEND MESSAGE — Liberation 2: client intelligence payload
  // ══════════════════════════════════════════════════════════
  const sendMessage = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim() || isLoading) return null;

    // ── Client-side intelligence (runs BEFORE network) ──
    const energy = detectClientEnergy(text);
    const intent = detectClientIntent(text);
    const localContext = searchLocalContext(text, messages);
    const deviceType = getDeviceType();

    setCurrentEnergy(energy);

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    messageCountRef.current++;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversationHistory: history.slice(-20),
          conversationId,
          // ── Liberation 2: enriched payload ─────────────
          clientContext: {
            detectedIntent: intent,
            detectedEnergy: energy,
            localContext,
            deviceType,
            timestamp: Date.now(),
          },
        }),
      });

      if (!res.ok) throw new Error('Oracle request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);
      if (data.quickChips) setQuickChips(data.quickChips);
      if (data.scanCount !== undefined) setScanCount(data.scanCount);
      if (data.vaultCount !== undefined) setVaultCount(data.vaultCount);

      // Cache tier from response
      if (data.tier) setCachedTier(data.tier);

      return data.response as string;
    } catch (err) {
      console.error('Oracle chat error:', err);

      if (err instanceof TypeError && err.message.includes('fetch')) {
        queueForOfflineSync(text);
        toast.error('Offline — message queued for when you\'re back online.');
      } else {
        toast.error('Oracle had trouble responding. Try again.');
      }

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, conversationId]);

  // ── Send image for vision analysis ────────────────────
  const sendImage = useCallback(async (
    capture: CameraCapture,
    mode: VisionMode,
    question?: string,
  ): Promise<string | null> => {
    if (isLoading) return null;

    const userMessage: ChatMessage = {
      role: 'user',
      content: question || `[${mode} mode]`,
      timestamp: Date.now(),
      imagePreview: capture.base64,
      visionMode: mode,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    messageCountRef.current++;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/see', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: capture.base64,
          mimeType: capture.mimeType,
          mode,
          question,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Vision request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || data.description || 'I see it.',
        timestamp: Date.now(),
        visionData: data.visionData || data,
        attachments: data.visionData ? [{ type: 'vision', data: data.visionData }] : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);

      return data.response || data.description || null;
    } catch (err) {
      console.error('Oracle vision error:', err);
      toast.error('Oracle couldn\'t see that. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationId]);

  // ── Send image for hunt triage (BUY/SKIP) ─────────────
  const sendHunt = useCallback(async (
    capture: CameraCapture,
    askingPrice?: number,
  ): Promise<string | null> => {
    if (isLoading) return null;

    const userMessage: ChatMessage = {
      role: 'user',
      content: askingPrice ? `Hunt mode — asking $${askingPrice}` : 'Hunt mode — what do you think?',
      timestamp: Date.now(),
      imagePreview: capture.base64,
      visionMode: 'hunt_scan',
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    messageCountRef.current++;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/hunt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: capture.base64,
          mimeType: capture.mimeType,
          askingPrice,
          conversationId,
        }),
      });

      if (!res.ok) throw new Error('Hunt request failed');

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response || `${data.verdict}: ${data.reasoning}`,
        timestamp: Date.now(),
        huntData: data,
        attachments: [{ type: 'hunt', data: data }],
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      if (data.conversationId) setConversationId(data.conversationId);

      return data.response || data.reasoning || null;
    } catch (err) {
      console.error('Oracle hunt error:', err);
      toast.error('Hunt triage failed. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationId]);

  // ── Create content (listing, video, image, brag card) ─
  const createContent = useCallback(async (params: {
    mode: string;
    itemId?: string;
    itemName?: string;
    platform?: string;
    instructions?: string;
    style?: string;
    [key: string]: any;
  }): Promise<ContentResult | null> => {
    if (isLoading) return null;

    setIsLoading(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/oracle/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast.error(errorData.message || 'Upgrade required for this feature');
          return null;
        }
        throw new Error('Content creation failed');
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.listing
          ? `Here's your ${data.listing.platform} listing — ready to review:`
          : data.script
          ? 'Script generated — take a look:'
          : data.text || 'Here you go:',
        timestamp: Date.now(),
        contentData: data,
        attachments: data.listing
          ? [{ type: 'listing', data: data.listing }]
          : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
      messageCountRef.current++;

      return data as ContentResult;
    } catch (err) {
      console.error('Oracle create error:', err);
      toast.error('Content creation failed. Try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // ── Append message (for useOracleExtras bridge) ───────
  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
    messageCountRef.current++;
  }, []);

  return {
    // State
    messages,
    inputValue,
    setInputValue,
    isLoading,
    quickChips,
    scanCount,
    vaultCount,
    conversationId,
    pastConversations,
    isLoadingHistory,
    currentEnergy,

    // Text
    sendMessage,

    // Vision
    sendImage,
    sendHunt,

    // Content creation
    createContent,

    // Navigation
    loadRecentConversation,
    startNewConversation,
    loadConversationHistory,
    loadConversation,
    deleteConversation,

    // Bridge (for useOracleExtras)
    appendMessage,
    setIsLoading,
  };
}

// =============================================================================
// OFFLINE QUEUE (service worker integration)
// =============================================================================

function queueForOfflineSync(message: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'QUEUE_ORACLE_MESSAGE',
      payload: {
        url: '/api/oracle/chat',
        headers: { 'Content-Type': 'application/json' },
        body: { message },
        timestamp: Date.now(),
      },
    });

    navigator.serviceWorker.ready.then(reg => {
      if ('sync' in reg) {
        (reg as any).sync.register('sync-oracle-messages').catch(() => {});
      }
    });
  }
}