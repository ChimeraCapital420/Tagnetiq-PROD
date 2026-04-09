// FILE: src/lib/oracle/ingest/index.ts
// Oracle Ingest Module — barrel exports

export {
  extractDocument,
  extractVideoThumbnail,
  getFileCategory,
  formatFileSize,
  getFileEmoji,
  isValidUrl,
} from './extractor.js';

export type {
  MediaCategory,
  ExtractedDocument,
  ExtractedVideo,
  ExtractionResult,
} from './extractor.js';