// FILE: src/lib/hydra/category-detection/utils/normalize.ts
// HYDRA v8.0 - Category Normalization
// Converts messy AI-returned and user-provided category strings
// into standardized HYDRA category keys.
// Order matters: more specific checks before general ones.
// CRITICAL: vinyl checked BEFORE vehicle.

/**
 * Normalize a category string to a standard HYDRA category key.
 * Handles AI output, user input, underscores, hyphens, spaces.
 */
export function normalizeCategory(category: string): string {
  const cat = category.toLowerCase().trim().replace(/[_\s-]+/g, '_');

  // === COLNECT-PRIMARY (check first - most specific) ===
  if (cat.includes('stamp') || cat.includes('postage') || cat.includes('philatel')) return 'stamps';
  if (cat === 'banknote' || cat === 'banknotes' || cat.includes('paper_money')) return 'banknotes';
  if (cat.includes('postcard')) return 'postcards';
  if (cat.includes('phonecard') || cat.includes('phone_card') || cat.includes('calling_card')) return 'phonecards';
  if (cat.includes('medal') || cat.includes('medallion')) return 'medals';
  if (cat === 'pin' || cat === 'pins' || cat.includes('enamel_pin') || cat.includes('lapel_pin')) return 'pins';
  if (cat === 'patch' || cat === 'patches' || cat.includes('embroidered')) return 'patches';
  if (cat.includes('beer_coaster') || cat.includes('beermat')) return 'beer_coasters';
  if (cat.includes('bottlecap') || cat.includes('bottle_cap')) return 'bottlecaps';
  if (cat.includes('token') && !cat.includes('card')) return 'tokens';
  if (cat.includes('keychain') || cat.includes('key_chain') || cat.includes('key_ring')) return 'keychains';
  if (cat.includes('magnet') && !cat.includes('electric')) return 'magnets';
  if (cat.includes('sticker') && !cat.includes('bumper')) return 'stickers';
  if (cat.includes('ticket') && !cat.includes('parking')) return 'tickets';
  if (cat.includes('kids_meal') || cat.includes('happy_meal') || cat.includes('fast_food_toy')) return 'kids_meal_toys';

  // === TRADING CARDS ===
  if (cat.includes('pokemon') || cat.includes('pokémon')) return 'pokemon_cards';
  if (cat.includes('trading_card') || cat.includes('tcg') || cat === 'cards') return 'trading_cards';

  // === VINYL (BEFORE vehicle - "vinyl" contains "vin") ===
  if (cat.includes('vinyl') || cat.includes('record') || cat === 'music' || cat === 'album') return 'vinyl_records';

  // === STREETWEAR (BEFORE general apparel) ===
  const HYPE_BRANDS = [
    'supreme', 'bape', 'bathing_ape', 'off_white', 'offwhite', 'fear_of_god',
    'fog', 'essentials', 'palace', 'travis_scott', 'cactus_jack', 'astroworld',
    'anti_social', 'assc', 'vlone', 'chrome_hearts', 'gallery_dept', 'rhude',
    'amiri', 'stussy', 'kith', 'undefeated', 'yeezy_gap', 'sp5der', 'hellstar',
    'eric_emanuel', 'drew_house', 'human_made', 'corteiz', 'broken_planet',
  ];
  for (const brand of HYPE_BRANDS) {
    if (cat.includes(brand)) return 'streetwear';
  }
  if (cat === 'streetwear' || cat === 'hype' || cat === 'hype_apparel') return 'streetwear';

  // === APPAREL ===
  if (cat.includes('apparel') || cat.includes('clothing') || cat.includes('fashion') ||
      cat.includes('garment') || cat.includes('hoodie') || cat.includes('jacket') ||
      cat.includes('jersey') || cat.includes('shirt') || cat.includes('pants') ||
      cat.includes('hat')) {
    return 'apparel';
  }

  // === HOUSEHOLD ===
  if (cat.includes('household') || cat.includes('appliance') || cat.includes('kitchen') || cat.includes('home_goods')) {
    return 'household';
  }

  // === VEHICLES (AFTER vinyl check) ===
  const isVin = cat === 'vin' || cat.startsWith('vin_') || cat.endsWith('_vin');
  if (cat.includes('vehicle') || cat.includes('auto') || cat.includes('truck') ||
      cat.includes('motorcycle') || isVin) {
    if (!cat.includes('card') && !cat.includes('vinyl')) return 'vehicles';
  }

  // === REMAINING SPECIFIC CATEGORIES ===
  if (cat.includes('coin') || cat.includes('numismatic')) return 'coins';
  if (cat.includes('lego') || cat.includes('brick')) return 'lego';
  if (cat.includes('video_game') || cat === 'gaming') return 'video_games';
  if (cat.includes('comic') || cat.includes('manga')) return 'comics';
  if (cat.includes('book') && !cat.includes('comic')) return 'books';
  if (cat.includes('sneaker') || cat.includes('footwear') || cat === 'shoes' || cat === 'jordans' || cat === 'yeezy') return 'sneakers';
  if (cat.includes('electronic') || cat.includes('gadget')) return 'electronics';

  // No normalization needed or unknown - return as-is
  return cat;
}