// FILE: src/lib/hydra/category-detection/types.ts
// HYDRA v8.0 - Category Detection Types
// All types for the category detection subsystem

// =============================================================================
// ITEM CATEGORY UNION
// =============================================================================
// Every supported category in the HYDRA system.
// Add new categories here FIRST, then add data maps and detection logic.

export type ItemCategory =
  // === Coins & Currency ===
  | 'coins' | 'banknotes' | 'currency'
  // === Stamps (Colnect primary) ===
  | 'stamps' | 'postage_stamps' | 'miniature_sheets'
  // === Postcards (Colnect primary) ===
  | 'postcards'
  // === Phone Cards (Colnect primary) ===
  | 'phonecards'
  // === Medals & Tokens (Colnect primary) ===
  | 'medals' | 'tokens'
  // === Pins & Patches (Colnect primary) ===
  | 'pins' | 'patches'
  // === Stickers (Colnect primary) ===
  | 'stickers'
  // === Keychains & Magnets (Colnect primary) ===
  | 'keychains' | 'magnets'
  // === Tickets (Colnect primary) ===
  | 'tickets'
  // === Beverage Collectibles (Colnect primary) ===
  | 'beer_coasters' | 'bottlecaps' | 'drink_labels' | 'sugar_packets' | 'tea_bags'
  // === Card Collectibles (Colnect primary) ===
  | 'casino_cards' | 'gift_cards' | 'hotel_key_cards'
  // === Kids Meal Toys (Colnect primary) ===
  | 'kids_meal_toys' | 'happy_meal'
  // === LEGO ===
  | 'lego' | 'building_blocks'
  // === Trading Cards ===
  | 'trading_cards' | 'pokemon_cards' | 'pokemon'
  | 'mtg_cards' | 'sports_cards' | 'baseball_cards'
  | 'football_cards' | 'basketball_cards' | 'hockey_cards'
  | 'graded_cards' | 'yugioh_cards'
  // === Books ===
  | 'books' | 'rare_books' | 'textbooks'
  // === Comics ===
  | 'comics' | 'manga' | 'graphic_novels'
  // === Video Games ===
  | 'video_games' | 'retro_games' | 'game_consoles'
  // === Music ===
  | 'vinyl_records' | 'vinyl' | 'music' | 'records' | 'cds' | 'cassettes'
  // === Sneakers ===
  | 'sneakers' | 'shoes' | 'jordans'
  // === Streetwear ===
  | 'streetwear' | 'hype_apparel' | 'supreme' | 'bape'
  // === Apparel ===
  | 'apparel' | 'clothing' | 'jerseys' | 'vintage_clothing' | 'designer_fashion'
  // === Vehicles ===
  | 'vehicles' | 'cars' | 'trucks' | 'motorcycles' | 'automotive' | 'autos'
  // === Household ===
  | 'household' | 'appliances' | 'kitchen' | 'home'
  | 'tools' | 'power_tools' | 'baby' | 'pets'
  | 'grocery' | 'beauty' | 'health'
  // === General ===
  | 'general' | 'collectibles' | 'antiques' | 'vintage'
  | 'toys' | 'action_figures' | 'watches' | 'jewelry'
  | 'electronics' | 'art';

// =============================================================================
// DETECTION RESULT
// =============================================================================

export interface CategoryDetection {
  category: ItemCategory;
  confidence: number;
  keywords: string[];
  source: CategorySource;
}

export type CategorySource =
  | 'name_parsing'
  | 'name_override'
  | 'ai_vote'
  | 'user_hint'
  | 'category_hint'
  | 'keyword_match'
  | 'keyword_detection'
  | 'authority_data'
  | 'default';

// =============================================================================
// OVERRIDE ENTRY
// =============================================================================

export interface NamePatternOverride {
  patterns: string[];
  category: string;
  priority: number;
}