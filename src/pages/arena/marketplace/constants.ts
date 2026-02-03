// FILE: src/pages/arena/marketplace/constants.ts
// HYDRA Marketplace Constants - $400B+ Resale Market Categories
// Hierarchical category system with organic growth support

import { 
  Package, Globe, Facebook, Store, Coins, BookOpen, Stamp, 
  Gem, Palette, Medal, Trophy, Guitar, Gamepad2, Car, 
  Baby, Home, Briefcase, Watch, ShoppingBag, Shirt, 
  Footprints, Camera, Cpu, Smartphone, Tv, Headphones,
  Wine, Flower2, Dog, Dumbbell, Wrench, Scissors,
  type LucideIcon
} from 'lucide-react';

// ============================================================================
// CATEGORY HIERARCHY - $400B+ RESALE MARKET
// ============================================================================

export interface SubCategory {
  id: string;
  label: string;
  keywords: string[]; // HYDRA uses these to auto-classify
}

export interface MainCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string; // Tailwind color class
  subCategories: SubCategory[];
  keywords: string[]; // Top-level keywords for HYDRA classification
}

/**
 * HYDRA RESALE CATEGORIES
 * 
 * These categories cover the full $400B+ resale market:
 * - Luxury goods
 * - Collectibles  
 * - Electronics
 * - Fashion
 * - Home goods
 * - Vehicles
 * - Business equipment
 * 
 * Sub-categories grow ORGANICALLY as new listings come in.
 * If HYDRA detects a new sub-category, it gets added automatically.
 */
