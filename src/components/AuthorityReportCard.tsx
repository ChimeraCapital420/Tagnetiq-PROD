// FILE: src/components/AuthorityReportCard.tsx
// ============================================================================
// DEPRECATED - BACKWARDS COMPATIBILITY SHIM
// ============================================================================
// This file exists for backwards compatibility only.
// All code has been refactored to: src/components/authority/
//
// Please update your imports:
//   OLD: import { AuthorityReportCard } from '@/components/AuthorityReportCard'
//   NEW: import { AuthorityReportCard } from '@/components/authority'
//
// This file can be deleted once all imports are updated.
// ============================================================================

export { 
  AuthorityReportCard,
  default 
} from './authority';

export type { 
  AuthorityData, 
  AuthorityReportCardProps,
  SectionProps 
} from './authority';