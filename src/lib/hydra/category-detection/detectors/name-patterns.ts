// FILE: src/lib/hydra/category-detection/detectors/name-patterns.ts
// HYDRA v8.0 - Name-Based Category Detection
// Sequential pattern matching against item name.
// Order matters: more specific categories checked before general ones.
// CRITICAL: vinyl checked BEFORE vehicle (vinyl contains "vin")

/**
 * Detect category from item name using pattern matching.
 * Returns category string or null if no match.
 */
export function detectCategoryFromName(nameLower: string): string | null {
  // === Barcode Detection (8-13 digit numbers) ===
  if (/\b\d{8,13}\b/.test(nameLower)) {
    return 'household';
  }

  // === COLNECT-PRIMARY: Unique collectibles with no other authority ===
  if (matchesAny(nameLower, ['stamp', 'postage', 'philatel'])) return 'stamps';
  if (matchesAny(nameLower, ['banknote', 'bank note', 'paper money'])) return 'banknotes';
  if (matchesAny(nameLower, ['postcard', 'post card'])) return 'postcards';
  if (matchesAny(nameLower, ['phone card', 'phonecard', 'calling card', 'telecarte'])) return 'phonecards';
  if (matchesAny(nameLower, ['medal', 'medallion']) && !nameLower.includes('pedal')) return 'medals';
  if (matchesAny(nameLower, ['enamel pin', 'lapel pin', 'pin badge', 'collector pin'])) return 'pins';
  if (matchesAny(nameLower, ['embroidered patch', 'iron-on patch', 'morale patch', 'merit badge'])) return 'patches';
  if (matchesAny(nameLower, ['beer coaster', 'beermat'])) return 'beer_coasters';
  if (matchesAny(nameLower, ['bottle cap', 'bottlecap', 'crown cap'])) return 'bottlecaps';
  if (matchesAny(nameLower, ['happy meal', 'kids meal toy', 'kinder surprise', 'kinder egg'])) return 'kids_meal_toys';
  if (matchesAny(nameLower, ['arcade token', 'transit token', 'casino chip', 'casino token'])) return 'tokens';
  if (matchesAny(nameLower, ['keychain', 'key chain', 'key ring', 'keyring'])) return 'keychains';
  if (matchesAny(nameLower, ['fridge magnet', 'souvenir magnet', 'collector magnet'])) return 'magnets';
  if (matchesAny(nameLower, ['panini sticker', 'sticker album', 'collectible sticker'])) return 'stickers';

  // === VINYL - MUST check before VIN/vehicles ===
  if (matchesAny(nameLower, ['vinyl', 'record', ' lp', 'lp ', '33 rpm', '45 rpm', 'album'])) {
    return 'vinyl_records';
  }

  // === VIN Detection (17-char alphanumeric) ===
  if (/\b[A-HJ-NPR-Z0-9]{17}\b/i.test(nameLower) || /\bvin\b/i.test(nameLower)) {
    return 'vehicles';
  }

  // === STREETWEAR / HYPE BRANDS - Check BEFORE general apparel ===
  const streetwearBrands = [
    'supreme', 'box logo', 'bogo',
    'bape', 'bathing ape', 'baby milo',
    'off-white', 'off white', 'offwhite',
    'fear of god', 'fog essentials', 'essentials',
    'palace',
    'travis scott', 'cactus jack', 'astroworld',
    'anti social social club', 'assc',
    'vlone', 'chrome hearts', 'gallery dept', 'rhude', 'amiri',
    'stussy', 'kith', 'undefeated',
    'yeezy gap', 'yzy gap',
    'sp5der', 'hellstar', 'eric emanuel',
    'drew house', 'human made', 'corteiz', 'broken planet',
    'billionaire boys club',
  ];
  if (matchesAny(nameLower, streetwearBrands)) return 'streetwear';

  // === GENERAL APPAREL ===
  const apparelPatterns = [
    'hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck',
    'jacket', 'coat', 'blazer', 'windbreaker', 'parka', 'vest', 'fleece',
    'jersey', 'uniform',
    't-shirt', 'tee', 'polo', 'shirt', 'flannel', 'button up',
    'pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'trousers',
    'hat', 'cap', 'beanie', 'snapback',
  ];
  if (matchesAny(nameLower, apparelPatterns)) return 'apparel';

  // === VEHICLES (skip if card-related keywords present) ===
  const cardKeywords = ['card', 'pokemon', 'tcg', 'holo', 'vmax', 'vstar', 'ex', 'gx', 'trading'];
  if (!matchesAny(nameLower, cardKeywords)) {
    const vehiclePatterns = [
      'vehicle', 'automobile', 'automotive', 'car ', ' car', 'sedan', 'coupe',
      'truck', 'pickup', 'suv', 'crossover', 'minivan', 'van ',
      'motorcycle', 'motorbike', 'harley',
      'ford ', 'chevrolet', 'chevy', 'toyota', 'honda ', 'nissan', 'dodge',
      'jeep', 'gmc', 'bmw', 'mercedes', 'audi', 'tesla',
      'mustang', 'camaro', 'corvette', 'f-150', 'f150', 'silverado',
    ];
    if (matchesAny(nameLower, vehiclePatterns)) return 'vehicles';
  }

  // === HOUSEHOLD ===
  const householdPatterns = [
    'blender', 'coffee maker', 'keurig', 'instant pot', 'air fryer',
    'vacuum', 'dyson', 'roomba', 'vitamix', 'cuisinart', 'kitchenaid',
    'new in box', 'nib', 'factory sealed',
  ];
  if (matchesAny(nameLower, householdPatterns)) return 'household';

  // === PSA / GRADED ===
  const psaPatterns = [
    'psa 10', 'psa 9', 'psa 8', 'bgs 10', 'bgs 9.5', 'cgc 9.8',
    'psa graded', 'beckett graded', 'gem mint',
  ];
  if (matchesAny(nameLower, psaPatterns)) {
    if (nameLower.includes('pokemon') || nameLower.includes('charizard')) return 'pokemon_cards';
    if (matchesAny(nameLower, ['baseball', 'football', 'basketball', 'topps'])) return 'sports_cards';
    return 'graded_cards';
  }

  // === POKEMON ===
  if (matchesAny(nameLower, ['pokemon', 'pokémon', 'pikachu', 'charizard'])) return 'pokemon_cards';

  // === LEGO ===
  if (matchesAny(nameLower, ['lego', 'minifig'])) return 'lego';

  // === BOOKS (not comics) ===
  if (matchesAny(nameLower, ['book', 'hardcover', 'paperback', 'isbn']) && !nameLower.includes('comic')) {
    return 'books';
  }

  // === VIDEO GAMES ===
  if (matchesAny(nameLower, ['video game', 'nintendo', 'playstation', 'xbox'])) return 'video_games';

  // === SNEAKERS (shoes only) ===
  const sneakerPatterns = [
    'sneaker', 'jordan 1', 'jordan 4', 'jordan 11', 'yeezy 350',
    'nike dunk', 'air force 1', 'air max',
  ];
  if (matchesAny(nameLower, sneakerPatterns)) return 'sneakers';

  // === COMICS ===
  if (matchesAny(nameLower, ['comic', 'manga'])) return 'comics';

  return null;
}

// =============================================================================
// HELPER
// =============================================================================

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p));
}