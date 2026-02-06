// FILE: src/components/authority/index.ts
// Main export for Authority Report Card system - v7.5

export { AuthorityReportCard } from './AuthorityReportCard';
export { default } from './AuthorityReportCard';

export type { 
  AuthorityData, 
  AuthorityReportCardProps, 
  SectionProps,
  MarketValue,
  PriceByCondition,
  ImageLinks,
} from './types';

export { SOURCE_NAMES, SOURCE_ICONS, SOURCE_COLORS, DEFAULT_ICON } from './constants';

export {
  DataRow,
  ThumbnailImage,
  formatDate,
  formatPrice,
  formatNumber,
  truncateText,
  formatArray,
  extractField,
  createFieldExtractor,
  extractFields,
  hasField,
  getExternalUrl,
  getThumbnailUrl,
} from './helpers';

export {
  GoogleBooksSection,
  NumistaSection,
  PokemonTcgSection,
  BricksetSection,
  ComicVineSection,
  DiscogsSection,
  RetailedSection,
  PsaSection,
  NhtsaSection,
  UpcItemDbSection,
} from './sections';