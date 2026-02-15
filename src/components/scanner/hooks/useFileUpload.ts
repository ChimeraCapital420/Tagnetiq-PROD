// FILE: src/components/scanner/hooks/useFileUpload.ts
// Extracted from DualScanner.tsx — handles image and document file uploads
// Mobile-first: Accepts camera roll photos + document scans
// Device-side compression before adding to captured items

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { compressImage } from '../utils/compression';
import type { CapturedItem, CapturedItemMetadata } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface UseFileUploadOptions {
  /** Add item to captured items list */
  addItem: (item: Omit<CapturedItem, 'id' | 'selected'>) => Promise<void>;
  /** Current item count (for naming) */
  photoCount: number;
  /** Max allowed items */
  maxItems?: number;
  /** Current total count */
  totalCount: number;
}

export interface UseFileUploadReturn {
  /** Ref for hidden image file input */
  imageInputRef: React.RefObject<HTMLInputElement>;
  /** Ref for hidden document file input */
  documentInputRef: React.RefObject<HTMLInputElement>;
  /** Trigger image upload picker */
  openImagePicker: () => void;
  /** Trigger document upload picker */
  openDocumentPicker: () => void;
  /** Handle image input change event */
  handleImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handle document input change event */
  handleDocumentUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function detectDocumentType(
  filename: string
): CapturedItemMetadata['documentType'] {
  const lower = filename.toLowerCase();
  if (lower.includes('cert') || lower.includes('coa')) return 'certificate';
  if (lower.includes('grade') || lower.includes('psa') || lower.includes('bgs'))
    return 'grading';
  if (lower.includes('apprais')) return 'appraisal';
  if (lower.includes('receipt') || lower.includes('invoice')) return 'receipt';
  if (lower.includes('auth')) return 'authenticity';
  return 'other';
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function generateDocumentThumbnail(
  fileExtension: string,
  width = 100,
  height = 150
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    // Border
    ctx.strokeStyle = '#4a4a6a';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    // Extension label
    ctx.fillStyle = '#8888aa';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fileExtension.toUpperCase(), width / 2, height / 2);
  }
  return canvas.toDataURL('image/png');
}

// =============================================================================
// HOOK
// =============================================================================

export function useFileUpload(options: UseFileUploadOptions): UseFileUploadReturn {
  const { addItem, photoCount, maxItems = 15, totalCount } = options;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  // Open native file pickers
  const openImagePicker = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const openDocumentPicker = useCallback(() => {
    documentInputRef.current?.click();
  }, []);

  // -------------------------------------------------------------------------
  // IMAGE UPLOAD — compress on device, then add
  // -------------------------------------------------------------------------
  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (totalCount >= maxItems) {
          toast.warning(`Maximum ${maxItems} items allowed`);
          break;
        }

        try {
          const dataUrl = await readFileAsDataURL(file);

          // Device-side compression
          const { compressed } = await compressImage(dataUrl, {
            maxSizeMB: 2,
            quality: 0.85,
          });

          await addItem({
            type: 'photo',
            data: compressed,
            thumbnail: compressed,
            name: file.name || `Photo ${photoCount + 1}`,
            originalData: dataUrl,
            metadata: {
              originalSize: file.size,
              compressedSize: Math.round((compressed.length * 3) / 4),
            },
          });

          // Haptic feedback on mobile
          if ('vibrate' in navigator) navigator.vibrate(50);
        } catch (err) {
          console.error('Image upload failed:', err);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      // Reset input so same file can be re-selected
      if (event.target) event.target.value = '';
    },
    [addItem, photoCount, totalCount, maxItems]
  );

  // -------------------------------------------------------------------------
  // DOCUMENT UPLOAD — certificates, grading slips, receipts
  // -------------------------------------------------------------------------
  const handleDocumentUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      for (const file of Array.from(files)) {
        if (totalCount >= maxItems) {
          toast.warning(`Maximum ${maxItems} items allowed`);
          break;
        }

        try {
          const dataUrl = await readFileAsDataURL(file);

          // Generate a simple thumbnail for documents
          const ext = file.name.split('.').pop() || 'FILE';
          const isImage = file.type.startsWith('image/');

          let thumbnail: string;
          if (isImage) {
            // For image-based documents, use the image itself as thumbnail
            const { compressed } = await compressImage(dataUrl, {
              maxSizeMB: 0.2,
              quality: 0.6,
            });
            thumbnail = compressed;
          } else {
            thumbnail = generateDocumentThumbnail(ext);
          }

          const documentType = detectDocumentType(file.name);

          await addItem({
            type: 'document',
            data: dataUrl,
            thumbnail,
            name: file.name,
            metadata: {
              documentType,
              description: `${documentType} document`,
            },
          });

          toast.success(`Document: ${documentType}`);
        } catch (err) {
          console.error('Document upload failed:', err);
          toast.error(`Failed to upload ${file.name}`);
        }
      }

      if (event.target) event.target.value = '';
    },
    [addItem, totalCount, maxItems]
  );

  return {
    imageInputRef,
    documentInputRef,
    openImagePicker,
    openDocumentPicker,
    handleImageUpload,
    handleDocumentUpload,
  };
}

export default useFileUpload;