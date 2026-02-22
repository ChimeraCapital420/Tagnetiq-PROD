// FILE: src/lib/spotlightTracking/constants.ts
// ═══════════════════════════════════════════════════════════════════════
// SPOTLIGHT CONSTANTS — Weights, decay, category maps, UI chips
// ═══════════════════════════════════════════════════════════════════════

// Weight system - behavior outweighs onboarding over time
export const WEIGHTS = {
  // Onboarding = seeds (low, constant)
  ONBOARDING_INTEREST: 10,

  // Behavioral signals (grow with engagement)
  CATEGORY_VIEW: 15,
  ITEM_CLICK: 25,
  ITEM_PURCHASE: 40,
  WATCHLIST_MATCH: 35,
  SEARCH_TERM_MATCH: 20,

  // Negative signals (learning what they don't want)
  HIDDEN_ITEM_CATEGORY: -20,
  VIEWED_NOT_CLICKED: -5,

  // Quality signals
  VERIFIED_ITEM: 12,
  HIGH_CONFIDENCE: 8,
  LOCAL_ITEM: 15,
  HAS_SHIPPING: 10,
  GOOD_DEAL: 10,
  RECENCY_MAX: 10,
};

// Time decay multipliers
export const DECAY = {
  RECENT: 1.0,      // Last 7 days = full weight
  MODERATE: 0.6,    // 7-30 days = 60% weight
  OLD: 0.3,         // 30-90 days = 30% weight
  ANCIENT: 0.1,     // 90+ days = 10% weight (but never zero)
};

// Personalization levels based on data points
export const PERSONALIZATION_LEVELS = {
  LEARNING: { min: 0, max: 10, label: 'Learning', icon: '🌱', description: 'Getting to know you...' },
  GROWING: { min: 11, max: 30, label: 'Growing', icon: '🌿', description: 'Starting to understand your taste' },
  PERSONALIZED: { min: 31, max: 100, label: 'Personalized', icon: '🌳', description: 'Curated for you' },
  EXPERT: { min: 101, max: Infinity, label: 'Expert', icon: '✨', description: 'Deeply personalized' },
};

// Map onboarding interests to categories
export const INTEREST_TO_CATEGORY_MAP: Record<string, string[]> = {
  'real-estate': ['real-estate', 'property', 'home'],
  'vehicles': ['vehicles', 'cars', 'automotive', 'motorcycle'],
  'collectibles': ['collectibles', 'memorabilia', 'vintage'],
  'luxury-goods': ['luxury', 'designer', 'watches', 'jewelry'],
  'lego': ['lego', 'building-sets', 'toys'],
  'star-wars': ['star-wars', 'sci-fi', 'collectibles'],
  'sports-memorabilia': ['sports', 'memorabilia', 'cards'],
  'books-media': ['books', 'media', 'comics', 'magazines'],
  'coins-currency': ['coins', 'currency', 'numismatics', 'bullion'],
  'trading-cards': ['trading-cards', 'pokemon', 'sports-cards', 'tcg'],
  'art-antiques': ['art', 'antiques', 'paintings', 'sculptures'],
  'electronics': ['electronics', 'gadgets', 'gaming', 'computers'],
};

// Category filter chips
export const CATEGORY_CHIPS = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'coins', label: 'Coins', icon: '🪙' },
  { id: 'trading-cards', label: 'Cards', icon: '🃏' },
  { id: 'lego', label: 'LEGO', icon: '🧱' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'collectibles', label: 'Collectibles', icon: '🎨' },
  { id: 'sports', label: 'Sports', icon: '🏆' },
  { id: 'art', label: 'Art', icon: '🖼️' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'luxury', label: 'Luxury', icon: '💎' },
];