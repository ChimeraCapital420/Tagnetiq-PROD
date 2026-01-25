// FILE: api/flip/listing-generator.ts
// Listing Generator - Auto-generate optimized titles, descriptions, keywords
// Works with HYDRA analysis results to create platform-ready listings

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// ==================== TYPES ====================

interface AnalysisInput {
  itemName: string;
  category: string;
  subCategory?: string;
  estimatedValue: number;
  condition?: string;
  valuation_factors?: string[];
  tags?: string[];
  marketComps?: Array<{
    title?: string;
    price?: number;
    condition?: string;
  }>;
  authorityData?: any;
}

interface GeneratedListing {
  // Core listing content
  title: {
    short: string;      // 40 chars - FB Marketplace, Craigslist
    medium: string;     // 80 chars - eBay, Mercari
    long: string;       // 120 chars - Full SEO title
  };
  description: {
    short: string;      // 150 chars - Social media preview
    medium: string;     // 500 chars - FB/Craigslist
    full: string;       // 2000 chars - eBay/Mercari full listing
  };
  
  // SEO & Discovery
  keywords: string[];           // Top 10 search keywords
  hashtags: string[];           // Social media hashtags
  searchTerms: string[];        // What buyers search for
  
  // Pricing suggestions
  pricing: {
    listPrice: number;          // Suggested list price
    minimumAccept: number;      // Lowest you should accept
    quickSalePrice: number;     // Price for fast sale
    firmPrice: boolean;         // Recommend firm or OBO?
  };
  
  // Condition mapping
  conditionTags: {
    standard: string;           // mint/near-mint/excellent/good/fair/poor
    ebay: string;               // eBay's condition system
    mercari: string;            // Mercari's condition system
    descriptive: string;        // Human-readable
  };
  
  // Category-specific extras
  categorySpecific: Record<string, any>;
  
  // Metadata
  generatedAt: string;
  confidence: number;
}

// ==================== KEYWORD EXTRACTION ====================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  pokemon_cards: [
    'pokemon', 'tcg', 'trading card', 'holo', 'holographic', 'rare', 
    'first edition', 'shadowless', 'psa', 'cgc', 'graded', 'mint',
    'vmax', 'vstar', 'gx', 'ex', 'full art', 'rainbow rare', 'secret rare',
    'vintage', 'base set', 'jungle', 'fossil', 'neo', 'gym', 'shining'
  ],
  coins: [
    'coin', 'silver', 'gold', 'rare', 'vintage', 'antique', 'collectible',
    'numismatic', 'mint', 'uncirculated', 'proof', 'ms', 'pcgs', 'ngc',
    'morgan', 'peace dollar', 'liberty', 'eagle', 'bullion', 'precious metal'
  ],
  lego: [
    'lego', 'legos', 'set', 'minifigure', 'minifig', 'retired', 'sealed',
    'nib', 'new in box', 'complete', 'rare', 'vintage', 'collectible',
    'star wars', 'technic', 'creator', 'modular', 'ucs', 'ideas'
  ],
  video_games: [
    'video game', 'game', 'gaming', 'console', 'retro', 'vintage', 'rare',
    'sealed', 'cib', 'complete', 'tested', 'working', 'ntsc', 'pal',
    'nintendo', 'playstation', 'xbox', 'sega', 'collector', 'graded'
  ],
  vinyl_records: [
    'vinyl', 'record', 'lp', 'album', 'first pressing', 'original', 'rare',
    'vintage', 'collectible', 'audiophile', 'mint', 'vg+', 'nm', 'sealed',
    '180g', '180 gram', 'gatefold', 'limited edition', 'numbered'
  ],
  sneakers: [
    'sneakers', 'shoes', 'kicks', 'deadstock', 'ds', 'vnds', 'og all',
    'nike', 'jordan', 'air jordan', 'yeezy', 'adidas', 'new balance',
    'dunk', 'retro', 'limited', 'exclusive', 'collab', 'rare'
  ],
  comics: [
    'comic', 'comic book', 'comics', 'vintage', 'rare', 'key issue',
    'first appearance', 'cgc', 'cbcs', 'graded', 'newsstand', 'direct',
    'marvel', 'dc', 'golden age', 'silver age', 'bronze age', 'modern'
  ],
  books: [
    'book', 'hardcover', 'paperback', 'first edition', 'signed', 'rare',
    'vintage', 'antique', 'collectible', 'dust jacket', 'illustrated',
    'limited edition', 'out of print', 'oop'
  ],
  general: [
    'vintage', 'antique', 'rare', 'collectible', 'estate', 'find',
    'unique', 'authentic', 'original', 'classic'
  ],
};

