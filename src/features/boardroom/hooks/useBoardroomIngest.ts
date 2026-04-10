// FILE: src/features/boardroom/hooks/useBoardroomIngest.ts
// Board Media Ingest Hook
//
// Handles document, URL, and image attachments for board conversations.
// Domain-aware: passes member identity to api/boardroom/ingest.ts so
// Perplexity browses URLs through the member's domain expertise lens.
//
// Mobile-first:
//   Documents → extracted client-side (pdfjs/mammoth) → text to board
//   URLs      → server-fetches via api/boardroom/ingest.ts (Perplexity sonar-pro)
//   Images    → compressed client-side → Oracle see.ts → description to board
//
// Usage in board chat:
//   const ingest = useBoardroomIngest(activeMember);
//   const attachment = await ingest.processDocument(file);
//   const attachment = await ingest.processUrl(url);
//   // Then include in message: { mediaAttachments: [attachment] }

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  extractDocument,
  formatFileSize,
  getFileEmoji,
  isValidUrl,
} from '@/lib/oracle/ingest';
import type { MediaAttachment } from '../../../api/boardroom/lib/prompt-builder/media-context.js';
import type { BoardMember } from '../types';

// =============================================================================
// STATE
// =============================================================================

export interface IngestState {
  isProcessing: boolean;
  error: string | null;
  attachments: MediaAttachment[];
}

export interface UseBoardroomIngestReturn {
  state: IngestState;
  processDocument: (file: File) => Promise<MediaAttachment | null>;
  processUrl: (url: string) => Promise<MediaAttachment | null>;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

// =============================================================================
// HOOK
// =============================================================================

export function useBoardroomIngest(
  activeMember: BoardMember | null
): UseBoardroomIngestReturn {
  const [state, setState] = useState<IngestState>({
    isProcessing: false,
    error: null,
    attachments: [],
  });

  const setProcessing = (isProcessing: boolean) =>
    setState(prev => ({ ...prev, isProcessing, error: null }));

  const setError = (error: string) =>
    setState(prev => ({ ...prev, isProcessing: false, error }));

  const addAttachment = (attachment: MediaAttachment) =>
    setState(prev => ({
      ...prev,
      isProcessing: false,
      attachments: [...prev.attachments, attachment],
    }));

  // ── Process Document ──────────────────────────────────────────────────
  // Extracts text client-side — zero server cost

  const processDocument = useCallback(async (
    file: File
  ): Promise<MediaAttachment | null> => {
    setProcessing(true);

    try {
      const extracted = await extractDocument(file);

      const attachment: MediaAttachment = {
        type: 'document',
        fileName:  extracted.fileName,
        mimeType:  extracted.mimeType,
        wordCount: extracted.wordCount,
        pageCount: extracted.pageCount,
        truncated: extracted.truncated,
        content:   extracted.text,
        summary:   undefined,
      };

      addAttachment(attachment);
      return attachment;

    } catch (err: any) {
      setError(err.message || 'Could not read that document. Try PDF, DOCX, or TXT.');
      return null;
    }
  }, []);

  // ── Process URL ───────────────────────────────────────────────────────
  // Domain-aware: Perplexity sonar-pro browses through member's lens

  const processUrl = useCallback(async (
    url: string
  ): Promise<MediaAttachment | null> => {
    if (!isValidUrl(url)) {
      setError('Invalid URL. Make sure it starts with https://');
      return null;
    }

    setProcessing(true);

    try {
      const token = await getAuthToken();

      // Board-specific ingest — passes member context for domain filtering
      const resp = await fetch('/api/boardroom/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type:        'url',
          url,
          memberSlug:  activeMember?.slug  || 'general',
          memberTitle: activeMember?.title || 'Board Member',
          memberName:  activeMember?.name  || 'Board Member',
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Research failed (${resp.status})`);
      }

      const data = await resp.json();

      const attachment: MediaAttachment = {
        type:          'url',
        url:           data.url,
        domain:        data.domain,
        title:         data.title,
        content:       data.content,
        summary:       data.summary,
        citations:     data.citations || [],
        domainFiltered: data.domainFiltered || false,
      };

      addAttachment(attachment);
      return attachment;

    } catch (err: any) {
      setError(err.message || 'Could not research that URL.');
      return null;
    }
  }, [activeMember]);

  // ── Remove / Clear ────────────────────────────────────────────────────

  const removeAttachment = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  }, []);

  const clearAttachments = useCallback(() => {
    setState(prev => ({ ...prev, attachments: [], error: null }));
  }, []);

  return {
    state,
    processDocument,
    processUrl,
    removeAttachment,
    clearAttachments,
  };
}