// FILE: src/lib/scanner/compression.ts
// Mobile-first image compression - runs entirely on device
// Reduces payload size for API calls while preserving originals for storage

import type { CompressionOptions, CompressionResult } from '@/types/scanner';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_COMPRESSION: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeMB: 2.5, // Stay well under Vercel's 4.5MB limit
  quality: 0.85,
};

// Aggressive compression for very large images
const AGGRESSIVE_COMPRESSION: CompressionOptions = {
  maxWidth: 1280,
  maxHeight: 1280,
  maxSizeMB: 1.5,
  quality: 0.75,
};

// =============================================================================
// MAIN COMPRESSION FUNCTION
// =============================================================================

/**
 * Compress image on device before upload/API call
 * Mobile-first: Runs entirely client-side, no server round-trip
 * 
 * @param dataUrl - Base64 encoded image data
 * @param options - Compression options (optional)
 * @returns Promise with compressed data and size info
 */
export async function compressImage(
  dataUrl: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_COMPRESSION, ...options };
  
  // Calculate original size from base64
  const originalSize = estimateBase64Size(dataUrl);
  const maxBytes = opts.maxSizeMB! * 1024 * 1024;
  
  // Skip compression if already small enough (save CPU on mobile)
  if (originalSize < maxBytes * 0.8) {
    console.log(`📸 [COMPRESS] Skipping - already small: ${formatBytes(originalSize)}`);
    return { compressed: dataUrl, originalSize, compressedSize: originalSize };
  }
  
  console.log(`📸 [COMPRESS] Starting compression: ${formatBytes(originalSize)}`);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        const { width, height } = calculateDimensions(
          img.width, 
          img.height, 
          opts.maxWidth!, 
          opts.maxHeight!
        );
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // High quality scaling for better results
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Progressively reduce quality until under limit
        const compressed = compressWithQualityReduction(canvas, maxBytes, opts.quality!);
        const compressedSize = estimateBase64Size(compressed);
        
        const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        console.log(`📸 [COMPRESS] Done: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${savings}% smaller)`);
        
        resolve({ compressed, originalSize, compressedSize });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

/**
 * Aggressive compression for images that are still too large
 * Used as a fallback when standard compression isn't enough
 */
export async function aggressiveCompress(dataUrl: string): Promise<CompressionResult> {
  console.log(`📸 [COMPRESS] Using aggressive compression`);
  return compressImage(dataUrl, AGGRESSIVE_COMPRESSION);
}

/**
 * Check if image needs compression based on size
 */
export function needsCompression(dataUrl: string, maxSizeMB: number = 2.5): boolean {
  const size = estimateBase64Size(dataUrl);
  const maxBytes = maxSizeMB * 1024 * 1024;
  return size > maxBytes * 0.8;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Estimate byte size from base64 string
 * Formula: (base64 length * 3) / 4
 */
function estimateBase64Size(dataUrl: string): number {
  // Remove data URL prefix if present
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.round((base64.length * 3) / 4);
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.floor(width * ratio),
    height: Math.floor(height * ratio),
  };
}

/**
 * Progressively reduce quality until image is under size limit
 */
function compressWithQualityReduction(
  canvas: HTMLCanvasElement,
  maxBytes: number,
  startQuality: number
): string {
  let quality = startQuality;
  let compressed = canvas.toDataURL('image/jpeg', quality);
  let size = estimateBase64Size(compressed);
  
  // Reduce quality in steps until under limit
  while (size > maxBytes && quality > 0.1) {
    quality -= 0.1;
    compressed = canvas.toDataURL('image/jpeg', quality);
    size = estimateBase64Size(compressed);
    console.log(`📸 [COMPRESS] Quality ${(quality * 100).toFixed(0)}%: ${formatBytes(size)}`);
  }
  
  // If still too large, resize canvas further
  if (size > maxBytes && canvas.width > 800) {
    console.log(`📸 [COMPRESS] Still too large, resizing canvas`);
    const newWidth = Math.floor(canvas.width * 0.7);
    const newHeight = Math.floor(canvas.height * 0.7);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
      compressed = tempCanvas.toDataURL('image/jpeg', 0.8);
    }
  }
  
  return compressed;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Get image dimensions from data URL without full decode
 * Useful for quick checks on mobile
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}