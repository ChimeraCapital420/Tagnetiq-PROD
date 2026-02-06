// FILE: src/components/authority/constants.ts
// Constants for Authority Report Card
// Refactored from monolith v7.3

import {
  Book,
  Coins,
  Sparkles,
  Blocks,
  BookOpen,
  Disc3,
  Footprints,
  Award,
  Car,
  Barcode,
  Database,
  type LucideIcon,
} from 'lucide-react';

// Source display names
export const SOURCE_NAMES: Record<string, string> = {
  google_books: 'Google Books',
  numista: 'Numista',
  pokemon_tcg: 'Pokémon TCG',
  brickset: 'Brickset',
  comicvine: 'Comic Vine',
  'Comic Vine': 'Comic Vine',
  discogs: 'Discogs',
  retailed: 'Retailed',
  streetwear: 'StockX via Retailed',  // v7.5
  psa: 'PSA',
  nhtsa: 'NHTSA',
  upcitemdb: 'UPCitemdb',
  colnect: 'Colnect',
};

// Source icons mapping
export const SOURCE_ICONS: Record<string, LucideIcon> = {
  google_books: Book,
  numista: Coins,
  pokemon_tcg: Sparkles,
  brickset: Blocks,
  comicvine: BookOpen,
  'Comic Vine': BookOpen,
  discogs: Disc3,
  retailed: Footprints,
  streetwear: Footprints,  // v7.5 - same as retailed
  psa: Award,
  nhtsa: Car,
  upcitemdb: Barcode,
  colnect: Database,
};

// Source colors for badges/accents
export const SOURCE_COLORS: Record<string, string> = {
  google_books: 'blue',
  numista: 'amber',
  pokemon_tcg: 'yellow',
  brickset: 'red',
  comicvine: 'purple',
  'Comic Vine': 'purple',
  discogs: 'orange',
  retailed: 'green',
  psa: 'indigo',
  nhtsa: 'slate',
  upcitemdb: 'gray',
  colnect: 'teal',
};

// Default fallback icon
export const DEFAULT_ICON = Database;