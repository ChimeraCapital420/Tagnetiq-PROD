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
//   Images    → compressed client-side → api/boardroom/vision.ts (GPT-4o)
//              → structured board analysis → domain-filtered per member
//
// v2.0: processImage() added — Option B Vision Pipeline
//   Unlike Oracle scanner (fast ID + market data), board vision is
//   deliberate strategic analysis. GPT-4o runs FIRST and produces:
//     - Identification (what is this)
//     - Financial signals (numbers, valuations, prices)
//     - Legal signals (contracts, clauses, compliance)
//     - Technical signals (systems, infrastructure)
//     - Risk flags (red flags, concerns)
//     - Questions for the board
//   Each board member then applies their domain lens to this pre-analysis.
//   CFO extracts financial implications. Legal extracts risk. CSO extracts
//   strategic positioning. Same analysis, 15 domain-filtered responses.
//
//   Works for both 1:1 (one member's lens) and @all (15 lenses simultaneously).
//
// Usage in board chat:
//   const ingest = useBoardroomIngest(activeMember);
//   const attachment = await ingest.processDocument(file);
//   const attachment = await ingest.processUrl(url);
//   const attachment = await ingest.processImage(file, context?);

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
  processImage: (file: File, context?: string) => Promise<MediaAttachment | null>;  // v2.0
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

/**
 * Compress an image file client-side before sending to vision endpoint.
 * Reduces upload time and API cost. Target: under 1MB for fast analysis.
 * Uses canvas to resize large images — preserves aspect ratio.
 * Mobile-first: runs on device, zero server cost for compression.
 */
async function compressImage(
  file: File,
  maxDimension: number = 1920,
  quality: number = 0.85,
): Promise<{ base64: string; mimeType: string; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate dimensions — preserve aspect ratio
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Use JPEG for photos, PNG for screenshots/documents
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(mimeType, quality);
      const base64 = dataUrl.split(',')[1];
      const sizeKB = Math.round(base64.length * 0.75 / 1024);

      resolve({ base64, mimeType, sizeKB });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image for compression.'));
    };

    img.src = url;
  });
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

  // ── Process Image — Option B Vision Pipeline (v2.0) ───────────────────
  //
  // Step 1: Compress image client-side (device does the work)
  // Step 2: Send to api/boardroom/vision.ts (GPT-4o high-detail)
  // Step 3: Receive structured board analysis (financial, legal, technical,
  //         strategic signals, risk flags, questions for the board)
  // Step 4: Package as MediaAttachment — each board member applies their
  //         domain lens via Layer 10 (media-context.ts getDomainHint)
  //
  // For 1:1: that one member reads the pre-analysis through their lens
  // For @all: all 15 members each apply their own domain lens simultaneously
  //
  // context: optional user note — "this is a business listing I photographed"
  //   or "this is the contract clause I'm concerned about"

  const processImage = useCallback(async (
    file: File,
    context?: string,
  ): Promise<MediaAttachment | null> => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return null;
    }

    setProcessing(true);

    try {
      // Step 1: Compress client-side — target <1MB for fast analysis
      let compressed: { base64: string; mimeType: string; sizeKB: number };
      try {
        compressed = await compressImage(file, 1920, 0.85);
        console.log(`[BoardIngest] Image compressed: ${compressed.sizeKB}KB`);
      } catch (compressionErr: any) {
        // If compression fails, try reading raw as base64
        const reader = new FileReader();
        const rawBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = () => reject(new Error('Could not read image file.'));
          reader.readAsDataURL(file);
        });
        compressed = {
          base64: rawBase64,
          mimeType: file.type || 'image/jpeg',
          sizeKB: Math.round(rawBase64.length * 0.75 / 1024),
        };
      }

      if (!compressed.base64 || compressed.sizeKB < 1) {
        throw new Error('Image appears to be empty or corrupted.');
      }

      if (compressed.sizeKB > 4096) {
        throw new Error('Image is too large even after compression. Please use a smaller photo.');
      }

      // Step 2: Send to board vision endpoint
      const token = await getAuthToken();

      setState(prev => ({ ...prev, error: null }));  // Clear any previous error

      const resp = await fetch('/api/boardroom/vision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType:    compressed.mimeType,
          context:     context || null,
          memberSlug:  activeMember?.slug || null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Vision analysis failed (${resp.status})`);
      }

      const data = await resp.json();

      // Step 3: Package as MediaAttachment
      // content = full structured board analysis
      // imageDescription = executive summary for quick reference
      const attachment: MediaAttachment = {
        type:             'image',
        content:          data.content,           // Full structured analysis
        summary:          data.summary,           // 2-3 sentence executive summary
        imageDescription: data.identification,    // What GPT-4o identified
        visionMode:       'board_analysis',        // Distinguish from scanner vision
        // Store the rich analysis for potential UI display
        ...(data.analysis ? {
          fileName: `Vision: ${data.identification?.substring(0, 50) || 'Image'}`,
        } : {}),
      };

      addAttachment(attachment);
      return attachment;

    } catch (err: any) {
      setError(err.message || 'Could not analyze that image. Try a clearer photo.');
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
    processImage,    // v2.0
    removeAttachment,
    clearAttachments,
  };
}