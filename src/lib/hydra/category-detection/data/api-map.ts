// FILE: src/lib/hydra/category-detection/data/api-map.ts
// HYDRA v8.4 - Category → API Mapping
// Pure data: maps each category to the APIs that should be queried.
// Order matters: first API is primary authority, others are fallbacks.
//
// HOW TO ADD: Just add a new key-value pair. No logic changes needed.
// UPDATED v8.3: Added grocery category (food/beverage/pantry items)
//               Added food-specific subcategories
// FIXED v8.4: Removed colnect from categories it can't handle (toys, trading_cards, sports_cards)
//             Colnect only supports specific subcategories like kids_meal_toys, pins, stamps, etc.
//             General "toys" and "trading_cards" were getting "No matching Colnect category" errors.

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

  // ==================== CARD COLLECTIBLES ====================
  // NOTE: Colnect does NOT have general trading_cards or sports_cards categories.
  // Only route to colnect for specific subcategories it actually supports.
  'trading_cards': ['ebay'],
  'sports_cards': ['ebay'],
  'pokemon_cards': ['pokemon_tcg', 'ebay'],
  'graded_cards': ['psa', 'ebay'],
  'kids_meal_toys': ['colnect', 'ebay'],
  // Colnect-supported card subcategories:
  'casino_cards': ['colnect', 'ebay'],
  'gift_cards': ['colnect', 'ebay'],
  'hotel_key_cards': ['colnect', 'ebay'],

  // ==================== LEGO ====================
  'lego': ['brickset', 'ebay'],

  // ==================== BOOKS ====================
  'books': ['google_books', 'ebay'],

  // ==================== COMICS ====================
  'comics': ['comicvine', 'ebay'],

  // ==================== VIDEO GAMES ====================
  'video_games': ['ebay'],

  // ==================== VINYL / MUSIC ====================
  'vinyl_records': ['discogs', 'ebay'],
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

  // ==================== GROCERY / FOOD / BEVERAGE ====================
  'grocery': ['upcitemdb', 'kroger', 'ebay'],
  'food': ['upcitemdb', 'kroger', 'ebay'],
  'beverage': ['upcitemdb', 'kroger', 'ebay'],
  'pantry': ['upcitemdb', 'kroger', 'ebay'],
  'snacks': ['upcitemdb', 'kroger', 'ebay'],
  'drinks': ['upcitemdb', 'kroger', 'ebay'],

  // ==================== HOUSEHOLD ====================
  'household': ['upcitemdb', 'ebay'],
  'appliances': ['upcitemdb', 'ebay'],
  'kitchen': ['upcitemdb', 'ebay'],
  'home': ['upcitemdb', 'ebay'],
  'tools': ['upcitemdb', 'ebay'],
  'power_tools': ['upcitemdb', 'ebay'],
  'baby': ['upcitemdb', 'ebay'],
  'pets': ['upcitemdb', 'ebay'],
  'beauty': ['upcitemdb', 'ebay'],
  'health': ['upcitemdb', 'ebay'],
  'cleaning': ['upcitemdb', 'ebay'],
  'personal_care': ['upcitemdb', 'ebay'],

  // ==================== GENERAL ====================
  'general': ['ebay'],
  'collectibles': ['colnect', 'ebay'],
  'antiques': ['ebay'],
  'vintage': ['ebay'],
  // NOTE: General "toys" does NOT route to Colnect. Colnect only handles
  // specific subcategories (kids_meal_toys, etc). A "Darth Vader Helmet"
  // is not a Colnect item — eBay is the right authority for general toys.
  'toys': ['ebay'],
  'action_figures': ['ebay'],
  'watches': ['ebay'],
  'jewelry': ['ebay'],
  'electronics': ['upcitemdb', 'ebay'],
  'art': ['ebay'],
};