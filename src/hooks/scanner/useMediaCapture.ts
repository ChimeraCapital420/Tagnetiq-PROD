// FILE: src/hooks/scanner/useMediaCapture.ts
// Photo capture hook with automatic compression
// Preserves original for storage, compresses for API

import { useRef, useCallback, useState } from 'react';
import { compressImage, formatBytes } from '@/lib/scanner/compression';
import type { CapturedItem, CompressionOptions } from '@/types/scanner';

// =============================================================================
// TYPES
// =============================================================================

export interface UseMediaCaptureOptions {
  /** Reference to video element for capture */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Callback when item is captured */
  onCapture: (item: Omit<CapturedItem, 'id' | 'selected'>) => void;
  /** Optional compression settings */
  compressionOptions?: CompressionOptions;
  /** Callback for compression status */
  onCompressionStart?: () => void;
  onCompressionEnd?: () => void;
}

export interface UseMediaCaptureReturn {
  /** Hidden canvas ref (attach to DOM) */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Capture a photo from video stream */
  capturePhoto: () => Promise<void>;
  /** Whether currently compressing */
  isCompressing: boolean;
  /** Last capture info */
  lastCaptureInfo: CaptureInfo | null;
}

export interface CaptureInfo {
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  timestamp: number;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Photo capture hook with automatic compression
 * 
 * Features:
 * - Captures at full resolution
 * - Compresses for API (saves bandwidth)
 * - Preserves original for storage (high quality marketplace images)
 * - Haptic feedback on capture (where supported)
 * 
 * @example
 * const { capturePhoto, canvasRef, isCompressing } = useMediaCapture({
 *   videoRef: camera.videoRef,
 *   onCapture: (item) => setItems(prev => [...prev, item]),
 * });
 * 
 * return (
 *   <>
 *     <canvas ref={canvasRef} style={{ display: 'none' }} />
 *     <button onClick={capturePhoto} disabled={isCompressing}>
 *       {isCompressing ? 'Processing...' : 'Capture'}
 *     </button>
 *   </>
 * );
 */
export function useMediaCapture(options: UseMediaCaptureOptions): UseMediaCaptureReturn {
  const {
    videoRef,
    onCapture,
    compressionOptions,
    onCompressionStart,
    onCompressionEnd,
  } = options;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [lastCaptureInfo, setLastCaptureInfo] = useState<CaptureInfo | null>(null);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    
    if (!video || video.readyState < 2) {
      console.error('📸 [CAPTURE] Video not ready');
      return;
    }

    console.log(`📸 [CAPTURE] Starting capture...`);
    console.log(`📸 [CAPTURE] Video size: ${video.videoWidth}x${video.videoHeight}`);

    // Haptic feedback on mobile (where supported)
    triggerHaptic();

    try {
      setIsCompressing(true);
      onCompressionStart?.();

      // Create canvas at full video resolution
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);

      // Get original quality image (for Supabase storage)
      const originalData = canvas.toDataURL('image/jpeg', 0.95);
      const originalSize = estimateBase64Size(originalData);
      
      console.log(`📸 [CAPTURE] Original: ${formatBytes(originalSize)}`);

      // Compress for API (smaller payload)
      const { compressed, compressedSize } = await compressImage(
        originalData,
        compressionOptions
      );

      console.log(`📸 [CAPTURE] Compressed: ${formatBytes(compressedSize)}`);

      // Update last capture info
      const captureInfo: CaptureInfo = {
        originalSize,
        compressedSize,
        width: video.videoWidth,
        height: video.videoHeight,
        timestamp: Date.now(),
      };
      setLastCaptureInfo(captureInfo);

      // Generate thumbnail (smaller for UI)
      const thumbnail = await generateThumbnail(canvas, 200);

      // Create captured item
      const item: Omit<CapturedItem, 'id' | 'selected'> = {
        type: 'photo',
        data: compressed,           // Compressed for API
        originalData: originalData, // Original for storage
        thumbnail,
        name: `Photo ${new Date().toLocaleTimeString()}`,
        metadata: {
          originalSize,
          compressedSize,
        },
      };

      console.log(`📸 [CAPTURE] ✅ Photo captured successfully`);
      onCapture(item);

    } catch (error) {
      console.error('📸 [CAPTURE] ❌ Failed:', error);
    } finally {
      setIsCompressing(false);
      onCompressionEnd?.();
    }
  }, [videoRef, onCapture, compressionOptions, onCompressionStart, onCompressionEnd]);

  return {
    canvasRef,
    capturePhoto,
    isCompressing,
    lastCaptureInfo,
  };
}

