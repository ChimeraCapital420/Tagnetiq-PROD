// FILE: src/components/scanner/index.ts
// Main scanner module exports
// 
// Usage:
// import DualScanner from '@/components/scanner';
// import { useGhostMode, useCameraStream } from '@/components/scanner/hooks';
// import { GridOverlay } from '@/components/scanner/components';

export { default as DualScanner } from './DualScanner';
export { default } from './DualScanner';

// Re-export types
export * from './types';

// Re-export hooks
export * from './hooks';

// Re-export components
export * from './components';

// Re-export utils
export * from './utils';