// FILE: src/components/authority/helpers/index.ts
// Export all helper components and functions
// v7.5 - Bulletproof data extraction

// Components
export { DataRow } from './DataRow';
export { ThumbnailImage } from './ThumbnailImage';

// Formatting utilities
export { 
  formatDate, 
  formatPrice, 
  formatNumber, 
  truncateText,
  formatArray,
  extractYear,
  isLegoSetRetired,
  isLegoSetCurrentlyAvailable,
} from './formatters';

// Bulletproof data extraction
export { 
  extractField, 
  createFieldExtractor, 
  extractFields,
  hasField,
  getExternalUrl,
  getThumbnailUrl,
} from './data-extractor';