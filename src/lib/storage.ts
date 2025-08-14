// FILE: src/lib/storage.ts
// Helper for creating pre-signed URLs for secure file uploads (e.g., screenshots).

import { supaAdmin } from './supaAdmin';

const BUCKET_NAME = 'feedback-screenshots';

/**
 * Creates a pre-signed URL for uploading a file to Supabase Storage.
 * @param fileName - The name the file will have in the bucket.
 * @returns The pre-signed URL for the upload.
 */
export async function createPresignedUrl(fileName: string) {
  const { data, error } = await supaAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(fileName);

  if (error) {
    throw new Error(`Failed to create presigned URL: ${error.message}`);
  }

  return data;
}