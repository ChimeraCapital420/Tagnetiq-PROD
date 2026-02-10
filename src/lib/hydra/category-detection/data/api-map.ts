// FILE: src/lib/hydra/category-detection/data/api-map.ts
// HYDRA v8.0 - Category → API Mapping
// Pure data: maps each category to the APIs that should be queried.
// Order matters: first API is primary authority, others are fallbacks.
//
// HOW TO ADD: Just add a new key-value pair. No logic changes needed.

export const CATEGORY_API_MAP: Record<string, string[]> = {
  // ==================== COINS & CURRENCY ====================
  'coins': ['numista', 'colnect', 'ebay'],
  'banknotes': ['colnect', 'numista', 'ebay'],
  'currency': ['numista', 'colnect', 'ebay'],

  // ==================== STAMPS (COLNECT PRIMARY) ====================
  'stamps': ['colnect', 'ebay'],
  'postage_stamps': ['colnect', 'ebay'],
  'miniature_sheets': ['colnect', 'ebay'],

  // ==================== POSTCARDS (COLNECT PRIMARY) ====================
  'postcards': ['colnect', 'ebay'],

  // ==================== PHONE CARDS (COLNECT PRIMARY) ====================
  'phonecards': ['colnect', 'ebay'],

  // ==================== MEDALS & TOKENS (COLNECT PRIMARY) ====================
  'medals': ['colnect', 'ebay'],
  'tokens': ['colnect', 'ebay'],

  // ==================== PINS & PATCHES (COLNECT PRIMARY) ====================
  'pins': ['colnect', 'ebay'],
  'patches': ['colnect', 'ebay'],

  // ==================== STICKERS (COLNECT PRIMARY) ====================
  'stickers': ['colnect', 'ebay'],

  // ==================== KEYCHAINS & MAGNETS (COLNECT PRIMARY) ====================
  'keychains': ['colnect', 'ebay'],
  'magnets': ['colnect', 'ebay'],

  // ==================== TICKETS (COLNECT PRIMARY) ====================
  'tickets': ['colnect', 'ebay'],

  // ==================== BEVERAGE COLLECTIBLES (COLNECT PRIMARY) ====================
  'beer_coasters': ['colnect', 'ebay'],
  'bottlecaps': ['colnect', 'ebay'],
  'drink_labels': ['colnect', 'ebay'],
  'sugar_packets': ['colnect', 'ebay'],
  'tea_bags': ['colnect', 'ebay'],

  // ==================== CARD COLLECTIBLES (COLNECT PRIMARY) ====================
  'casino_cards': ['colnect', 'ebay'],
  'gift_cards': ['colnect', 'ebay'],
  'hotel_key_cards': ['colnect', 'ebay'],

  // ==================== KIDS MEAL TOYS (COLNECT PRIMARY) ====================
  'kids_meal_toys': ['colnect', 'ebay'],
  'happy_meal': ['colnect', 'ebay'],

  // ==================== LEGO ====================
  'lego': ['brickset', 'colnect', 'ebay'],
  'building_blocks': ['brickset', 'colnect', 'ebay'],

  // ==================== TRADING CARDS ====================
  'trading_cards': ['pokemon_tcg', 'psa', 'colnect', 'ebay'],
  'pokemon_cards': ['pokemon_tcg', 'psa', 'ebay'],
  'pokemon': ['pokemon_tcg', 'psa', 'ebay'],
  'mtg_cards': ['psa', 'colnect', 'ebay'],
  'sports_cards': ['psa', 'colnect', 'ebay'],
  'baseball_cards': ['psa', 'colnect', 'ebay'],
  'football_cards': ['psa', 'colnect', 'ebay'],
  'basketball_cards': ['psa', 'colnect', 'ebay'],
  'hockey_cards': ['psa', 'colnect', 'ebay'],
  'graded_cards': ['psa', 'ebay'],
  'yugioh_cards': ['psa', 'colnect', 'ebay'],

  // ==================== BOOKS ====================
  'books': ['google_books', 'ebay'],
  'rare_books': ['google_books', 'ebay'],
  'textbooks': ['google_books', 'ebay'],

  // ==================== COMICS ====================
  'comics': ['comicvine', 'colnect', 'psa', 'ebay'],
  'manga': ['comicvine', 'ebay'],
  'graphic_novels': ['comicvine', 'ebay'],

  // ==================== VIDEO GAMES ====================
  'video_games': ['colnect', 'ebay'],
  'retro_games': ['colnect', 'ebay'],
  'game_consoles': ['ebay'],

  // ==================== MUSIC ====================
  'vinyl_records': ['discogs', 'ebay'],
  'vinyl': ['discogs', 'ebay'],
  'music': ['discogs', 'ebay'],
  'records': ['discogs', 'ebay'],
  'cds': ['discogs', 'ebay'],
  'cassettes': ['discogs', 'ebay'],

  // ==================== SNEAKERS ====================
  'sneakers': ['retailed', 'ebay'],
  'shoes': ['retailed', 'ebay'],
  'jordans': ['retailed', 'ebay'],

  // ==================== STREETWEAR ====================
  'streetwear': ['retailed', 'ebay'],
  'hype_apparel': ['retailed', 'ebay'],
  'supreme': ['retailed', 'ebay'],
  'bape': ['retailed', 'ebay'],

  // ==================== APPAREL ====================
  'apparel': ['ebay'],
  'clothing': ['ebay'],
  'jerseys': ['ebay'],
  'vintage_clothing': ['ebay'],
  'designer_fashion': ['ebay'],

  // ==================== VEHICLES ====================
  'vehicles': ['nhtsa', 'ebay'],
  'cars': ['nhtsa', 'ebay'],
  'trucks': ['nhtsa', 'ebay'],
  'motorcycles': ['nhtsa', 'ebay'],
  'automotive': ['nhtsa', 'ebay'],
  'autos': ['nhtsa', 'ebay'],

  // ==================== HOUSEHOLD ====================
  'household': ['upcitemdb', 'ebay'],
  'appliances': ['upcitemdb', 'ebay'],
  'kitchen': ['upcitemdb', 'ebay'],
  'home': ['upcitemdb', 'ebay'],
  'tools': ['upcitemdb', 'ebay'],
  'power_tools': ['upcitemdb', 'ebay'],
  'baby': ['upcitemdb', 'ebay'],
  'pets': ['upcitemdb', 'ebay'],
  'grocery': ['upcitemdb', 'ebay'],
  'beauty': ['upcitemdb', 'ebay'],
  'health': ['upcitemdb', 'ebay'],

  // ==================== GENERAL ====================
  'general': ['ebay'],
  'collectibles': ['colnect', 'ebay'],
  'antiques': ['ebay'],
  'vintage': ['ebay'],
  'toys': ['colnect', 'ebay'],
  'action_figures': ['ebay'],
  'watches': ['ebay'],
  'jewelry': ['ebay'],
  'electronics': ['upcitemdb', 'ebay'],
  'art': ['ebay'],
};