function extractKeywords(
  itemName: string,
  category: string,
  tags: string[] = [],
  valuationFactors: string[] = []
): string[] {
  const keywords = new Set<string>();
  
  // Add category-specific keywords that match the item
  const categoryKws = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.general;
  const nameLower = itemName.toLowerCase();
  
  categoryKws.forEach(kw => {
    if (nameLower.includes(kw.toLowerCase())) {
      keywords.add(kw);
    }
  });
  
  // Extract significant words from item name
  const nameWords = itemName
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .map(word => word.toLowerCase());
  
  nameWords.forEach(word => {
    if (!['the', 'and', 'for', 'with', 'from'].includes(word)) {
      keywords.add(word);
    }
  });
  
  // Add relevant tags
  tags.forEach(tag => {
    if (tag && tag.length > 2) {
      keywords.add(tag.toLowerCase());
    }
  });
  
  // Extract keywords from valuation factors
  valuationFactors.forEach(factor => {
    const words = factor.toLowerCase().match(/\b(mint|excellent|rare|vintage|antique|sealed|complete|original|authentic|limited)\b/g);
    if (words) {
      words.forEach(w => keywords.add(w));
    }
  });
  
  // Always add category as keyword
  keywords.add(category.replace(/_/g, ' '));
  
  return Array.from(keywords).slice(0, 15);
}

function generateHashtags(keywords: string[], category: string): string[] {
  const hashtags = new Set<string>();
  
  // Category-specific hashtags
  const categoryHashtags: Record<string, string[]> = {
    pokemon_cards: ['#Pokemon', '#PokemonTCG', '#PokemonCards', '#TCG', '#Pikachu', '#Charizard'],
    coins: ['#Coins', '#CoinCollecting', '#Numismatics', '#SilverCoins', '#RareCoins', '#CoinCollector'],
    lego: ['#LEGO', '#LEGOSets', '#LEGOCollector', '#Minifigures', '#AFOL', '#LEGOFan'],
    video_games: ['#VideoGames', '#RetroGaming', '#Gaming', '#Gamer', '#RetroGames', '#GameCollector'],
    vinyl_records: ['#Vinyl', '#VinylRecords', '#Records', '#VinylCollection', '#NowSpinning', '#VinylCommunity'],
    sneakers: ['#Sneakers', '#Kicks', '#Sneakerhead', '#SNKRS', '#Jordans', '#SneakerCollection'],
    comics: ['#Comics', '#ComicBooks', '#Marvel', '#DC', '#ComicCollector', '#KeyIssue'],
    books: ['#Books', '#RareBooks', '#BookCollector', '#FirstEdition', '#Bookstagram'],
    general: ['#Vintage', '#Antique', '#Collectibles', '#ThriftFind', '#EstateSale'],
  };
  
  // Add category hashtags
  (categoryHashtags[category] || categoryHashtags.general).forEach(h => hashtags.add(h));
  
  // Convert keywords to hashtags
  keywords.slice(0, 5).forEach(kw => {
    const hashtag = '#' + kw.replace(/\s+/g, '').replace(/[^\w]/g, '');
    if (hashtag.length > 2 && hashtag.length < 30) {
      hashtags.add(hashtag);
    }
  });
  
  // Universal resale hashtags
  ['#ForSale', '#Resale', '#ThriftFlip', '#Flipping'].forEach(h => hashtags.add(h));
  
  return Array.from(hashtags).slice(0, 15);
}

