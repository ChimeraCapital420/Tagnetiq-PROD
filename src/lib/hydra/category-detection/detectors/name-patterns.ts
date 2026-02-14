// FILE: src/lib/hydra/category-detection/detectors/name-patterns.ts
// HYDRA v8.4 - Name-Based Category Detection
// Sequential pattern matching against item name.
// Order matters: more specific categories checked before general ones.
// CRITICAL: vinyl checked BEFORE vehicle (vinyl contains "vin")
// UPDATED v8.3: Added grocery/food detection before household
//               Food items (honey, sauce, cereal, etc.) now route to upcitemdb
// FIXED v8.4: LP pattern no longer matches "DLP" — uses word boundary check
//             "Dell 3300MP DLP Projector" was being classified as vinyl_records

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
  // FIXED v8.4: Split LP into its own word-boundary check.
  //   Old: matchesAny with [' lp', 'lp '] matched "dlp projector" → vinyl_records ❌
  //   New: matchesWordBoundary('lp') matches "vinyl lp" but NOT "dlp projector" ✅
  //   All other vinyl patterns remain as substring matches (safe — no false positives).
  if (matchesAny(nameLower, ['vinyl', 'record', '33 rpm', '45 rpm', 'album'])) {
    return 'vinyl_records';
  }
  if (matchesWordBoundary(nameLower, 'lp')) {
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

  // === GROCERY / FOOD / BEVERAGE (v8.3) - Check BEFORE household ===
  // Catches food items that AI often categorizes as "general"
  const groceryBrands = [
    'kraft', 'heinz', 'campbells', "campbell's", 'general mills', 'kelloggs',
    'quaker', 'nabisco', 'frito-lay', 'frito lay', 'pepperidge farm',
    'smuckers', "smucker's", 'jif', 'skippy', 'pace', 'tostitos',
    'barilla', 'ragu', 'prego', 'hunts', "hunt's", 'del monte',
    'goya', 'old el paso', 'ortega',
    'dole', 'chiquita', 'sunkist', 'ocean spray',
    'nestle', 'hershey', 'mars', 'ferrero',
    'starbucks', 'folgers', 'maxwell house', 'dunkin',
    'great value', 'kirkland', 'market pantry', 'good gather', '365 everyday',
    'coca-cola', 'pepsi', 'dr pepper', 'mountain dew', 'sprite',
    'red bull', 'monster energy', 'gatorade', 'powerade',
    'la croix', 'topo chico',
  ];
  if (matchesAny(nameLower, groceryBrands)) return 'grocery';

  const groceryPatterns = [
    // Food types
    'honey', 'syrup', 'maple syrup', 'agave', 'molasses',
    'sauce', 'hot sauce', 'bbq sauce', 'ketchup', 'mustard', 'mayo', 'mayonnaise',
    'salsa', 'dressing', 'vinegar', 'soy sauce', 'teriyaki',
    'jam', 'jelly', 'preserves', 'marmalade', 'peanut butter',
    'cereal', 'oatmeal', 'granola', 'protein bar', 'energy bar',
    'chips', 'crackers', 'pretzels', 'popcorn', 'trail mix',
    'pasta', 'noodles', 'ramen', 'mac and cheese',
    'soup', 'broth', 'canned goods',
    'chocolate', 'candy', 'gummy', 'gummies',
    'cookie', 'cookies', 'brownie', 'cake mix',
    'flour', 'sugar', 'baking soda', 'baking powder', 'vanilla extract',
    'spice', 'seasoning', 'cinnamon', 'paprika', 'cumin', 'oregano',
    'olive oil', 'cooking oil', 'vegetable oil', 'coconut oil',
    'yogurt', 'cheese', 'butter', 'cream cheese', 'sour cream',
    'juice', 'orange juice', 'apple juice',
    'coffee beans', 'ground coffee', 'k-cups', 'k-cup',
    'tea bags', 'green tea', 'herbal tea',
    'energy drink',
    // Packaging clues combined with weight/volume
    'nutrition facts', 'serving size', 'calories',
    'organic', 'non-gmo', 'gluten free', 'gluten-free', 'sugar free',
    'vegan', 'plant based', 'plant-based',
  ];
  if (matchesAny(nameLower, groceryPatterns)) return 'grocery';

  // Weight/volume + food container = grocery (catches "Honey Jar - 1 Pound")
  if (matchesWeight(nameLower) && matchesAny(nameLower, ['jar', 'bottle', 'can', 'box', 'pouch', 'bag', 'carton', 'pack'])) {
    return 'grocery';
  }

  // === HOUSEHOLD (cleaning, appliances, personal care) ===
  const householdPatterns = [
    // Appliances
    'blender', 'coffee maker', 'keurig', 'instant pot', 'air fryer',
    'vacuum', 'dyson', 'roomba', 'vitamix', 'cuisinart', 'kitchenaid',
    'new in box', 'nib', 'factory sealed',
    // Cleaning
    'detergent', 'laundry', 'fabric softener', 'dryer sheets', 'bleach',
    'dish soap', 'dishwasher', 'paper towel', 'paper towels',
    'trash bag', 'trash bags', 'garbage bags', 'aluminum foil', 'plastic wrap',
    'clorox', 'lysol', 'windex', 'mr clean', 'dawn', 'tide', 'gain', 'downy',
    'swiffer', 'pledge', 'febreze', 'air freshener', 'glade',
    // Personal care
    'shampoo', 'conditioner', 'body wash', 'hand soap',
    'toothpaste', 'toothbrush', 'mouthwash', 'floss',
    'deodorant', 'lotion', 'moisturizer', 'sunscreen',
    'razor', 'shaving cream', 'toilet paper',
    'dove', 'old spice', 'pantene', 'tresemme',
    'colgate', 'crest', 'oral-b', 'listerine', 'neutrogena',
    // Baby
    'diaper', 'diapers', 'baby wipes', 'baby formula',
    'pampers', 'huggies', 'similac', 'enfamil',
    // Pet
    'dog food', 'cat food', 'pet food', 'purina', 'blue buffalo',
    'pedigree', 'meow mix', 'fancy feast', 'cat litter',
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
// HELPERS
// =============================================================================

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p));
}

/**
 * Word-boundary-safe matching for short patterns that cause false positives.
 * "lp" should match " lp ", " lp,", "(lp)", "12\" lp" but NOT "dlp", "help", "alps"
 * Uses regex \b word boundary which treats transitions between \w and \W as boundaries.
 *
 * ADDED v8.4: Fixes DLP projector → vinyl_records misclassification.
 */
function matchesWordBoundary(text: string, word: string): boolean {
  const regex = new RegExp(`\\b${word}\\b`, 'i');
  return regex.test(text);
}

/**
 * Check if text contains weight/volume indicators
 * Catches patterns like "1 Pound", "16 oz", "12 fl oz", "2 liter", "500ml"
 */
function matchesWeight(text: string): boolean {
  return /\b\d+(\.\d+)?\s*(oz|ounce|ounces|lb|lbs|pound|pounds|gram|grams|kg|ml|liter|liters|gallon|quart|pint|fl\s*oz)\b/i.test(text);
}