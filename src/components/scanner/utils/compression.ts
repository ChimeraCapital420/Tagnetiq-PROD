// FILE: src/components/scanner/utils/compression.ts
// Device-side image compression to reduce upload size
// Mobile-first: Compresses on device before sending to server

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  maxSizeMB: 2,
};

/**
 * Compress an image (base64 or File) to reduce size for upload
 */
export async function compressImage(
  input: string | File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Convert File to base64 if needed
  let base64 = typeof input === 'string' ? input : await fileToBase64(input);
  
  // Get original size
  const originalSize = Math.round((base64.length * 3) / 4);
  
  // Skip compression for small images
  if (originalSize < 100 * 1024) { // < 100KB
    return {
      compressed: base64,
      originalSize,
      compressedSize: originalSize,
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        const maxWidth = opts.maxWidth!;
        const maxHeight = opts.maxHeight!;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Iteratively compress until size target met
        let quality = opts.quality!;
        let compressed = canvas.toDataURL('image/jpeg', quality);
        let compressedSize = Math.round((compressed.length * 3) / 4);
        const maxBytes = (opts.maxSizeMB || 2) * 1024 * 1024;

        while (compressedSize > maxBytes && quality > 0.3) {
          quality -= 0.1;
          compressed = canvas.toDataURL('image/jpeg', quality);
          compressedSize = Math.round((compressed.length * 3) / 4);
        }

        resolve({
          compressed,
          originalSize,
          compressedSize,
          width,
          height,
        });

      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}

/**
 * Convert a File to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Estimate base64 size in bytes
 */
export function estimateBase64Size(base64: string): number {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Math.round((base64Data.length * 3) / 4);
}