// FILE: src/lib/scanner/upload.ts
// Mobile-first Supabase storage uploads
// Sequential uploads for reliability on mobile networks

import { supabase } from '@/lib/supabase';
import type { CapturedItem, UploadResult, UploadProgress } from '@/types/scanner';

// =============================================================================
// CONSTANTS
// =============================================================================

const BUCKET_NAME = 'user-uploads';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// SINGLE IMAGE UPLOAD
// =============================================================================

/**
 * Upload single image to Supabase storage
 * Returns public URL for marketplace display
 * 
 * @param base64Data - Base64 encoded image (with or without data: prefix)
 * @param userId - User ID for folder organization
 * @param index - Image index for unique filename
 * @returns Promise with URL or error
 */
export async function uploadImage(
  base64Data: string,
  userId: string,
  index: number
): Promise<UploadResult> {
  console.log(`📤 [UPLOAD] Starting image ${index}...`);
  console.log(`📤 [UPLOAD] User ID: ${userId}`);
  console.log(`📤 [UPLOAD] Data length: ${base64Data.length} chars`);
  
  // Validate inputs
  if (!base64Data) {
    console.error('❌ [UPLOAD] No image data provided');
    return { url: null, error: 'No image data provided' };
  }
  
  if (!userId) {
    console.error('❌ [UPLOAD] No user ID provided');
    return { url: null, error: 'No user ID provided' };
  }
  
  // Validate base64 format
  if (!base64Data.startsWith('data:')) {
    console.error('❌ [UPLOAD] Invalid base64 data - missing data: prefix');
    return { url: null, error: 'Invalid image format' };
  }
  
  try {
    // Convert base64 to blob (runs on device)
    const blob = await base64ToBlob(base64Data);
    console.log(`📤 [UPLOAD] Blob created: ${(blob.size / 1024).toFixed(1)}KB, type: ${blob.type}`);
    
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${index}.jpg`;
    console.log(`📤 [UPLOAD] Filename: ${filename}`);
    
    // Upload with retry logic
    const result = await uploadWithRetry(filename, blob);
    
    if (result.error) {
      return { url: null, error: result.error };
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);
    
    console.log(`✅ [UPLOAD] Public URL: ${urlData.publicUrl}`);
    return { url: urlData.publicUrl };
    
  } catch (error: any) {
    console.error('❌ [UPLOAD] Exception:', error);
    return { url: null, error: error.message || 'Upload failed' };
  }
}

/**
 * Upload with retry logic for flaky mobile connections
 */
async function uploadWithRetry(
  filename: string,
  blob: Blob,
  attempt: number = 1
): Promise<{ data?: any; error?: string }> {
  console.log(`📤 [UPLOAD] Attempt ${attempt}/${MAX_RETRIES + 1}`);
  
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    if (error) {
      console.error(`❌ [UPLOAD] Supabase error:`, error.message);
      
      // Retry on certain errors
      if (attempt <= MAX_RETRIES && isRetryableError(error)) {
        console.log(`📤 [UPLOAD] Retrying in ${RETRY_DELAY_MS}ms...`);
        await delay(RETRY_DELAY_MS * attempt);
        return uploadWithRetry(filename, blob, attempt + 1);
      }
      
      return { error: error.message };
    }
    
    console.log(`📤 [UPLOAD] Success:`, JSON.stringify(data));
    return { data };
    
  } catch (error: any) {
    if (attempt <= MAX_RETRIES) {
      console.log(`📤 [UPLOAD] Network error, retrying...`);
      await delay(RETRY_DELAY_MS * attempt);
      return uploadWithRetry(filename, blob, attempt + 1);
    }
    return { error: error.message };
  }
}

// =============================================================================
// BATCH UPLOAD
// =============================================================================

/**
 * Upload multiple images sequentially
 * Sequential is more reliable than parallel on mobile networks
 * 
 * @param items - Array of captured items to upload
 * @param userId - User ID for folder organization
 * @param onProgress - Optional callback for progress updates
 * @returns Array of successfully uploaded URLs
 */
export async function uploadImages(
  items: CapturedItem[],
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<string[]> {
  console.log(`📦 [BATCH UPLOAD] Starting upload of ${items.length} images`);
  console.log(`📦 [BATCH UPLOAD] User ID: ${userId}`);
  
  if (items.length === 0) {
    console.log(`📦 [BATCH UPLOAD] No items to upload`);
    return [];
  }
  
  const urls: string[] = [];
  const errors: string[] = [];
  
  // Upload sequentially for reliability
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Use original uncompressed data if available
    const imageData = item.originalData || item.data;
    
    console.log(`📦 [BATCH UPLOAD] Image ${i}: hasOriginal=${!!item.originalData}, dataLength=${imageData?.length || 0}`);
    
    // Report progress
    onProgress?.({
      uploaded: i,
      total: items.length,
      currentFile: item.name,
    });
    
    if (!imageData) {
      console.error(`❌ [BATCH UPLOAD] No image data for item ${i}`);
      errors.push(`Item ${i}: No image data`);
      continue;
    }
    
    const result = await uploadImage(imageData, userId, i);
    
    if (result.url) {
      urls.push(result.url);
    } else {
      errors.push(`Item ${i}: ${result.error}`);
    }
  }
  
  // Final progress
  onProgress?.({
    uploaded: items.length,
    total: items.length,
  });
  
  console.log(`📦 [BATCH UPLOAD] Complete: ${urls.length}/${items.length} uploaded`);
  
  if (errors.length > 0) {
    console.warn(`📦 [BATCH UPLOAD] Errors:`, errors);
  }
  
  console.log(`📦 [BATCH UPLOAD] URLs:`, urls);
  return urls;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert base64 data URL to Blob
 * Runs on device - no network required
 */
async function base64ToBlob(base64Data: string): Promise<Blob> {
  const response = await fetch(base64Data);
  return response.blob();
}

/**
 * Check if error is retryable (network issues, timeouts)
 */
function isRetryableError(error: any): boolean {
  const retryableMessages = [
    'network',
    'timeout',
    'connection',
    'ECONNRESET',
    'ETIMEDOUT',
    'fetch failed',
  ];
  
  const message = (error.message || '').toLowerCase();
  return retryableMessages.some(msg => message.includes(msg));
}

/**
 * Promise-based delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delete an uploaded image (for cleanup/undo)
 */
export async function deleteImage(url: string): Promise<boolean> {
  try {
    // Extract path from URL
    const path = url.split(`${BUCKET_NAME}/`)[1];
    if (!path) return false;
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);
    
    if (error) {
      console.error('❌ [DELETE] Error:', error.message);
      return false;
    }
    
    console.log(`🗑️ [DELETE] Removed: ${path}`);
    return true;
  } catch (error) {
    console.error('❌ [DELETE] Exception:', error);
    return false;
  }
}

/**
 * Check if storage bucket is accessible
 * Useful for health checks
 */
export async function checkStorageHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit: 1 });
    
    return !error;
  } catch {
    return false;
  }
}