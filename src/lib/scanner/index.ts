// FILE: src/lib/scanner/index.ts
// Central export point for scanner utilities

// Compression utilities
export {
  compressImage,
  aggressiveCompress,
  needsCompression,
  formatBytes,
  getImageDimensions,
} from './compression';

// Upload utilities
export {
  uploadImage,
  uploadImages,
  deleteImage,
  checkStorageHealth,
} from './upload';

// Re-export types for convenience
export type {
  CompressionOptions,
  CompressionResult,
  UploadResult,
  UploadProgress,
  CapturedItem,
  CapturedItemMetadata,
} from '@/types/scanner';