// ==================== TITLE GENERATION ====================

function generateTitles(
  itemName: string,
  category: string,
  condition: string,
  keywords: string[]
): GeneratedListing['title'] {
  
  // Clean up item name
  const cleanName = itemName
    .replace(/\s+/g, ' ')
    .trim();
  
  // Condition prefix
  const conditionPrefix = 
    condition === 'mint' ? '🔥 MINT' :
    condition === 'near-mint' ? '✨ Near Mint' :
    condition === 'excellent' ? 'Excellent' :
    condition === 'good' ? 'Good Condition' :
    condition === 'fair' ? 'Fair' : '';
  
  // Category-specific prefixes
  const categoryPrefix: Record<string, string> = {
    pokemon_cards: '🎴',
    coins: '🪙',
    lego: '🧱',
    video_games: '🎮',
    vinyl_records: '🎵',
    sneakers: '👟',
    comics: '📚',
    books: '📖',
    general: '✨',
  };
  
  const emoji = categoryPrefix[category] || '✨';
  
  // Find key selling points from keywords
  const sellingPoints = keywords
    .filter(kw => ['rare', 'vintage', 'sealed', 'mint', 'limited', 'first edition', 'complete'].includes(kw.toLowerCase()))
    .slice(0, 2);
  
  // Short title (40 chars) - FB Marketplace, Craigslist
  let shortTitle = cleanName;
  if (shortTitle.length > 37) {
    shortTitle = shortTitle.substring(0, 37) + '...';
  }
  
  // Medium title (80 chars) - eBay, Mercari
  let mediumTitle = `${emoji} ${cleanName}`;
  if (conditionPrefix && mediumTitle.length < 60) {
    mediumTitle = `${emoji} ${conditionPrefix} ${cleanName}`;
  }
  if (mediumTitle.length > 77) {
    mediumTitle = mediumTitle.substring(0, 77) + '...';
  }
  
  // Long title (120 chars) - Full SEO
  let longTitle = `${emoji} ${conditionPrefix} ${cleanName}`;
  if (sellingPoints.length > 0 && longTitle.length < 100) {
    longTitle += ` - ${sellingPoints.join(' ')}`;
  }
  if (longTitle.length > 117) {
    longTitle = longTitle.substring(0, 117) + '...';
  }
  
  return {
    short: shortTitle.trim(),
    medium: mediumTitle.trim(),
    long: longTitle.trim(),
  };
}

// ==================== DESCRIPTION GENERATION ====================

