// FILE: src/hooks/scanner/index.ts
// Central export for all scanner hooks

export { useCamera } from './useCamera';
export { useMediaCapture, useDocumentCapture } from './useMediaCapture';
export { useBarcodeScanner, detectBarcodesInImage, validateBarcode } from './useBarcodeScanner';
export { useVideoRecording } from './useVideoRecording';

// Re-export types for convenience
export type { CapturedItem, ScanMode, CapturedItemMetadata } from '@/types/scanner';