// FILE: src/lib/image-compression.ts
// Client-side image compression to prevent FUNCTION_PAYLOAD_TOO_LARGE errors
// Vercel limit: 4.5MB (Hobby) / 5MB (Pro)

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  quality?: number;
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeMB: 3, // Stay well under 4.5MB limit
  quality: 0.85,
  outputType: 'image/jpeg',
};

/**
 * Compress an image file before uploading
 * Returns a compressed Blob that can be sent to the API
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Create image element to get dimensions
  const img = await createImageFromFile(file);
  
  // Calculate new dimensions while maintaining aspect ratio
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    opts.maxWidth!,
    opts.maxHeight!
  );

  // Draw to canvas at new size
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  // Use better image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob with compression
  let blob = await canvasToBlob(canvas, opts.outputType!, opts.quality!);
  
  // If still too large, reduce quality progressively
  let quality = opts.quality!;
  const maxBytes = opts.maxSizeMB! * 1024 * 1024;
  
  while (blob.size > maxBytes && quality > 0.1) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, opts.outputType!, quality);
    console.log(`Compressed to ${(blob.size / 1024 / 1024).toFixed(2)}MB at quality ${quality.toFixed(1)}`);
  }

  // If still too large after quality reduction, resize further
  if (blob.size > maxBytes) {
    return compressImage(blob, {
      ...opts,
      maxWidth: Math.floor(width * 0.75),
      maxHeight: Math.floor(height * 0.75),
      quality: 0.8,
    });
  }

  return blob;
}

/**
 * Compress image and return as base64 data URL
 */
export async function compressImageToBase64(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> {
  const blob = await compressImage(file, options);
  return blobToBase64(blob);
}

/**
 * Check if an image needs compression
 */
export function needsCompression(
  file: File | Blob,
  maxSizeMB: number = 3
): boolean {
  return file.size > maxSizeMB * 1024 * 1024;
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function calculateDimensions(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  // If image is smaller than max, keep original size
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }

  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  
  return {
    width: Math.floor(srcWidth * ratio),
    height: Math.floor(srcHeight * ratio),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      type,
      quality
    );
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// REACT HOOK FOR EASY INTEGRATION
// ============================================================================

import { useState, useCallback } from 'react';

export interface UseImageCompressionReturn {
  compress: (file: File) => Promise<Blob>;
  compressToBase64: (file: File) => Promise<string>;
  isCompressing: boolean;
  error: string | null;
  originalSize: number | null;
  compressedSize: number | null;
  compressionRatio: number | null;
}

export function useImageCompression(
  options: CompressionOptions = {}
): UseImageCompressionReturn {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  const compress = useCallback(async (file: File): Promise<Blob> => {
    setIsCompressing(true);
    setError(null);
    setOriginalSize(file.size);
    
    try {
      const compressed = await compressImage(file, options);
      setCompressedSize(compressed.size);
      return compressed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compression failed';
      setError(message);
      throw err;
    } finally {
      setIsCompressing(false);
    }
  }, [options]);

  const compressToBase64 = useCallback(async (file: File): Promise<string> => {
    const blob = await compress(file);
    return blobToBase64(blob);
  }, [compress]);

  const compressionRatio = originalSize && compressedSize
    ? Math.round((1 - compressedSize / originalSize) * 100)
    : null;

  return {
    compress,
    compressToBase64,
    isCompressing,
    error,
    originalSize,
    compressedSize,
    compressionRatio,
  };
}

export default compressImage;