function generateDescriptions(
  itemName: string,
  category: string,
  condition: string,
  estimatedValue: number,
  valuationFactors: string[],
  keywords: string[],
  marketComps: AnalysisInput['marketComps']
): GeneratedListing['description'] {
  
  // Condition description
  const conditionDescriptions: Record<string, string> = {
    mint: 'Item is in mint/perfect condition with no visible flaws.',
    'near-mint': 'Near mint condition with minimal signs of handling.',
    excellent: 'Excellent condition with only minor wear.',
    good: 'Good overall condition with normal wear consistent with age/use.',
    fair: 'Fair condition - shows wear but fully functional.',
    poor: 'Shows significant wear. Priced accordingly.',
  };
  
  const conditionDesc = conditionDescriptions[condition] || conditionDescriptions.good;
  
  // Extract relevant factors (filter out AI-related language)
  const relevantFactors = valuationFactors
    .filter(f => !f.toLowerCase().includes('ai') && !f.toLowerCase().includes('algorithm'))
    .slice(0, 4);
  
  // Short description (150 chars) - Social previews
  const shortDesc = `${itemName} - ${conditionDesc.split('.')[0]}. Ships fast! 📦`;
  
  // Medium description (500 chars) - FB/Craigslist
  let mediumDesc = `${itemName}\n\n`;
  mediumDesc += `📦 Condition: ${condition.charAt(0).toUpperCase() + condition.slice(1)}\n`;
  mediumDesc += `${conditionDesc}\n\n`;
  mediumDesc += `✅ What you get:\n`;
  mediumDesc += `• Exactly what's pictured\n`;
  mediumDesc += `• Fast shipping with tracking\n`;
  mediumDesc += `• Secure packaging\n\n`;
  mediumDesc += `💬 Message me with any questions!\n`;
  mediumDesc += `⭐ Check my other listings!`;
  
  // Full description (2000 chars) - eBay/Mercari
  let fullDesc = `🔥 ${itemName} 🔥\n\n`;
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `📦 CONDITION\n`;
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `${condition.toUpperCase()}: ${conditionDesc}\n\n`;
  
  if (relevantFactors.length > 0) {
    fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fullDesc += `✨ HIGHLIGHTS\n`;
    fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    relevantFactors.forEach(factor => {
      fullDesc += `• ${factor}\n`;
    });
    fullDesc += `\n`;
  }
  
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `📬 SHIPPING & HANDLING\n`;
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `• Ships within 1-2 business days\n`;
  fullDesc += `• Tracking provided on all orders\n`;
  fullDesc += `• Carefully packaged to arrive safely\n`;
  fullDesc += `• Combined shipping available on multiple items\n\n`;
  
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `💳 PAYMENT & RETURNS\n`;
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `• Secure payment through platform\n`;
  fullDesc += `• Item as described or money back\n`;
  fullDesc += `• Please review photos carefully\n\n`;
  
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `💬 QUESTIONS?\n`;
  fullDesc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  fullDesc += `Feel free to message me with any questions before purchasing!\n\n`;
  
  // Add keywords naturally at the end for SEO
  fullDesc += `Tags: ${keywords.slice(0, 8).join(', ')}\n`;
  
  return {
    short: shortDesc.substring(0, 150),
    medium: mediumDesc.substring(0, 500),
    full: fullDesc.substring(0, 2000),
  };
}

// ==================== CONDITION MAPPING ====================

function mapCondition(condition: string): GeneratedListing['conditionTags'] {
  const conditionMap: Record<string, GeneratedListing['conditionTags']> = {
    mint: {
      standard: 'mint',
      ebay: 'Brand New',
      mercari: 'New',
      descriptive: 'Mint/Perfect condition - like new',
    },
    'near-mint': {
      standard: 'near-mint',
      ebay: 'Like New',
      mercari: 'Like new',
      descriptive: 'Near mint - minimal wear',
    },
    excellent: {
      standard: 'excellent',
      ebay: 'Very Good',
      mercari: 'Good',
      descriptive: 'Excellent condition - light wear only',
    },
    good: {
      standard: 'good',
      ebay: 'Good',
      mercari: 'Good',
      descriptive: 'Good condition - normal wear',
    },
    fair: {
      standard: 'fair',
      ebay: 'Acceptable',
      mercari: 'Fair',
      descriptive: 'Fair condition - shows wear',
    },
    poor: {
      standard: 'poor',
      ebay: 'For parts or not working',
      mercari: 'Poor',
      descriptive: 'Poor condition - significant wear',
    },
  };
  
  return conditionMap[condition] || conditionMap.good;
}

// ==================== PRICING SUGGESTIONS ====================

