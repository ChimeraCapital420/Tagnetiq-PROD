// FILE: src/lib/categories/universal-categories.ts
// TagnetIQ Universal Category System
// Covers the ENTIRE $400B resale market - not just collectibles
// Designed to scale as new categories emerge

export type CategoryGroup = 
  | 'electronics'
  | 'fashion'
  | 'collectibles'
  | 'home'
  | 'vehicles'
  | 'media'
  | 'sports'
  | 'toys'
  | 'business'
  | 'other';

export interface Category {
  id: string;
  name: string;
  group: CategoryGroup;
  icon: string;
  keywords: string[];
  suggestedPlatforms: string[];
  pricingSources: string[];
  avgMargin?: string;
  marketSize?: string;
}

// ============================================================================
// THE COMPLETE RESALE CATEGORY TAXONOMY - 40+ Categories
// ============================================================================

export const CATEGORIES: Category[] = [
  // =========================================================================
  // 📱 ELECTRONICS - $150B+ market
  // =========================================================================
  {
    id: 'phones',
    name: 'Phones & Tablets',
    group: 'electronics',
    icon: '📱',
    keywords: ['iphone', 'samsung', 'galaxy', 'pixel', 'ipad', 'tablet', 'android', 'smartphone'],
    suggestedPlatforms: ['ebay', 'swappa', 'facebook', 'mercari', 'offerup'],
    pricingSources: ['ebay', 'swappa', 'backmarket'],
    avgMargin: '15-30%',
    marketSize: '$50B',
  },
  {
    id: 'computers',
    name: 'Computers & Laptops',
    group: 'electronics',
    icon: '💻',
    keywords: ['macbook', 'laptop', 'pc', 'desktop', 'imac', 'chromebook', 'dell', 'hp', 'lenovo', 'thinkpad'],
    suggestedPlatforms: ['ebay', 'facebook', 'mercari', 'craigslist'],
    pricingSources: ['ebay', 'backmarket'],
    avgMargin: '10-25%',
    marketSize: '$30B',
  },
  {
    id: 'gaming-consoles',
    name: 'Gaming Consoles',
    group: 'electronics',
    icon: '🎮',
    keywords: ['playstation', 'ps5', 'ps4', 'xbox', 'nintendo', 'switch', 'steam deck', 'console'],
    suggestedPlatforms: ['ebay', 'facebook', 'mercari', 'offerup', 'gamestop'],
    pricingSources: ['ebay', 'pricecharting'],
    avgMargin: '10-20%',
    marketSize: '$15B',
  },
  {
    id: 'cameras',
    name: 'Cameras & Photo',
    group: 'electronics',
    icon: '📷',
    keywords: ['canon', 'nikon', 'sony', 'dslr', 'mirrorless', 'lens', 'gopro', 'drone', 'dji'],
    suggestedPlatforms: ['ebay', 'facebook', 'keh', 'mpb', 'mercari'],
    pricingSources: ['ebay', 'keh', 'mpb'],
    avgMargin: '15-35%',
    marketSize: '$8B',
  },
  {
    id: 'audio',
    name: 'Audio Equipment',
    group: 'electronics',
    icon: '🎧',
    keywords: ['headphones', 'airpods', 'speaker', 'bose', 'sonos', 'amplifier', 'receiver', 'turntable'],
    suggestedPlatforms: ['ebay', 'facebook', 'reverb', 'mercari', 'audiogon'],
    pricingSources: ['ebay', 'reverb', 'audiogon'],
    avgMargin: '20-40%',
    marketSize: '$10B',
  },
  {
    id: 'smart-home',
    name: 'Smart Home & IoT',
    group: 'electronics',
    icon: '🏠',
    keywords: ['nest', 'ring', 'alexa', 'echo', 'smart', 'thermostat', 'security camera', 'doorbell'],
    suggestedPlatforms: ['ebay', 'facebook', 'mercari', 'amazon'],
    pricingSources: ['ebay'],
    avgMargin: '15-30%',
  },
  {
    id: 'parts-components',
    name: 'Parts & Components',
    group: 'electronics',
    icon: '🔧',
    keywords: ['gpu', 'graphics card', 'cpu', 'ram', 'ssd', 'motherboard', 'power supply', 'parts'],
    suggestedPlatforms: ['ebay', 'hardwareswap', 'facebook', 'mercari'],
    pricingSources: ['ebay', 'pcpartpicker'],
    avgMargin: '10-25%',
    marketSize: '$20B',
  },

  // =========================================================================
  // 👗 FASHION - $80B+ market
  // =========================================================================
  {
    id: 'sneakers',
    name: 'Sneakers & Shoes',
    group: 'fashion',
    icon: '👟',
    keywords: ['nike', 'jordan', 'yeezy', 'adidas', 'new balance', 'dunk', 'air max', 'sneaker', 'shoes'],
    suggestedPlatforms: ['stockx', 'goat', 'ebay', 'grailed', 'mercari', 'depop'],
    pricingSources: ['stockx', 'goat', 'ebay', 'retailed'],
    avgMargin: '15-50%',
    marketSize: '$30B',
  },
  {
    id: 'designer-bags',
    name: 'Designer Bags',
    group: 'fashion',
    icon: '👜',
    keywords: ['louis vuitton', 'lv', 'gucci', 'chanel', 'hermes', 'prada', 'coach', 'handbag', 'purse'],
    suggestedPlatforms: ['ebay', 'poshmark', 'therealreal', 'vestiaire', 'tradesy', 'rebag'],
    pricingSources: ['ebay', 'therealreal', 'vestiaire'],
    avgMargin: '20-60%',
    marketSize: '$15B',
  },
  {
    id: 'watches',
    name: 'Watches',
    group: 'fashion',
    icon: '⌚',
    keywords: ['rolex', 'omega', 'seiko', 'casio', 'tag heuer', 'cartier', 'apple watch', 'g-shock'],
    suggestedPlatforms: ['ebay', 'chrono24', 'watchexchange', 'mercari'],
    pricingSources: ['ebay', 'chrono24', 'watchcharting'],
    avgMargin: '10-40%',
    marketSize: '$20B',
  },
  {
    id: 'clothing',
    name: 'Clothing & Apparel',
    group: 'fashion',
    icon: '👕',
    keywords: ['vintage', 'streetwear', 'supreme', 'shirt', 'jacket', 'jeans', 'dress', 'coat'],
    suggestedPlatforms: ['ebay', 'poshmark', 'depop', 'grailed', 'mercari', 'thredup'],
    pricingSources: ['ebay', 'poshmark'],
    avgMargin: '30-70%',
    marketSize: '$25B',
  },
  {
    id: 'jewelry',
    name: 'Jewelry',
    group: 'fashion',
    icon: '💎',
    keywords: ['gold', 'silver', 'diamond', 'ring', 'necklace', 'bracelet', 'earring', 'tiffany'],
    suggestedPlatforms: ['ebay', 'etsy', 'poshmark', 'therealreal', 'worthy'],
    pricingSources: ['ebay', 'worthy'],
    avgMargin: '20-50%',
    marketSize: '$10B',
  },

  // =========================================================================
  // 🃏 COLLECTIBLES - $50B+ market
  // =========================================================================
  {
    id: 'trading-cards',
    name: 'Trading Cards',
    group: 'collectibles',
    icon: '🃏',
    keywords: ['pokemon', 'yugioh', 'magic', 'mtg', 'sports card', 'baseball card', 'topps', 'panini', 'psa', 'bgs'],
    suggestedPlatforms: ['ebay', 'tcgplayer', 'comc', 'whatnot', 'myslabs'],
    pricingSources: ['ebay', 'tcgplayer', 'pricecharting', 'psa', '130point'],
    avgMargin: '15-100%',
    marketSize: '$15B',
  },
  {
    id: 'coins',
    name: 'Coins & Currency',
    group: 'collectibles',
    icon: '🪙',
    keywords: ['coin', 'silver', 'gold', 'bullion', 'penny', 'dollar', 'currency', 'pcgs', 'ngc', 'numismatic'],
    suggestedPlatforms: ['ebay', 'heritage', 'greatcollections', 'apmex', 'jmbullion'],
    pricingSources: ['ebay', 'numista', 'pcgs', 'ngc'],
    avgMargin: '10-30%',
    marketSize: '$10B',
  },
  {
    id: 'sports-memorabilia',
    name: 'Sports Memorabilia',
    group: 'collectibles',
    icon: '🏆',
    keywords: ['autograph', 'signed', 'jersey', 'helmet', 'game used', 'memorabilia', 'nfl', 'nba', 'mlb'],
    suggestedPlatforms: ['ebay', 'goldin', 'heritage', 'pristine', 'fanatics'],
    pricingSources: ['ebay', 'goldin', 'heritage'],
    avgMargin: '20-50%',
    marketSize: '$8B',
  },
  {
    id: 'lego',
    name: 'LEGO',
    group: 'collectibles',
    icon: '🧱',
    keywords: ['lego', 'minifigure', 'star wars lego', 'technic', 'creator', 'modular'],
    suggestedPlatforms: ['ebay', 'bricklink', 'mercari', 'facebook'],
    pricingSources: ['ebay', 'bricklink', 'brickset'],
    avgMargin: '20-100%',
    marketSize: '$2B',
  },
  {
    id: 'vinyl-records',
    name: 'Vinyl Records',
    group: 'collectibles',
    icon: '💿',
    keywords: ['vinyl', 'record', 'lp', 'album', '45', 'pressing', 'first press'],
    suggestedPlatforms: ['ebay', 'discogs', 'reverb', 'mercari'],
    pricingSources: ['ebay', 'discogs'],
    avgMargin: '30-200%',
    marketSize: '$2B',
  },
  {
    id: 'antiques',
    name: 'Antiques & Vintage',
    group: 'collectibles',
    icon: '🏺',
    keywords: ['antique', 'vintage', 'retro', 'mid century', 'art deco', 'victorian', 'estate'],
    suggestedPlatforms: ['ebay', 'etsy', 'chairish', 'ruby lane', '1stdibs'],
    pricingSources: ['ebay', 'liveauctioneers'],
    avgMargin: '50-500%',
    marketSize: '$5B',
  },
  {
    id: 'comics',
    name: 'Comics & Manga',
    group: 'collectibles',
    icon: '📚',
    keywords: ['comic', 'marvel', 'dc', 'cgc', 'manga', 'graphic novel', 'first appearance'],
    suggestedPlatforms: ['ebay', 'mycomicshop', 'heritage', 'whatnot'],
    pricingSources: ['ebay', 'gocollect', 'gpanalysis'],
    avgMargin: '20-100%',
    marketSize: '$3B',
  },
  {
    id: 'funko',
    name: 'Funko & Figures',
    group: 'collectibles',
    icon: '🎭',
    keywords: ['funko', 'pop', 'action figure', 'hot toys', 'nendoroid', 'statue'],
    suggestedPlatforms: ['ebay', 'mercari', 'whatnot', 'funkoapp'],
    pricingSources: ['ebay', 'poppriceguide', 'hobbydb'],
    avgMargin: '20-200%',
    marketSize: '$2B',
  },

  // =========================================================================
  // 🏠 HOME & FURNITURE - $60B+ market
  // =========================================================================
  {
    id: 'furniture',
    name: 'Furniture',
    group: 'home',
    icon: '🪑',
    keywords: ['sofa', 'couch', 'table', 'chair', 'desk', 'bed', 'dresser', 'cabinet', 'ikea', 'herman miller'],
    suggestedPlatforms: ['facebook', 'craigslist', 'offerup', 'aptdeco', 'chairish'],
    pricingSources: ['ebay', 'aptdeco'],
    avgMargin: '30-100%',
    marketSize: '$30B',
  },
  {
    id: 'appliances',
    name: 'Appliances',
    group: 'home',
    icon: '🍳',
    keywords: ['refrigerator', 'washer', 'dryer', 'dishwasher', 'microwave', 'oven', 'vacuum', 'dyson'],
    suggestedPlatforms: ['facebook', 'craigslist', 'offerup', 'ebay'],
    pricingSources: ['ebay'],
    avgMargin: '20-50%',
    marketSize: '$15B',
  },
  {
    id: 'tools',
    name: 'Tools & Equipment',
    group: 'home',
    icon: '🔨',
    keywords: ['dewalt', 'milwaukee', 'makita', 'snap-on', 'craftsman', 'drill', 'saw', 'power tool'],
    suggestedPlatforms: ['ebay', 'facebook', 'craigslist', 'offerup'],
    pricingSources: ['ebay'],
    avgMargin: '20-60%',
    marketSize: '$10B',
  },
  {
    id: 'home-decor',
    name: 'Home Decor',
    group: 'home',
    icon: '🖼️',
    keywords: ['art', 'mirror', 'lamp', 'rug', 'curtain', 'pillow', 'decor', 'wall art'],
    suggestedPlatforms: ['ebay', 'etsy', 'poshmark', 'facebook', 'mercari'],
    pricingSources: ['ebay', 'etsy'],
    avgMargin: '40-150%',
    marketSize: '$5B',
  },
  {
    id: 'kitchen',
    name: 'Kitchen & Dining',
    group: 'home',
    icon: '🍽️',
    keywords: ['kitchenaid', 'le creuset', 'vitamix', 'instant pot', 'cuisinart', 'cookware'],
    suggestedPlatforms: ['ebay', 'facebook', 'mercari', 'poshmark'],
    pricingSources: ['ebay'],
    avgMargin: '25-60%',
  },
  {
    id: 'outdoor-garden',
    name: 'Outdoor & Garden',
    group: 'home',
    icon: '🌻',
    keywords: ['patio', 'grill', 'lawn mower', 'outdoor furniture', 'bbq', 'garden', 'landscaping'],
    suggestedPlatforms: ['facebook', 'craigslist', 'offerup', 'ebay'],
    pricingSources: ['ebay'],
    avgMargin: '25-50%',
  },

  // =========================================================================
  // 🚗 VEHICLES & PARTS - $40B+ market
  // =========================================================================
  {
    id: 'cars',
    name: 'Cars & Trucks',
    group: 'vehicles',
    icon: '🚗',
    keywords: ['car', 'truck', 'suv', 'sedan', 'coupe', 'vehicle', 'automobile'],
    suggestedPlatforms: ['facebook', 'craigslist', 'cargurus', 'autotrader', 'cars.com'],
    pricingSources: ['kbb', 'edmunds', 'cargurus'],
    avgMargin: '5-20%',
    marketSize: '$25B',
  },
  {
    id: 'motorcycles',
    name: 'Motorcycles & ATVs',
    group: 'vehicles',
    icon: '🏍️',
    keywords: ['motorcycle', 'harley', 'honda', 'yamaha', 'kawasaki', 'atv', 'dirt bike'],
    suggestedPlatforms: ['facebook', 'craigslist', 'cycletrader', 'ebay'],
    pricingSources: ['nada', 'kbb', 'ebay'],
    avgMargin: '10-25%',
  },
  {
    id: 'auto-parts',
    name: 'Auto Parts',
    group: 'vehicles',
    icon: '⚙️',
    keywords: ['car part', 'engine', 'transmission', 'wheels', 'tires', 'brakes', 'oem', 'aftermarket'],
    suggestedPlatforms: ['ebay', 'facebook', 'car-part.com', 'rockauto'],
    pricingSources: ['ebay', 'rockauto'],
    avgMargin: '30-100%',
    marketSize: '$10B',
  },
  {
    id: 'boats-marine',
    name: 'Boats & Marine',
    group: 'vehicles',
    icon: '⛵',
    keywords: ['boat', 'kayak', 'jet ski', 'outboard', 'marine', 'fishing boat'],
    suggestedPlatforms: ['facebook', 'craigslist', 'boattrader', 'ebay'],
    pricingSources: ['nada', 'boattrader'],
    avgMargin: '10-30%',
  },

  // =========================================================================
  // 🎬 MEDIA & ENTERTAINMENT - $20B+ market
  // =========================================================================
  {
    id: 'video-games',
    name: 'Video Games',
    group: 'media',
    icon: '🕹️',
    keywords: ['game', 'ps5 game', 'xbox game', 'nintendo game', 'retro game', 'sealed game'],
    suggestedPlatforms: ['ebay', 'mercari', 'gamestop', 'pricecharting', 'facebook'],
    pricingSources: ['ebay', 'pricecharting'],
    avgMargin: '20-200%',
    marketSize: '$8B',
  },
  {
    id: 'books',
    name: 'Books',
    group: 'media',
    icon: '📖',
    keywords: ['book', 'textbook', 'first edition', 'signed book', 'rare book', 'novel'],
    suggestedPlatforms: ['ebay', 'amazon', 'abebooks', 'thriftbooks', 'mercari'],
    pricingSources: ['ebay', 'abebooks', 'bookfinder'],
    avgMargin: '50-500%',
    marketSize: '$5B',
  },
  {
    id: 'movies-dvd',
    name: 'Movies & DVDs',
    group: 'media',
    icon: '🎬',
    keywords: ['dvd', 'blu-ray', 'movie', 'criterion', '4k', 'box set'],
    suggestedPlatforms: ['ebay', 'mercari', 'amazon', 'facebook'],
    pricingSources: ['ebay'],
    avgMargin: '30-100%',
  },

  // =========================================================================
  // ⚽ SPORTS & OUTDOOR - $15B+ market
  // =========================================================================
  {
    id: 'sports-equipment',
    name: 'Sports Equipment',
    group: 'sports',
    icon: '⚽',
    keywords: ['golf', 'tennis', 'basketball', 'baseball', 'soccer', 'hockey', 'equipment'],
    suggestedPlatforms: ['ebay', 'facebook', 'offerup', 'sideline swap', 'mercari'],
    pricingSources: ['ebay'],
    avgMargin: '25-60%',
    marketSize: '$8B',
  },
  {
    id: 'bicycles',
    name: 'Bicycles',
    group: 'sports',
    icon: '🚴',
    keywords: ['bike', 'bicycle', 'mountain bike', 'road bike', 'ebike', 'trek', 'specialized'],
    suggestedPlatforms: ['facebook', 'pinkbike', 'craigslist', 'ebay', 'offerup'],
    pricingSources: ['ebay', 'bicyclebluebook'],
    avgMargin: '15-40%',
    marketSize: '$3B',
  },
  {
    id: 'fitness',
    name: 'Fitness Equipment',
    group: 'sports',
    icon: '🏋️',
    keywords: ['treadmill', 'peloton', 'weights', 'dumbbell', 'gym', 'exercise', 'bowflex'],
    suggestedPlatforms: ['facebook', 'craigslist', 'offerup', 'ebay'],
    pricingSources: ['ebay'],
    avgMargin: '20-50%',
    marketSize: '$4B',
  },
  {
    id: 'camping-outdoor',
    name: 'Camping & Outdoor',
    group: 'sports',
    icon: '⛺',
    keywords: ['tent', 'camping', 'hiking', 'backpack', 'sleeping bag', 'yeti', 'patagonia'],
    suggestedPlatforms: ['ebay', 'facebook', 'geartrade', 'rei used', 'mercari'],
    pricingSources: ['ebay', 'geartrade'],
    avgMargin: '25-60%',
  },

  // =========================================================================
  // 🧸 TOYS & KIDS - $10B+ market
  // =========================================================================
  {
    id: 'toys-general',
    name: 'Toys',
    group: 'toys',
    icon: '🧸',
    keywords: ['toy', 'hasbro', 'mattel', 'hot wheels', 'barbie', 'nerf', 'playset'],
    suggestedPlatforms: ['ebay', 'mercari', 'facebook', 'whatnot'],
    pricingSources: ['ebay'],
    avgMargin: '30-200%',
    marketSize: '$5B',
  },
  {
    id: 'baby-kids',
    name: 'Baby & Kids',
    group: 'toys',
    icon: '👶',
    keywords: ['stroller', 'car seat', 'crib', 'baby', 'kids', 'uppababy', 'bugaboo'],
    suggestedPlatforms: ['facebook', 'mercari', 'poshmark', 'offerup', 'kidizen'],
    pricingSources: ['ebay', 'kidizen'],
    avgMargin: '30-60%',
    marketSize: '$5B',
  },

  // =========================================================================
  // 🏢 BUSINESS & INDUSTRIAL - $15B+ market
  // =========================================================================
  {
    id: 'office-equipment',
    name: 'Office Equipment',
    group: 'business',
    icon: '🖨️',
    keywords: ['printer', 'monitor', 'office chair', 'standing desk', 'scanner', 'projector'],
    suggestedPlatforms: ['ebay', 'facebook', 'craigslist', 'mercari'],
    pricingSources: ['ebay'],
    avgMargin: '25-60%',
  },
  {
    id: 'restaurant-equipment',
    name: 'Restaurant Equipment',
    group: 'business',
    icon: '🍕',
    keywords: ['commercial', 'restaurant', 'food service', 'refrigeration', 'oven', 'fryer'],
    suggestedPlatforms: ['ebay', 'craigslist', 'bidspotter', 'webstaurant'],
    pricingSources: ['ebay'],
    avgMargin: '30-70%',
  },
  {
    id: 'industrial',
    name: 'Industrial Equipment',
    group: 'business',
    icon: '🏗️',
    keywords: ['forklift', 'machinery', 'industrial', 'cnc', 'lathe', 'welder'],
    suggestedPlatforms: ['ebay', 'machinery trader', 'bidspotter', 'govplanet'],
    pricingSources: ['ebay'],
    avgMargin: '20-50%',
  },

  // =========================================================================
  // 🎸 MUSIC & INSTRUMENTS - $5B+ market
  // =========================================================================
  {
    id: 'instruments',
    name: 'Musical Instruments',
    group: 'other',
    icon: '🎸',
    keywords: ['guitar', 'fender', 'gibson', 'piano', 'keyboard', 'drums', 'violin', 'saxophone'],
    suggestedPlatforms: ['ebay', 'reverb', 'guitar center used', 'facebook', 'craigslist'],
    pricingSources: ['ebay', 'reverb'],
    avgMargin: '15-40%',
    marketSize: '$5B',
  },

  // =========================================================================
  // 📦 CATCH-ALL
  // =========================================================================
  {
    id: 'other',
    name: 'Other Items',
    group: 'other',
    icon: '📦',
    keywords: [],
    suggestedPlatforms: ['ebay', 'facebook', 'mercari', 'craigslist', 'offerup'],
    pricingSources: ['ebay'],
    avgMargin: '20-50%',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function detectCategory(itemName: string): Category {
  const normalized = itemName.toLowerCase();
  
  const scores = CATEGORIES.map(cat => {
    const matchCount = cat.keywords.filter(kw => normalized.includes(kw)).length;
    return { category: cat, score: matchCount };
  });
  
  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best.score > 0 ? best.category : CATEGORIES.find(c => c.id === 'other')!;
}

export function getCategoriesByGroup(group: CategoryGroup): Category[] {
  return CATEGORIES.filter(c => c.group === group);
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id);
}

export function getSuggestedPlatforms(categoryId: string): string[] {
  const cat = getCategoryById(categoryId);
  return cat?.suggestedPlatforms || ['ebay', 'facebook', 'mercari'];
}

export function getAllPlatforms(): string[] {
  const platforms = new Set<string>();
  CATEGORIES.forEach(cat => cat.suggestedPlatforms.forEach(p => platforms.add(p)));
  return Array.from(platforms);
}

export function searchCategories(query: string): Category[] {
  const normalized = query.toLowerCase();
  return CATEGORIES.filter(cat => 
    cat.name.toLowerCase().includes(normalized) ||
    cat.keywords.some(kw => kw.includes(normalized))
  );
}

// ============================================================================
// UI HELPERS
// ============================================================================

export const CATEGORY_GROUPS = [
  { id: 'electronics' as const, name: 'Electronics', icon: '📱' },
  { id: 'fashion' as const, name: 'Fashion', icon: '👟' },
  { id: 'collectibles' as const, name: 'Collectibles', icon: '🃏' },
  { id: 'home' as const, name: 'Home & Garden', icon: '🏠' },
  { id: 'vehicles' as const, name: 'Vehicles', icon: '🚗' },
  { id: 'media' as const, name: 'Media', icon: '🎬' },
  { id: 'sports' as const, name: 'Sports & Outdoor', icon: '⚽' },
  { id: 'toys' as const, name: 'Toys & Kids', icon: '🧸' },
  { id: 'business' as const, name: 'Business', icon: '🏢' },
  { id: 'other' as const, name: 'Other', icon: '📦' },
];

// ============================================================================
// MARKET STATS - Updated for $400B vision
// ============================================================================

export const MARKET_STATS = {
  totalMarketSize: '$400B',
  yoyGrowth: '10%',
  topCategories: [
    { name: 'Electronics', size: '$150B' },
    { name: 'Fashion', size: '$80B' },
    { name: 'Home & Furniture', size: '$60B' },
    { name: 'Collectibles', size: '$50B' },
    { name: 'Vehicles & Parts', size: '$40B' },
  ],
  platforms: 50,
  categoriesTracked: CATEGORIES.length,
};