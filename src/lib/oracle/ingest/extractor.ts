// FILE: src/lib/oracle/ingest/extractor.ts
// Client-side media extraction — runs on device, zero server cost
//
// PDF     → pdfjs-dist (dynamic import)
// DOCX    → mammoth (dynamic import)
// TXT/CSV/JSON/MD → FileReader (native, zero deps)
// Video   → canvas first-frame thumbnail
// Image   → existing compression pipeline (not here)
//
// Mobile-first: device extracts everything. Server only gets text or
// compressed thumbnails. Large files are truncated before leaving device.

export type MediaCategory = 'image' | 'video' | 'document' | 'unknown';

// =============================================================================
// RESULT TYPES
// =============================================================================

export interface ExtractedDocument {
  type: 'document';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  text: string;
  pageCount?: number;     // PDF only
  wordCount: number;
  truncated: boolean;
}

export interface ExtractedVideo {
  type: 'video';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  thumbnailBase64: string;  // First frame, JPEG, stripped of data: prefix
  width: number;
  height: number;
}

export type ExtractionResult = ExtractedDocument | ExtractedVideo;

// Max text before truncation — keeps tokens sane
const MAX_TEXT_CHARS = 12_000;

// =============================================================================
// DOCUMENT EXTRACTION
// =============================================================================

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const { type, name } = file;

  if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
    return extractPdf(file);
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.toLowerCase().endsWith('.docx')
  ) {
    return extractDocx(file);
  }

  if (type === 'application/msword' || name.toLowerCase().endsWith('.doc')) {
    throw new Error(
      'Legacy .doc files cannot be read on-device. Please save as .docx or .pdf first.'
    );
  }

  if (
    type.startsWith('text/') ||
    type === 'application/json' ||
    /\.(txt|csv|md|json|xml|yaml|yml|tsv)$/i.test(name)
  ) {
    return extractPlainText(file);
  }

  throw new Error(`Unsupported file type: ${type || name}. Try PDF, DOCX, or TXT.`);
}

// ── PDF via pdfjs-dist (dynamic import) ──────────────────────────────

async function extractPdf(file: File): Promise<ExtractedDocument> {
  let pdfjsLib: any;
  try {
    pdfjsLib = await import('pdfjs-dist');
  } catch {
    throw new Error(
      'PDF support requires pdfjs-dist. Run: npm install pdfjs-dist'
    );
  }

  // Set worker if not already set
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;
    } catch {
      // Fallback for environments where import.meta.url isn't available
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount: number = pdf.numPages;

  let fullText = '';
  let truncated = false;

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      fullText += (fullText ? '\n\n' : '') + `[Page ${p}]\n${pageText}`;
    }

    if (fullText.length >= MAX_TEXT_CHARS) {
      fullText = fullText.substring(0, MAX_TEXT_CHARS);
      truncated = true;
      break;
    }
  }

  return {
    type: 'document',
    fileName: file.name,
    mimeType: 'application/pdf',
    sizeBytes: file.size,
    text: fullText || '(No readable text found in this PDF)',
    pageCount,
    wordCount: fullText.split(/\s+/).filter(Boolean).length,
    truncated,
  };
}

// ── DOCX via mammoth (dynamic import) ────────────────────────────────

async function extractDocx(file: File): Promise<ExtractedDocument> {
  let mammoth: any;
  try {
    mammoth = await import('mammoth');
  } catch {
    throw new Error(
      'DOCX support requires mammoth. Run: npm install mammoth'
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  let text: string = result.value || '';
  let truncated = false;

  if (text.length > MAX_TEXT_CHARS) {
    text = text.substring(0, MAX_TEXT_CHARS);
    truncated = true;
  }

  return {
    type: 'document',
    fileName: file.name,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: file.size,
    text: text || '(No readable text found in this document)',
    wordCount: text.split(/\s+/).filter(Boolean).length,
    truncated,
  };
}

// ── Plain text / CSV / JSON / Markdown ───────────────────────────────

async function extractPlainText(file: File): Promise<ExtractedDocument> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'utf-8');
  });

  let trimmed = text.replace(/\r\n/g, '\n').trim();
  let truncated = false;

  if (trimmed.length > MAX_TEXT_CHARS) {
    trimmed = trimmed.substring(0, MAX_TEXT_CHARS);
    truncated = true;
  }

  return {
    type: 'document',
    fileName: file.name,
    mimeType: file.type || 'text/plain',
    sizeBytes: file.size,
    text: trimmed || '(Empty file)',
    wordCount: trimmed.split(/\s+/).filter(Boolean).length,
    truncated,
  };
}

// =============================================================================
// VIDEO THUMBNAIL EXTRACTION — canvas first-frame
// =============================================================================

export function extractVideoThumbnail(file: File): Promise<ExtractedVideo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    // Timeout guard — some videos load slowly on mobile
    const timer = setTimeout(() => fail('Video took too long to load for preview'), 15_000);

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      video.currentTime = 0.1; // Slight offset avoids black first frame
    };

    video.onseeked = () => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;

      try {
        const maxDim = 1024;
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 480;

        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) { cleanup(); reject(new Error('Canvas not supported')); return; }

        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const thumbnailBase64 = dataUrl.split(',')[1];

        cleanup();
        resolve({
          type: 'video',
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          durationSeconds: isFinite(video.duration) ? Math.round(video.duration) : undefined,
          thumbnailBase64,
          width: w,
          height: h,
        });
      } catch (err: any) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      clearTimeout(timer);
      fail('Could not load video — format may not be supported on this device.');
    };

    video.src = objectUrl;
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/** Classify a file into a broad media category */
export function getFileCategory(file: File): MediaCategory {
  const { type, name } = file;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (
    type.startsWith('text/') ||
    type === 'application/pdf' ||
    type === 'application/json' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword' ||
    /\.(pdf|docx|doc|txt|csv|md|json|xml|yaml|yml|tsv)$/i.test(name)
  ) return 'document';
  return 'unknown';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

export function getFileEmoji(file: File): string {
  const { type, name } = file;
  if (type === 'application/pdf') return '📄';
  if (type.includes('wordprocessingml') || name.endsWith('.docx')) return '📝';
  if (type === 'text/csv' || name.endsWith('.csv') || name.endsWith('.tsv')) return '📊';
  if (type === 'application/json' || name.endsWith('.json')) return '🔢';
  if (type === 'text/markdown' || name.endsWith('.md')) return '📋';
  if (type.startsWith('text/')) return '📃';
  if (type.startsWith('video/')) return '🎬';
  return '📎';
}

export function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}