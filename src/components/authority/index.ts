// FILE: src/components/authority/index.ts
// Main export for Authority Report Card system
// Refactored from 940-line monolith

// Main component
export { AuthorityReportCard } from './AuthorityReportCard';
export { default } from './AuthorityReportCard';

// Types
export type { AuthorityData, AuthorityReportCardProps, SectionProps } from './types';

// Constants (for external use if needed)
export { SOURCE_NAMES, SOURCE_ICONS, SOURCE_COLORS } from './constants';

// Individual sections (for direct use if needed)
export * from './sections';