// =============================================================================
// DOCUMENT CAPTURE (for certificates, receipts, etc.)
// =============================================================================

export interface UseDocumentCaptureOptions {
  onCapture: (item: Omit<CapturedItem, 'id' | 'selected'>) => void;
  compressionOptions?: CompressionOptions;
}

/**
 * Document capture from file input
 * Used for certificates, receipts, grading cards, etc.
 */
export function useDocumentCapture(options: UseDocumentCaptureOptions) {
  const { onCapture, compressionOptions } = options;
  const [isProcessing, setIsProcessing] = useState(false);

  const processDocument = useCallback(async (file: File): Promise<void> => {
    console.log(`📄 [DOCUMENT] Processing: ${file.name} (${formatBytes(file.size)})`);
    setIsProcessing(true);

    try {
      // Read file as data URL
      const originalData = await readFileAsDataURL(file);
      const originalSize = file.size;

      // Compress for API
      const { compressed, compressedSize } = await compressImage(
        originalData,
        compressionOptions
      );

      // Generate thumbnail
      const thumbnail = await generateThumbnailFromDataURL(originalData, 200);

      // Determine document type from filename
      const documentType = detectDocumentType(file.name);

      const item: Omit<CapturedItem, 'id' | 'selected'> = {
        type: 'document',
        data: compressed,
        originalData,
        thumbnail,
        name: file.name,
        metadata: {
          documentType,
          originalSize,
          compressedSize,
        },
      };

      console.log(`📄 [DOCUMENT] ✅ Processed: ${file.name}`);
      onCapture(item);

    } catch (error) {
      console.error('📄 [DOCUMENT] ❌ Failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [onCapture, compressionOptions]);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process each file
    Array.from(files).forEach(processDocument);

    // Reset input for re-selection of same file
    event.target.value = '';
  }, [processDocument]);

  return {
    processDocument,
    handleFileInput,
    isProcessing,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Estimate byte size from base64 string
 */
function estimateBase64Size(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

/**
 * Generate thumbnail from canvas
 */
async function generateThumbnail(
  sourceCanvas: HTMLCanvasElement,
  maxSize: number
): Promise<string> {
  const { width, height } = sourceCanvas;
  const ratio = Math.min(maxSize / width, maxSize / height);
  
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.floor(width * ratio);
  thumbCanvas.height = Math.floor(height * ratio);
  
  const ctx = thumbCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  
  return thumbCanvas.toDataURL('image/jpeg', 0.7);
}

/**
 * Generate thumbnail from data URL
 */
async function generateThumbnailFromDataURL(
  dataUrl: string,
  maxSize: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = Math.floor(img.width * ratio);
      canvas.height = Math.floor(img.height * ratio);
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Read file as data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Detect document type from filename
 */
function detectDocumentType(
  filename: string
): CapturedItem['metadata']['documentType'] {
  const lower = filename.toLowerCase();
  
  if (lower.includes('cert') || lower.includes('coa')) return 'certificate';
  if (lower.includes('grade') || lower.includes('psa') || lower.includes('bgs')) return 'grading';
  if (lower.includes('apprais')) return 'appraisal';
  if (lower.includes('receipt') || lower.includes('invoice')) return 'receipt';
  if (lower.includes('auth')) return 'authenticity';
  
  return 'other';
}

/**
 * Trigger haptic feedback on mobile devices
 */
function triggerHaptic() {
  if ('vibrate' in navigator) {
    navigator.vibrate(50); // Short vibration
  }
}

export default useMediaCapture;