export const CATEGORY_HIERARCHY: MainCategory[] = [
  {
    id: 'luxury',
    label: 'Luxury & Fashion',
    icon: Gem,
    color: 'text-purple-400',
    keywords: ['luxury', 'designer', 'haute couture', 'premium', 'high-end'],
    subCategories: [
      { id: 'watches', label: 'Watches', keywords: ['rolex', 'omega', 'patek', 'audemars', 'watch', 'chronograph', 'timepiece'] },
      { id: 'handbags', label: 'Handbags', keywords: ['birkin', 'kelly', 'chanel', 'louis vuitton', 'hermes', 'purse', 'handbag'] },
      { id: 'jewelry', label: 'Fine Jewelry', keywords: ['diamond', 'gold', 'platinum', 'cartier', 'tiffany', 'necklace', 'ring', 'bracelet'] },
      { id: 'designer_clothing', label: 'Designer Clothing', keywords: ['gucci', 'prada', 'balenciaga', 'versace', 'dior'] },
      { id: 'sneakers', label: 'Sneakers', keywords: ['jordan', 'yeezy', 'nike', 'adidas', 'dunk', 'air max', 'sneaker', 'kicks'] },
      { id: 'streetwear', label: 'Streetwear', keywords: ['supreme', 'bape', 'off-white', 'palace', 'kith', 'streetwear'] },
    ],
  },
  {
    id: 'coins_currency',
    label: 'Coins & Currency',
    icon: Coins,
    color: 'text-amber-400',
    keywords: ['numismatic', 'mint', 'currency', 'money'],
    subCategories: [
      { id: 'us_coins', label: 'US Coins', keywords: ['morgan', 'peace dollar', 'walking liberty', 'buffalo nickel', 'us mint'] },
      { id: 'world_coins', label: 'World Coins', keywords: ['sovereign', 'krugerrand', 'maple leaf', 'panda', 'britannia'] },
      { id: 'ancient_coins', label: 'Ancient Coins', keywords: ['roman', 'greek', 'byzantine', 'denarius', 'aureus', 'ancient'] },
      { id: 'bullion', label: 'Bullion', keywords: ['gold bar', 'silver bar', 'bullion', 'ingot', 'precious metal'] },
      { id: 'paper_money', label: 'Paper Money', keywords: ['banknote', 'currency note', 'paper money', 'federal reserve'] },
      { id: 'tokens_medals', label: 'Tokens & Medals', keywords: ['token', 'medal', 'medallion', 'commemorative'] },
    ],
  },
  {
    id: 'books_publications',
    label: 'Books & Publications',
    icon: BookOpen,
    color: 'text-blue-400',
    keywords: ['book', 'publication', 'literature', 'reading', 'print'],
    subCategories: [
      { id: 'first_editions', label: 'First Editions', keywords: ['first edition', 'first printing', 'signed copy', 'rare book'] },
      { id: 'rare_books', label: 'Rare Books', keywords: ['antiquarian', 'antique book', 'vintage book', 'rare'] },
      { id: 'comics', label: 'Comics', keywords: ['comic book', 'marvel', 'dc comics', 'graphic novel', 'cgc'] },
      { id: 'manga', label: 'Manga', keywords: ['manga', 'anime', 'japanese comic', 'shonen', 'seinen'] },
      { id: 'magazines', label: 'Magazines', keywords: ['magazine', 'periodical', 'vintage magazine', 'playboy', 'life'] },
      { id: 'maps_documents', label: 'Maps & Documents', keywords: ['antique map', 'historical document', 'manuscript', 'atlas'] },
    ],
  },
  {
    id: 'stamps_postal',
    label: 'Stamps & Postal',
    icon: Stamp,
    color: 'text-rose-400',
    keywords: ['philatelic', 'postage', 'postal', 'stamp collecting'],
    subCategories: [
      { id: 'us_stamps', label: 'US Stamps', keywords: ['us stamp', 'american stamp', 'usps', 'inverted jenny'] },
      { id: 'world_stamps', label: 'World Stamps', keywords: ['british stamp', 'penny black', 'international stamp'] },
      { id: 'covers', label: 'Covers & FDCs', keywords: ['first day cover', 'fdc', 'postal cover', 'envelope'] },
      { id: 'postal_history', label: 'Postal History', keywords: ['postal history', 'postmark', 'cancellation'] },
    ],
  },
  {
    id: 'trading_cards',
    label: 'Trading Cards',
    icon: Package,
    color: 'text-cyan-400',
    keywords: ['trading card', 'tcg', 'ccg', 'card game', 'graded card'],
    subCategories: [
      { id: 'sports_cards', label: 'Sports Cards', keywords: ['topps', 'panini', 'baseball card', 'basketball card', 'football card', 'hockey card'] },
      { id: 'pokemon', label: 'Pokémon', keywords: ['pokemon', 'pikachu', 'charizard', 'psa pokemon', 'pokemon tcg'] },
      { id: 'magic', label: 'Magic: The Gathering', keywords: ['mtg', 'magic the gathering', 'black lotus', 'mox'] },
      { id: 'yugioh', label: 'Yu-Gi-Oh!', keywords: ['yugioh', 'yu-gi-oh', 'blue eyes', 'dark magician'] },
      { id: 'other_tcg', label: 'Other TCGs', keywords: ['flesh and blood', 'one piece', 'digimon', 'metazoo'] },
      { id: 'non_sport', label: 'Non-Sport Cards', keywords: ['garbage pail kids', 'star wars cards', 'marvel cards'] },
    ],
  },
  {
    id: 'art_antiques',
    label: 'Art & Antiques',
    icon: Palette,
    color: 'text-pink-400',
    keywords: ['art', 'antique', 'artwork', 'fine art', 'decorative'],
    subCategories: [
      { id: 'paintings', label: 'Paintings', keywords: ['painting', 'oil painting', 'watercolor', 'acrylic', 'canvas'] },
      { id: 'sculptures', label: 'Sculptures', keywords: ['sculpture', 'bronze', 'marble', 'statue', 'figurine'] },
      { id: 'prints', label: 'Prints & Posters', keywords: ['print', 'lithograph', 'serigraph', 'poster', 'limited edition print'] },
      { id: 'pottery', label: 'Pottery & Ceramics', keywords: ['pottery', 'ceramic', 'porcelain', 'vase', 'china'] },
      { id: 'glass', label: 'Glass & Crystal', keywords: ['glass', 'crystal', 'murano', 'lalique', 'steuben'] },
      { id: 'furniture', label: 'Antique Furniture', keywords: ['antique furniture', 'victorian', 'mid-century', 'art deco'] },
    ],
  },
  {
    id: 'military_historical',
    label: 'Military & Historical',
    icon: Medal,
    color: 'text-orange-400',
    keywords: ['military', 'war', 'historical', 'veteran', 'armed forces'],
    subCategories: [
      { id: 'medals_badges', label: 'Medals & Badges', keywords: ['medal', 'badge', 'purple heart', 'bronze star', 'military medal'] },
      { id: 'uniforms', label: 'Uniforms', keywords: ['military uniform', 'army uniform', 'navy uniform', 'dress uniform'] },
      { id: 'weapons', label: 'Edged Weapons', keywords: ['sword', 'bayonet', 'knife', 'dagger', 'military blade'] },
      { id: 'memorabilia', label: 'Memorabilia', keywords: ['wwii', 'ww2', 'civil war', 'vietnam', 'military memorabilia'] },
      { id: 'documents', label: 'Documents', keywords: ['military document', 'discharge papers', 'war letter'] },
    ],
  },
  {
    id: 'sports_memorabilia',
    label: 'Sports Memorabilia',
    icon: Trophy,
    color: 'text-emerald-400',
    keywords: ['sports', 'memorabilia', 'athletic', 'game-used', 'autograph'],
    subCategories: [
      { id: 'autographs', label: 'Autographs', keywords: ['autograph', 'signed', 'signature', 'authenticated'] },
      { id: 'game_used', label: 'Game-Used', keywords: ['game used', 'game worn', 'player used', 'match worn'] },
      { id: 'equipment', label: 'Equipment', keywords: ['bat', 'glove', 'helmet', 'jersey', 'sports equipment'] },
      { id: 'tickets', label: 'Tickets & Programs', keywords: ['ticket stub', 'program', 'world series', 'super bowl'] },
      { id: 'trophies', label: 'Trophies & Awards', keywords: ['trophy', 'award', 'championship', 'ring'] },
    ],
  },
  {
    id: 'music_audio',
    label: 'Music & Audio',
    icon: Guitar,
    color: 'text-indigo-400',
    keywords: ['music', 'audio', 'sound', 'instrument', 'recording'],
    subCategories: [
      { id: 'guitars', label: 'Guitars', keywords: ['guitar', 'fender', 'gibson', 'stratocaster', 'les paul', 'acoustic'] },
      { id: 'keyboards', label: 'Keyboards & Synths', keywords: ['keyboard', 'synthesizer', 'piano', 'moog', 'roland'] },
      { id: 'vintage_amps', label: 'Vintage Amps', keywords: ['amplifier', 'tube amp', 'marshall', 'fender amp', 'vintage amp'] },
      { id: 'pro_audio', label: 'Pro Audio', keywords: ['microphone', 'mixer', 'preamp', 'studio gear', 'recording'] },
      { id: 'vinyl_records', label: 'Vinyl Records', keywords: ['vinyl', 'record', 'lp', '45', 'first pressing', 'rare vinyl'] },
      { id: 'music_memorabilia', label: 'Music Memorabilia', keywords: ['concert poster', 'tour merch', 'music memorabilia'] },
    ],
  },
  {
    id: 'electronics_gaming',
    label: 'Electronics & Gaming',
    icon: Gamepad2,
    color: 'text-violet-400',
    keywords: ['electronic', 'gaming', 'tech', 'digital', 'gadget'],
    subCategories: [
      { id: 'vintage_tech', label: 'Vintage Tech', keywords: ['vintage computer', 'apple ii', 'commodore', 'atari', 'retro tech'] },
      { id: 'cameras', label: 'Cameras', keywords: ['camera', 'leica', 'hasselblad', 'nikon', 'canon', 'vintage camera'] },
      { id: 'consoles', label: 'Game Consoles', keywords: ['playstation', 'xbox', 'nintendo', 'sega', 'console'] },
      { id: 'retro_games', label: 'Retro Games', keywords: ['nes', 'snes', 'genesis', 'n64', 'gameboy', 'retro game'] },
      { id: 'phones', label: 'Smartphones', keywords: ['iphone', 'samsung', 'pixel', 'smartphone', 'cell phone'] },
      { id: 'audio_equipment', label: 'Audio Equipment', keywords: ['headphones', 'speakers', 'turntable', 'hifi', 'stereo'] },
    ],
  },
  {
    id: 'vehicles_automobilia',
    label: 'Vehicles & Automobilia',
    icon: Car,
    color: 'text-red-400',
    keywords: ['vehicle', 'automobile', 'car', 'motorcycle', 'automotive'],
    subCategories: [
      { id: 'classic_cars', label: 'Classic Cars', keywords: ['classic car', 'vintage car', 'antique car', 'muscle car'] },
      { id: 'motorcycles', label: 'Motorcycles', keywords: ['motorcycle', 'harley', 'indian', 'vintage bike'] },
      { id: 'parts', label: 'Parts & Accessories', keywords: ['car parts', 'vintage parts', 'nos', 'oem'] },
      { id: 'signs_memorabilia', label: 'Signs & Memorabilia', keywords: ['porcelain sign', 'gas pump', 'automobilia', 'petroliana'] },
      { id: 'bikes', label: 'Bicycles', keywords: ['bicycle', 'vintage bike', 'schwinn', 'racing bike'] },
    ],
  },
  {
    id: 'toys_collectibles',
    label: 'Toys & Collectibles',
    icon: Baby,
    color: 'text-yellow-400',
    keywords: ['toy', 'collectible', 'figure', 'doll', 'plaything'],
    subCategories: [
      { id: 'vintage_toys', label: 'Vintage Toys', keywords: ['vintage toy', 'tin toy', 'antique toy', '1950s toy'] },
      { id: 'lego', label: 'LEGO', keywords: ['lego', 'lego set', 'minifigure', 'lego star wars', 'lego technic'] },
      { id: 'action_figures', label: 'Action Figures', keywords: ['action figure', 'gi joe', 'star wars figure', 'transformers'] },
      { id: 'dolls', label: 'Dolls', keywords: ['barbie', 'american girl', 'vintage doll', 'porcelain doll'] },
      { id: 'diecast', label: 'Diecast & Models', keywords: ['hot wheels', 'matchbox', 'diecast', 'model car', 'model train'] },
      { id: 'plush', label: 'Plush & Beanie', keywords: ['beanie baby', 'plush', 'stuffed animal', 'squishmallow'] },
    ],
  },
  {
    id: 'home_garden',
    label: 'Home & Garden',
    icon: Home,
    color: 'text-green-400',
    keywords: ['home', 'garden', 'furniture', 'decor', 'household'],
    subCategories: [
      { id: 'furniture', label: 'Furniture', keywords: ['sofa', 'chair', 'table', 'dresser', 'bed frame'] },
      { id: 'appliances', label: 'Appliances', keywords: ['appliance', 'refrigerator', 'washer', 'dryer', 'kitchen'] },
      { id: 'decor', label: 'Home Décor', keywords: ['decor', 'wall art', 'mirror', 'lamp', 'rug'] },
      { id: 'outdoor', label: 'Outdoor & Patio', keywords: ['patio', 'grill', 'outdoor furniture', 'garden'] },
      { id: 'tools', label: 'Tools', keywords: ['tool', 'power tool', 'hand tool', 'drill', 'saw'] },
      { id: 'kitchen', label: 'Kitchen & Dining', keywords: ['cookware', 'kitchenaid', 'le creuset', 'silverware'] },
    ],
  },
  {
    id: 'business_commercial',
    label: 'Business & Commercial',
    icon: Briefcase,
    color: 'text-slate-400',
    keywords: ['business', 'commercial', 'industrial', 'professional', 'equipment'],
    subCategories: [
      { id: 'restaurant', label: 'Restaurant Equipment', keywords: ['restaurant', 'commercial kitchen', 'food service'] },
      { id: 'medical', label: 'Medical Equipment', keywords: ['medical', 'dental', 'healthcare', 'lab equipment'] },
      { id: 'scientific', label: 'Scientific Equipment', keywords: ['scientific', 'laboratory', 'microscope', 'testing'] },
      { id: 'office', label: 'Office Equipment', keywords: ['office', 'desk', 'copier', 'printer', 'office furniture'] },
      { id: 'industrial', label: 'Industrial', keywords: ['industrial', 'machinery', 'manufacturing', 'heavy equipment'] },
    ],
  },
  {
    id: 'fashion_apparel',
    label: 'Fashion & Apparel',
    icon: Shirt,
    color: 'text-fuchsia-400',
    keywords: ['fashion', 'clothing', 'apparel', 'wear', 'garment'],
    subCategories: [
      { id: 'mens', label: "Men's Clothing", keywords: ['mens', 'shirt', 'pants', 'jacket', 'suit'] },
      { id: 'womens', label: "Women's Clothing", keywords: ['womens', 'dress', 'blouse', 'skirt'] },
      { id: 'vintage_fashion', label: 'Vintage Fashion', keywords: ['vintage clothing', 'retro fashion', '1970s', '1980s'] },
      { id: 'accessories', label: 'Accessories', keywords: ['belt', 'scarf', 'hat', 'sunglasses', 'tie'] },
      { id: 'shoes', label: 'Shoes', keywords: ['shoes', 'boots', 'heels', 'loafers', 'dress shoes'] },
    ],
  },
  {
    id: 'wine_spirits',
    label: 'Wine & Spirits',
    icon: Wine,
    color: 'text-red-500',
    keywords: ['wine', 'spirits', 'alcohol', 'liquor', 'whiskey', 'bourbon'],
    subCategories: [
      { id: 'wine', label: 'Fine Wine', keywords: ['wine', 'bordeaux', 'burgundy', 'napa', 'vintage wine'] },
      { id: 'whiskey', label: 'Whiskey', keywords: ['whiskey', 'bourbon', 'scotch', 'single malt', 'rye'] },
      { id: 'spirits', label: 'Other Spirits', keywords: ['cognac', 'brandy', 'rum', 'tequila', 'vodka'] },
      { id: 'barware', label: 'Barware', keywords: ['decanter', 'glasses', 'bar set', 'cocktail'] },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    icon: Package,
    color: 'text-zinc-400',
    keywords: [],
    subCategories: [
      { id: 'general', label: 'General', keywords: [] },
      { id: 'uncategorized', label: 'Uncategorized', keywords: [] },
    ],
  },
];

// ============================================================================
// FLAT CATEGORY LIST (for dropdowns, backwards compatibility)
// ============================================================================

export const DEFAULT_CATEGORIES = [
  { id: 'all', label: 'All Items', icon: Package },
  ...CATEGORY_HIERARCHY.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: cat.icon,
  })),
] as const;