function generatePricing(
  estimatedValue: number,
  condition: string,
  category: string
): GeneratedListing['pricing'] {
  
  // Condition multipliers
  const conditionMultipliers: Record<string, number> = {
    mint: 1.15,
    'near-mint': 1.05,
    excellent: 1.0,
    good: 0.9,
    fair: 0.75,
    poor: 0.5,
  };
  
  const conditionMult = conditionMultipliers[condition] || 1.0;
  
  // Category-specific pricing strategies
  const categoryStrategy: Record<string, { premiumOk: boolean; firmRecommended: boolean }> = {
    pokemon_cards: { premiumOk: true, firmRecommended: false },
    coins: { premiumOk: true, firmRecommended: true },
    lego: { premiumOk: true, firmRecommended: false },
    sneakers: { premiumOk: true, firmRecommended: false },
    video_games: { premiumOk: false, firmRecommended: false },
    vinyl_records: { premiumOk: true, firmRecommended: false },
    general: { premiumOk: false, firmRecommended: false },
  };
  
  const strategy = categoryStrategy[category] || categoryStrategy.general;
  
  // Calculate prices
  const adjustedValue = estimatedValue * conditionMult;
  
  // List price: slightly above market to allow negotiation
  const listPrice = Math.round(adjustedValue * 1.10 * 100) / 100;
  
  // Minimum acceptable: don't go below 85% of value
  const minimumAccept = Math.round(adjustedValue * 0.85 * 100) / 100;
  
  // Quick sale: 10-15% below market for fast flip
  const quickSalePrice = Math.round(adjustedValue * 0.88 * 100) / 100;
  
  return {
    listPrice,
    minimumAccept,
    quickSalePrice,
    firmPrice: strategy.firmRecommended,
  };
}

// ==================== MAIN GENERATOR FUNCTION ====================

export function generateListing(input: AnalysisInput): GeneratedListing {
  const {
    itemName,
    category,
    estimatedValue,
    condition = 'good',
    valuation_factors = [],
    tags = [],
    marketComps = [],
  } = input;
  
  // Extract keywords
  const keywords = extractKeywords(itemName, category, tags, valuation_factors);
  
  // Generate hashtags
  const hashtags = generateHashtags(keywords, category);
  
  // Generate search terms (what buyers actually search)
  const searchTerms = keywords.slice(0, 5).map(kw => {
    // Add common buyer search patterns
    return kw;
  });
  
  // Generate titles
  const titles = generateTitles(itemName, category, condition, keywords);
  
  // Generate descriptions
  const descriptions = generateDescriptions(
    itemName,
    category,
    condition,
    estimatedValue,
    valuation_factors,
    keywords,
    marketComps
  );
  
  // Map condition
  const conditionTags = mapCondition(condition);
  
  // Generate pricing
  const pricing = generatePricing(estimatedValue, condition, category);
  
  // Category-specific extras
  const categorySpecific: Record<string, any> = {};
  
  if (category === 'pokemon_cards') {
    categorySpecific.tcgCategory = 'Pokemon';
    categorySpecific.suggestGrading = estimatedValue > 50;
  } else if (category === 'coins') {
    categorySpecific.suggestGrading = estimatedValue > 100;
    categorySpecific.includeCertNumber = true;
  } else if (category === 'lego') {
    categorySpecific.includeSetNumber = true;
    categorySpecific.includePieceCount = true;
  } else if (category === 'sneakers') {
    categorySpecific.includeSize = true;
    categorySpecific.includeSKU = true;
  }
  
  return {
    title: titles,
    description: descriptions,
    keywords,
    hashtags,
    searchTerms,
    pricing,
    conditionTags,
    categorySpecific,
    generatedAt: new Date().toISOString(),
    confidence: 0.85,
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const input = req.body as AnalysisInput;
    
    // Validation
    if (!input.itemName || typeof input.itemName !== 'string') {
      return res.status(400).json({ error: 'itemName is required' });
    }
    
    if (typeof input.estimatedValue !== 'number' || input.estimatedValue <= 0) {
      return res.status(400).json({ error: 'estimatedValue must be a positive number' });
    }
    
    const listing = generateListing(input);
    
    return res.status(200).json(listing);
    
  } catch (error: any) {
    console.error('Listing generator error:', error);
    return res.status(500).json({
      error: 'Failed to generate listing',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}