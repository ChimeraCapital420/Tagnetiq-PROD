// FILE: src/lib/image-storage.ts
// Dual-track image storage: Original quality for marketplace, compressed for AI analysis
// Prevents FUNCTION_PAYLOAD_TOO_LARGE while preserving user's high-quality images

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export interface StoredImage {
  id: string;
  originalUrl: string;      // Full quality URL for marketplace uploads
  analysisData: string;     // Compressed base64 for AI (NOT stored, ephemeral)
  thumbnailData: string;    // Small preview base64
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  createdAt: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  quality?: number;
}

// =============================================================================
// COMPRESSION SETTINGS
// =============================================================================

const ANALYSIS_SETTINGS: CompressionOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeMB: 2.5,   // Stay well under Vercel's 4.5MB limit
  quality: 0.85,
};

const THUMBNAIL_SETTINGS: CompressionOptions = {
  maxWidth: 400,
  maxHeight: 400,
  maxSizeMB: 0.1,
  quality: 0.7,
};

const STORAGE_BUCKET = 'user-images';

// =============================================================================
// MAIN CLASS
// =============================================================================

export class ImageStorageService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Process and store an image
   * - Uploads ORIGINAL to Supabase Storage (full quality for marketplace)
   * - Returns COMPRESSED version for AI analysis (not stored)
   */
  async processAndStore(
    source: File | Blob | string,
    folder: string = 'captures'
  ): Promise<StoredImage> {
    const id = uuidv4();
    
    // 1. Convert to blob
    const originalBlob = await this.sourceToBlob(source);
    const originalSize = originalBlob.size;
    
    // 2. Load image for processing
    const img = await this.loadImage(originalBlob);
    const { width, height } = { width: img.width, height: img.height };
    
    // 3. Upload ORIGINAL to Supabase (full quality preserved)
    let originalUrl = '';
    try {
      originalUrl = await this.uploadToStorage(originalBlob, id, folder);
    } catch (error) {
      console.warn('Storage upload failed, using blob URL:', error);
      originalUrl = URL.createObjectURL(originalBlob);
    }
    
    // 4. Create COMPRESSED version for AI analysis (ephemeral, not stored)
    const analysis = await this.compress(img, ANALYSIS_SETTINGS);
    
    // 5. Create THUMBNAIL for preview
    const thumbnail = await this.compress(img, THUMBNAIL_SETTINGS);
    
    console.log(`📸 Stored: ${this.formatSize(originalSize)} original → ${this.formatSize(analysis.size)} for AI`);
    
    return {
      id,
      originalUrl,
      analysisData: analysis.base64,
      thumbnailData: thumbnail.base64,
      originalSize,
      compressedSize: analysis.size,
      width,
      height,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Quick process without storage (for offline/fast mode)
   * Original is kept in memory only
   */
  async processOnly(source: File | Blob | string): Promise<StoredImage> {
    const id = uuidv4();
    
    const originalBlob = await this.sourceToBlob(source);
    const originalSize = originalBlob.size;
    const img = await this.loadImage(originalBlob);
    
    const analysis = await this.compress(img, ANALYSIS_SETTINGS);
    const thumbnail = await this.compress(img, THUMBNAIL_SETTINGS);
    
    return {
      id,
      originalUrl: URL.createObjectURL(originalBlob), // Local blob URL
      analysisData: analysis.base64,
      thumbnailData: thumbnail.base64,
      originalSize,
      compressedSize: analysis.size,
      width: img.width,
      height: img.height,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get original image URL for marketplace upload
   */
  getOriginalUrl(imageId: string, folder: string = 'captures'): string {
    const path = `${this.userId}/${folder}/${imageId}.jpg`;
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Download original as blob (for marketplace APIs that need file upload)
   */
  async downloadOriginal(imageId: string, folder: string = 'captures'): Promise<Blob | null> {
    const path = `${this.userId}/${folder}/${imageId}.jpg`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(path);
    
    if (error) {
      console.error('Download failed:', error);
      return null;
    }
    return data;
  }

  /**
   * Delete image from storage
   */
  async delete(imageId: string, folder: string = 'captures'): Promise<boolean> {
    const path = `${this.userId}/${folder}/${imageId}.jpg`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);
    return !error;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async uploadToStorage(blob: Blob, id: string, folder: string): Promise<string> {
    const path = `${this.userId}/${folder}/${id}.jpg`;
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });
    
    if (error) throw error;
    
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  private async compress(
    img: HTMLImageElement,
    options: CompressionOptions
  ): Promise<{ base64: string; size: number }> {
    const { maxWidth = 1920, maxHeight = 1920, maxSizeMB = 2.5, quality = 0.85 } = options;
    
    // Calculate dimensions
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }
    
    // Draw to canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    
    // Compress with quality reduction if needed
    const maxBytes = maxSizeMB * 1024 * 1024;
    let currentQuality = quality;
    let base64 = canvas.toDataURL('image/jpeg', currentQuality);
    let size = this.estimateBase64Size(base64);
    
    while (size > maxBytes && currentQuality > 0.1) {
      currentQuality -= 0.1;
      base64 = canvas.toDataURL('image/jpeg', currentQuality);
      size = this.estimateBase64Size(base64);
    }
    
    // Resize if still too large
    if (size > maxBytes && width > 800) {
      canvas.width = Math.floor(width * 0.7);
      canvas.height = Math.floor(height * 0.7);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      base64 = canvas.toDataURL('image/jpeg', 0.8);
      size = this.estimateBase64Size(base64);
    }
    
    return { base64, size };
  }

  private async sourceToBlob(source: File | Blob | string): Promise<Blob> {
    if (source instanceof Blob) return source;
    
    if (typeof source === 'string' && source.startsWith('data:')) {
      const response = await fetch(source);
      return response.blob();
    }
    
    throw new Error('Invalid image source');
  }

  private loadImage(source: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  private estimateBase64Size(base64: string): number {
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    return Math.round((data.length * 3) / 4);
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
}

// =============================================================================
// SINGLETON FACTORY
// =============================================================================

let instance: ImageStorageService | null = null;

export function getImageStorage(userId: string): ImageStorageService {
  if (!instance || (instance as any).userId !== userId) {
    instance = new ImageStorageService(userId);
  }
  return instance;
}

// =============================================================================
// HELPER FUNCTIONS (for use without class)
// =============================================================================

/**
 * Extract analysis-ready base64 data (strips data URL prefix)
 */
export function getAnalysisData(images: StoredImage[]): string[] {
  return images.map(img => {
    const data = img.analysisData;
    return data.includes(',') ? data.split(',')[1] : data;
  });
}

/**
 * Get original URLs for marketplace upload
 */
export function getOriginalUrls(images: StoredImage[]): string[] {
  return images.map(img => img.originalUrl);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default ImageStorageService;