// ============================================================================
// CATEGORY UTILITIES
// ============================================================================

/**
 * Get main category by ID
 */
export function getMainCategory(categoryId: string): MainCategory | undefined {
  return CATEGORY_HIERARCHY.find(c => c.id === categoryId);
}

/**
 * Get sub-category by ID (searches all main categories)
 */
export function getSubCategory(subCategoryId: string): { main: MainCategory; sub: SubCategory } | undefined {
  for (const main of CATEGORY_HIERARCHY) {
    const sub = main.subCategories.find(s => s.id === subCategoryId);
    if (sub) {
      return { main, sub };
    }
  }
  return undefined;
}

/**
 * Find the best matching category for an item based on keywords
 * Used by HYDRA to auto-classify listings
 */
export function classifyItem(
  itemName: string, 
  description: string = '',
  existingCategory?: string
): { mainCategory: string; subCategory: string } {
  const searchText = `${itemName} ${description}`.toLowerCase();
  
  // If item already has a valid category, keep it
  if (existingCategory && existingCategory !== 'general' && existingCategory !== 'all') {
    const existing = getSubCategory(existingCategory);
    if (existing) {
      return { mainCategory: existing.main.id, subCategory: existing.sub.id };
    }
    const existingMain = getMainCategory(existingCategory);
    if (existingMain) {
      return { mainCategory: existingMain.id, subCategory: existingMain.subCategories[0]?.id || 'general' };
    }
  }
  
  let bestMatch = { mainCategory: 'other', subCategory: 'general', score: 0 };
  
  for (const main of CATEGORY_HIERARCHY) {
    // Check main category keywords
    let mainScore = 0;
    for (const keyword of main.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        mainScore += 2;
      }
    }
    
    // Check sub-category keywords
    for (const sub of main.subCategories) {
      let subScore = mainScore;
      for (const keyword of sub.keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          subScore += 3; // Sub-category matches are more specific
        }
      }
      
      if (subScore > bestMatch.score) {
        bestMatch = {
          mainCategory: main.id,
          subCategory: sub.id,
          score: subScore,
        };
      }
    }
  }
  
  return { mainCategory: bestMatch.mainCategory, subCategory: bestMatch.subCategory };
}

