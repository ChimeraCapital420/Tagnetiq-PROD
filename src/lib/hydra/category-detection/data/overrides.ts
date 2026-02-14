// FILE: src/lib/hydra/category-detection/data/overrides.ts
// HYDRA v8.4 - Name Pattern Overrides
// Pure data: patterns that OVERRIDE AI votes when found in item name.
// Higher priority = checked first. Sorted at runtime by priority DESC.
//
// HOW TO ADD: Add a new entry with patterns[], category, and priority.
// Priority guide: 120 = Colnect-unique, 115 = niche collectible,
//                 110 = hype brands, 100 = general apparel, 90-95 = specific items
//
// PATTERN TYPES:
//   Regular strings  → matched via nameLower.includes(pattern)
//   "\\b" prefixed   → matched via regex word boundary (prevents false positives)
//   Use \\b for SHORT patterns that appear inside other words:
//     "lp" matches inside "dlp", "help", "alps" → use "\\blp\\b" instead
//
// FIXED v8.4: "Dell 3300MP DLP Projector" was classified as vinyl_records
//             because " lp" / "lp " matched "dlp projector" after lowering.
//             Now uses word-boundary pattern "\\blp\\b".

import type { NamePatternOverride } from '../types.js';

export const NAME_PATTERN_OVERRIDES: NamePatternOverride[] = [
  // ==========================================================================
  // COLNECT-PRIMARY (120) - No other authority source exists
  // ==========================================================================
  {
    patterns: ['stamp', 'postage', 'philately', 'philatelic', 'first day cover', 'fdc'],
    category: 'stamps',
    priority: 120,
  },
  {
    patterns: ['banknote', 'bank note', 'paper money', 'paper currency'],
    category: 'banknotes',
    priority: 120,
  },
  {
    patterns: ['postcard', 'post card', 'rppc'],
    category: 'postcards',
    priority: 120,
  },

  // ==========================================================================
  // NICHE COLLECTIBLES (115) - Colnect is primary or sole authority
  // ==========================================================================
  {
    patterns: ['medal', 'medallion', 'military medal', 'service medal'],
    category: 'medals',
    priority: 115,
  },
  {
    patterns: ['enamel pin', 'lapel pin', 'pin badge', 'collector pin', 'disney pin', 'olympic pin'],
    category: 'pins',
    priority: 115,
  },
  {
    patterns: ['embroidered patch', 'iron-on patch', 'morale patch', 'military patch', 'scout patch'],
    category: 'patches',
    priority: 115,
  },
  {
    patterns: ['phone card', 'phonecard', 'calling card', 'telecarte'],
    category: 'phonecards',
    priority: 115,
  },
  {
    patterns: ['beer coaster', 'beermat', 'beer mat'],
    category: 'beer_coasters',
    priority: 115,
  },
  {
    patterns: ['bottle cap', 'bottlecap', 'crown cap'],
    category: 'bottlecaps',
    priority: 115,
  },
  {
    patterns: ['happy meal', 'mcdonalds toy', 'kids meal toy', 'kinder surprise', 'kinder egg'],
    category: 'kids_meal_toys',
    priority: 115,
  },
  {
    patterns: ['arcade token', 'transit token', 'casino chip', 'casino token', 'parking token'],
    category: 'tokens',
    priority: 110,
  },

  // ==========================================================================
  // STREETWEAR / HYPE BRANDS (110) - Check BEFORE general apparel
  // ==========================================================================
  {
    patterns: ['supreme', 'box logo', 'bogo'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['bape', 'bathing ape', 'baby milo', 'bape shark'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['off-white', 'off white', 'offwhite', 'virgil abloh'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['fear of god', 'fog essentials', 'essentials hoodie', 'essentials'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['palace', 'tri-ferg', 'palace skate'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['travis scott', 'cactus jack', 'astroworld', 'utopia merch'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['anti social social club', 'assc'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['vlone', 'chrome hearts', 'gallery dept', 'rhude', 'amiri'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['stussy', 'kith', 'undefeated', 'undftd'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['yeezy gap', 'yzy gap', 'yeezy season'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['sp5der', 'spider worldwide', 'hellstar', 'eric emanuel', 'ee shorts'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['drew house', 'human made', 'billionaire boys club', 'bbc icecream'],
    category: 'streetwear',
    priority: 110,
  },
  {
    patterns: ['corteiz', 'crtz', 'broken planet'],
    category: 'streetwear',
    priority: 110,
  },

  // ==========================================================================
  // GENERAL APPAREL (100) - Lower priority than streetwear
  // ==========================================================================
  {
    patterns: ['hoodie', 'hoody', 'sweatshirt', 'sweater', 'pullover', 'crewneck'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['jacket', 'coat', 'blazer', 'windbreaker', 'parka', 'vest'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['jersey', 'team jersey', 'nfl jersey', 'nba jersey', 'nhl jersey', 'mlb jersey'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['t-shirt', 'tee shirt', 'polo shirt', 'button up', 'flannel shirt'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['pants', 'jeans', 'shorts', 'joggers', 'sweatpants', 'trousers'],
    category: 'apparel',
    priority: 100,
  },
  {
    patterns: ['hat', 'cap', 'beanie', 'snapback', 'fitted cap', 'bucket hat'],
    category: 'apparel',
    priority: 100,
  },

  // ==========================================================================
  // SPECIFIC ITEMS (90-95) - High-confidence patterns
  // FIXED v8.4: "lp" now uses word-boundary matching via \\b prefix.
  //   Old: [' lp', 'lp '] — matched "dlp projector" → vinyl_records ❌
  //   New: ['\\blp\\b']   — matches "vinyl lp" but NOT "dlp projector" ✅
  // ==========================================================================
  {
    patterns: ['vinyl', 'record', '\\blp\\b', '33 rpm', '45 rpm', 'album'],
    category: 'vinyl_records',
    priority: 95,
  },
  {
    patterns: ['pokemon', 'pokémon', 'pikachu', 'charizard', 'mewtwo'],
    category: 'pokemon_cards',
    priority: 90,
  },
  {
    patterns: ['lego', 'minifig', 'minifigure'],
    category: 'lego',
    priority: 90,
  },
  {
    patterns: ['psa 10', 'psa 9', 'bgs 10', 'bgs 9.5', 'cgc 9.8'],
    category: 'graded_cards',
    priority: 90,
  },
];