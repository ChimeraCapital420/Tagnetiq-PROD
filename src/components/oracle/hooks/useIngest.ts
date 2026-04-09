// FILE: src/components/oracle/hooks/useIngest.ts
// Oracle Ingest Sub-Hook
//
// Handles:
//   sendDocument(file, question?) → extracts text client-side → oracle/chat.ts
//   sendUrl(url, question?)       → server fetches via oracle/ingest.ts → oracle/chat.ts
//
// Mobile-first:
//   Documents: all extraction on device. Server receives text only.
//   URLs: server fetches (cross-origin blocked in browser).
//   Videos: thumbnail extracted on device, routed to see.ts via useVision.
//
// Mirrors the shape of useSendMessage / useVision sub-hooks.

import { useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { supabase } from '@/lib/supabase';
import { extractDocument, formatFileSize, getFileEmoji } from '@/lib/oracle/ingest';
import type { ChatMessage } from '../types';

// =============================================================================
// SHARED BAG — same pattern as useSendMessage / useVision
// =============================================================================

interface IngestShared {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  conversationId: string | null;
  messageCountRef: MutableRefObject<number>;
  analysisContext: any;
}

// =============================================================================
// HELPERS
// =============================================================================

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

function buildTextHistory(
  messages: ChatMessage[]
): Array<{ role: string; content: string }> {
  // Last 6 text messages only — no image/attachment data
  return messages
    .filter(m => m.content && m.content.length > 0)
    .slice(-6)
    .map(m => ({ role: m.role, content: m.content }));
}

function makeUserMsg(content: string): ChatMessage {
  return { role: 'user', content, timestamp: Date.now() };
}

function makeAssistantMsg(content: string): ChatMessage {
  return { role: 'assistant', content, timestamp: Date.now() };
}

// =============================================================================
// HOOK
// =============================================================================

export function useIngest(shared: IngestShared) {
  const {
    messages, setMessages,
    isLoading, setIsLoading,
    conversationId, messageCountRef,
  } = shared;

  // ── Send Document ───────────────────────────────────────────────────
  // Extracts text client-side, sends enriched message to oracle/chat.ts

  const sendDocument = useCallback(async (
    file: File,
    question?: string,
  ): Promise<string | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    const emoji = getFileEmoji(file);
    const sizeLabel = formatFileSize(file.size);

    // Show user message immediately
    const userContent = [
      `${emoji} ${file.name} · ${sizeLabel}`,
      question || '',
    ].filter(Boolean).join('\n');

    setMessages(prev => {
      messageCountRef.current++;
      return [...prev, makeUserMsg(userContent)];
    });

    try {
      // 1. Extract text on device
      const extracted = await extractDocument(file);

      // 2. Build the full context message Oracle will see
      const lines: string[] = [
        `[Attached Document: ${extracted.fileName}]`,
        `Type: ${extracted.mimeType} | Size: ${sizeLabel} | Words: ${extracted.wordCount}${extracted.pageCount ? ` | Pages: ${extracted.pageCount}` : ''}`,
      ];

      if (extracted.truncated) {
        lines.push('⚠️ Document was long — first 12,000 characters shown.');
      }

      lines.push('', '─── Document Content ───', extracted.text, '─── End Document ───');

      if (question?.trim()) {
        lines.push('', question.trim());
      } else {
        lines.push('', 'Please analyze this document. Summarize the key points, highlight important information, and flag anything I should pay attention to.');
      }

      const oracleMessage = lines.join('\n');

      // 3. Call Oracle chat
      const token = await getAuthToken();
      const resp = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: oracleMessage,
          conversationHistory: buildTextHistory(messages),
          conversationId,
          lightweight: false,
        }),
      });

      if (!resp.ok) throw new Error(`Oracle error: ${resp.status}`);
      const data = await resp.json();

      const responseText: string = data.response || 'I processed your document but had trouble responding. Try again.';

      setMessages(prev => {
        messageCountRef.current++;
        return [...prev, makeAssistantMsg(responseText)];
      });

      return responseText;

    } catch (err: any) {
      console.error('[useIngest] Document error:', err.message);

      const errMsg = err.message?.includes('.doc files') || err.message?.includes('pdfjs-dist') || err.message?.includes('mammoth')
        ? err.message
        : 'Could not read that document. Try PDF, DOCX, or TXT format.';

      setMessages(prev => {
        messageCountRef.current++;
        return [...prev, makeAssistantMsg(errMsg)];
      });

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, conversationId, setIsLoading, setMessages, messageCountRef]);

  // ── Send URL ────────────────────────────────────────────────────────
  // Server fetches URL content, Oracle analyzes it

  const sendUrl = useCallback(async (
    url: string,
    question?: string,
  ): Promise<string | null> => {
    if (isLoading) return null;
    setIsLoading(true);

    let domain = url;
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}

    // Show user message immediately
    const userContent = [
      `🔗 ${domain}`,
      question || '',
    ].filter(Boolean).join('\n');

    setMessages(prev => {
      messageCountRef.current++;
      return [...prev, makeUserMsg(userContent)];
    });

    try {
      const token = await getAuthToken();

      // 1. Server fetches URL
      const ingestResp = await fetch('/api/oracle/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'url', url }),
      });

      if (!ingestResp.ok) {
        const errData = await ingestResp.json().catch(() => ({}));
        throw new Error(errData.error || `Could not fetch URL (${ingestResp.status})`);
      }

      const ingestData = await ingestResp.json();

      // 2. Build Oracle message
      const lines: string[] = [
        `[Web Page: ${ingestData.title || domain}]`,
        `URL: ${url}`,
        `Domain: ${ingestData.domain}`,
      ];

      if (ingestData.description) {
        lines.push(`Summary: ${ingestData.description}`);
      }

      lines.push('', '─── Page Content ───', ingestData.content, '─── End Content ───');

      if (question?.trim()) {
        lines.push('', question.trim());
      } else {
        lines.push('', 'Please analyze this web page. What is it about? What are the key points? Is there anything important I should know or act on?');
      }

      const oracleMessage = lines.join('\n');

      // 3. Call Oracle chat
      const chatResp = await fetch('/api/oracle/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: oracleMessage,
          conversationHistory: buildTextHistory(messages),
          conversationId,
          lightweight: false,
        }),
      });

      if (!chatResp.ok) throw new Error(`Oracle error: ${chatResp.status}`);
      const chatData = await chatResp.json();

      const responseText: string = chatData.response || 'I analyzed the page but had trouble responding.';

      setMessages(prev => {
        messageCountRef.current++;
        return [...prev, makeAssistantMsg(responseText)];
      });

      return responseText;

    } catch (err: any) {
      console.error('[useIngest] URL error:', err.message);
      setMessages(prev => {
        messageCountRef.current++;
        return [...prev, makeAssistantMsg(err.message || 'Could not load that URL. Make sure it is publicly accessible.')];
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, conversationId, setIsLoading, setMessages, messageCountRef]);

  return { sendDocument, sendUrl };
}