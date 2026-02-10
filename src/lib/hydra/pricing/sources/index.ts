// FILE: src/lib/hydra/pricing/sources/index.ts
// Source extractor index and dispatcher
// Refactored from monolith v7.3
// v8.0: Added Colnect source extractor

import type { FormattedAuthorityData } from '../types.js';
import type { AuthorityData } from '../../types.js';

// Import all source extractors
import { extractGoogleBooksData, isGoogleBooksSource } from './google-books.js';
import { extractNumistaData, isNumistaSource } from './numista.js';
import { extractPokemonTcgData, isPokemonTcgSource } from './pokemon-tcg.js';
import { extractBricksetData, isBricksetSource } from './brickset.js';
import { extractComicVineData, isComicVineSource } from './comic-vine.js';
import { extractDiscogsData, isDiscogsSource } from './discogs.js';
import { extractRetailedData, isRetailedSource } from './retailed.js';
import { extractPsaData, isPsaSource } from './psa.js';
import { extractNhtsaData, isNhtsaSource } from './nhtsa.js';
import { extractColnectData, isColnectSource } from './colnect.js';

// Export individual extractors for direct use
export * from './google-books.js';
export * from './numista.js';
export * from './pokemon-tcg.js';
export * from './brickset.js';
export * from './comic-vine.js';
export * from './discogs.js';
export * from './retailed.js';
export * from './psa.js';
export * from './nhtsa.js';
export * from './colnect.js';

/**
 * Dispatch to appropriate source extractor based on authority source
 * Each extractor is isolated - a bug in one won't crash others
 */
export function extractSourceSpecificData(
  authority: AuthorityData,
  details: Record<string, unknown>,
  formatted: FormattedAuthorityData
): void {
  const source = authority.source.toLowerCase();
  
  try {
    // Google Books
    if (isGoogleBooksSource(source, details)) {
      extractGoogleBooksData(authority, details, formatted);
      return;
    }
    
    // Numista (Coins)
    if (isNumistaSource(source, details)) {
      extractNumistaData(details, formatted);
      return;
    }
    
    // Pokemon TCG
    if (isPokemonTcgSource(source, details)) {
      extractPokemonTcgData(details, formatted);
      return;
    }
    
    // Brickset (LEGO)
    if (isBricksetSource(source, details)) {
      extractBricksetData(authority, details, formatted);
      return;
    }
    
    // Comic Vine
    if (isComicVineSource(source, details)) {
      extractComicVineData(authority, details, formatted);
      return;
    }
    
    // Discogs (Vinyl)
    if (isDiscogsSource(source, details)) {
      extractDiscogsData(details, formatted);
      return;
    }
    
    // Retailed (Sneakers)
    if (isRetailedSource(source, details)) {
      extractRetailedData(details, formatted);
      return;
    }
    
    // Streetwear (v7.5) - uses same extractor as Retailed
    if (source === 'streetwear') {
      extractRetailedData(details, formatted);
      return;
    }
    
    // PSA (Graded)
    if (isPsaSource(source, details)) {
      extractPsaData(details, formatted);
      return;
    }
    
    // NHTSA (Vehicles)
    if (isNhtsaSource(source, details)) {
      extractNhtsaData(details, formatted);
      return;
    }
    
    // Colnect (v8.0 - Stamps, Coins, Banknotes, 40+ collectible categories)
    if (isColnectSource(source, details)) {
      extractColnectData(details, formatted);
      return;
    }
    
    // Unknown source - log for debugging
    console.log(`⚠️ Unknown authority source: ${authority.source}`);
    
  } catch (error) {
    // Log error but don't crash - graceful degradation
    console.error(`❌ Error extracting ${authority.source} data:`, error);
  }
}

/**
 * List of fields that have been extracted (for cleanup)
 */
export const EXTRACTED_KEYS = [
  // Google Books
  'googleBooksId', 'isbn13', 'isbn10', 'authors', 'publisher', 'publishedDate',
  'pageCount', 'categories', 'description', 'language', 'averageRating', 'ratingsCount',
  'imageLinks', 'images', 'image', 'infoLink', 'canonicalVolumeLink', 'previewLink',
  // Numista
  'numistaId', 'title', 'name', 'issuer', 'minYear', 'maxYear', 'value', 'composition',
  'weight', 'size', 'thickness', 'shape', 'orientation', 'references', 'url',
  'obverseThumb', 'reverseThumb', 'category',
  // Pokemon TCG
  'pokemonTcgId', 'id', 'set', 'setName', 'setCode', 'rarity', 'artist',
  'hp', 'types', 'attacks', 'weaknesses', 'resistances', 'number', 'tcgplayer', 'tcgPlayerUrl',
  // Brickset
  'bricksetId', 'setID', 'setNumber', 'year', 'theme', 'themeGroup', 'subtheme',
  'pieces', 'minifigs', 'ageMin', 'ageMax', 'ageRange', 'packagingType', 'availability',
  'instructionsCount', 'LEGOCom', 'bricksetURL', 'priceGuide', 'currentValue',
  'isRetired', 'dateFirstAvailable', 'dateLastAvailable', 'rrp', 'pricePerPiece',
  // Comic Vine
  'comicVineId', 'issueName', 'issueNumber', 'volumeName', 'volumeId', 'coverDate',
  'storeDate', 'deck', 'writers', 'artists', 'coverArtists', 'characterAppearances',
  'characterCount', 'firstAppearances', 'hasFirstAppearances', 'isKeyIssue',
  'coverImage', 'coverImageLarge', 'coverImageThumb', 'comicVineUrl',
  // Discogs
  'discogsId', 'releaseId', 'masterId', 'master_id', 'artistName',
  'labels', 'label', 'formats', 'format', 'country', 'released', 'genres', 'genre',
  'styles', 'style', 'tracklist', 'uri', 'lowestPrice', 'medianPrice', 'highestPrice', 
  'numForSale', 'stats', 'thumb', 'coverImage',
  // Retailed
  'retailedId', 'sku', 'styleId', 'styleCode', 'brand', 'colorway', 'color',
  'releaseDate', 'gender', 'silhouette', 'model', 'retailPrice', 'msrp',
  'resellPrices', 'market', 'pricesBySize', 'sizeChart',
  // PSA
  'psaCertNumber', 'certNumber', 'grade', 'gradeDescription', 'cardYear',
  'cardBrand', 'cardCategory', 'cardSubject', 'subject', 'player', 'cardVariety', 'variety',
  'cardNumber', 'totalPopulation', 'popTotal', 'populationHigher', 'popHigher',
  'labelType', 'isCrossedOver', 'certDate', 'certUrl',
  // NHTSA
  'vin', 'make', 'trim', 'bodyClass', 'vehicleType', 'driveType',
  'fuelType', 'engineCylinders', 'engineDisplacement', 'engineHP', 'transmissionStyle',
  'doors', 'plantCity', 'plantCountry', 'plantCompanyName', 'series', 'gvwr', 'manufacturerName',
  // Colnect (v8.0)
  'colnectId', 'colnectCategory', 'itemName', 'seriesName',
  'producerName', 'producer', 'catalogCodes', 'frontPictureId', 'backPictureId',
  'colnectItemId', 'categoryDisplay', 'description', 'seriesId', 'producerId',
  'frontImageUrl', 'backImageUrl', 'conditionPrices',
  'attribution', 'attributionUrl',
];