/**
 * Get category label for display
 */
export function getCategoryLabel(categoryId: string): string {
  if (categoryId === 'all') return 'All Items';
  
  const main = getMainCategory(categoryId);
  if (main) return main.label;
  
  const sub = getSubCategory(categoryId);
  if (sub) return sub.sub.label;
  
  // Format unknown category IDs nicely
  return categoryId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get category icon
 */
export function getCategoryIcon(categoryId: string): LucideIcon {
  if (categoryId === 'all') return Package;
  
  const main = getMainCategory(categoryId);
  if (main) return main.icon;
  
  const sub = getSubCategory(categoryId);
  if (sub) return sub.main.icon;
  
  return Package;
}

// ============================================================================
// EXISTING CONSTANTS (unchanged)
// ============================================================================

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'profit_high', label: 'Highest Flip Potential' }, // NEW: Arbitrage sorting
] as const;

export const CONDITION_OPTIONS = [
  { value: 'all', label: 'Any Condition' },
  { value: 'mint', label: 'Mint / New' },
  { value: 'near-mint', label: 'Near Mint' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor / As-Is' },
] as const;

export const EXPORT_PLATFORMS = [
  { id: 'ebay', name: 'eBay', icon: Globe, color: 'bg-blue-500' },
  { id: 'facebook', name: 'Facebook Marketplace', icon: Facebook, color: 'bg-blue-600' },
  { id: 'mercari', name: 'Mercari', icon: Store, color: 'bg-red-500' },
  { id: 'poshmark', name: 'Poshmark', icon: ShoppingBag, color: 'bg-pink-500' },
  { id: 'depop', name: 'Depop', icon: Store, color: 'bg-red-400' },
  { id: 'grailed', name: 'Grailed', icon: Shirt, color: 'bg-black' },
  { id: 'stockx', name: 'StockX', icon: Footprints, color: 'bg-green-500' },
  { id: 'goat', name: 'GOAT', icon: Footprints, color: 'bg-gray-800' },
  { id: 'whatnot', name: 'Whatnot', icon: Store, color: 'bg-purple-500' },
  { id: 'offerup', name: 'OfferUp', icon: Store, color: 'bg-green-600' },
  { id: 'craigslist', name: 'Craigslist', icon: Globe, color: 'bg-purple-600' },
] as const;

export const PLATFORM_URLS: Record<string, string> = {
  ebay: 'https://www.ebay.com/sl/sell',
  facebook: 'https://www.facebook.com/marketplace/create/item',
  mercari: 'https://www.mercari.com/sell/',
  poshmark: 'https://poshmark.com/create-listing',
  depop: 'https://www.depop.com/products/create/',
  grailed: 'https://www.grailed.com/sell',
  stockx: 'https://stockx.com/sell',
  goat: 'https://www.goat.com/sell',
  whatnot: 'https://www.whatnot.com/sell',
  offerup: 'https://offerup.com/post',
  craigslist: 'https://post.craigslist.org/',
};

export const DEFAULT_FILTERS: FilterState = {
  category: 'all',
  priceRange: [0, 100000], // Increased for luxury items
  verifiedOnly: false,
  sortBy: 'newest',
  condition: 'all',
};

export const MAX_PRICE = 100000; // Increased for luxury market

// Re-export types for convenience
import type { FilterState } from './types';
export type { FilterState };