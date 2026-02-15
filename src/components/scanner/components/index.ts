// FILE: src/components/scanner/components/index.ts
// Export all scanner UI components — existing + newly extracted

// Existing components
export { GridOverlay } from './GridOverlay';
export { GhostProtocolSheet } from './GhostProtocolSheet';
export { CapturePreviewGrid } from './CapturePreviewGrid';

// NEW — extracted from DualScanner.tsx
export { ScannerHeader } from './ScannerHeader';
export type { ScannerHeaderProps } from './ScannerHeader';

export { ScannerViewport } from './ScannerViewport';
export type { ScannerViewportProps } from './ScannerViewport';

export { ScannerFooter } from './ScannerFooter';
export type { ScannerFooterProps } from './ScannerFooter';