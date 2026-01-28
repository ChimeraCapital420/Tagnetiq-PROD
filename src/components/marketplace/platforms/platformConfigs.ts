// FILE: src/components/marketplace/platforms/platformConfigs.ts
// All platform configurations - organized by category

import { Globe, Store, ShoppingBag, Camera, Music, Gamepad2, Watch, Gem, Shirt, Car, Palette } from 'lucide-react';
import type { PlatformConfig, PlatformCategoryConfig, MarketplaceItem, FormattedListing } from './types';
import { getCondition } from './conditionMaps';

// =============================================================================
// PLATFORM CATEGORIES
// =============================================================================

export const PLATFORM_CATEGORIES: PlatformCategoryConfig[] = [
  { id: 'general', label: 'General Marketplaces', icon: Store },
  { id: 'cards', label: 'Trading Cards & Sports', icon: Gamepad2 },
  { id: 'fashion', label: 'Fashion & Streetwear', icon: Shirt },
  { id: 'music', label: 'Music & Audio', icon: Music },
  { id: 'luxury', label: 'Luxury & Antiques', icon: Gem },
  { id: 'specialty', label: 'Specialty', icon: Globe },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const formatPrice = (price: number, decimals: number = 2): string => {
  return price.toFixed(decimals);
};

const truncate = (text: string, limit: number): string => {
  return text.slice(0, limit);
};

// =============================================================================
// GENERAL MARKETPLACES
// =============================================================================

const generalPlatforms: PlatformConfig[] = [
  {
    id: 'ebay',
    name: 'eBay',
    icon: Globe,
    color: 'text-blue-400',
    bgColor: 'bg-[#0064D2]',
    listingUrl: 'https://www.ebay.com/sl/sell',
    titleLimit: 80,
    descriptionLimit: 4000,
    category: 'general',
    bestFor: ['All collectibles', 'Auctions', 'Global reach'],
    formatter: (item, customDesc) => {
      const condition = getCondition('ebay', item.condition);
      const title = truncate(item.item_name, 80);
      const description = `${customDesc || item.description || ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 ITEM DETAILS
${item.brand ? `• Brand: ${item.brand}` : ''}
${item.model ? `• Model: ${item.model}` : ''}
${item.year ? `• Year: ${item.year}` : ''}
${item.condition ? `• Condition: ${condition}` : ''}
${item.is_verified ? '\n✅ Authenticity Verified' : ''}

• Returns accepted within 30 days
Questions? Message me!`.trim();
      return { title, description, price: formatPrice(item.asking_price), condition };
    },
  },
  {
    id: 'facebook',
    name: 'Facebook Marketplace',
    icon: Globe,
    color: 'text-blue-500',
    bgColor: 'bg-[#1877F2]',
    listingUrl: 'https://www.facebook.com/marketplace/create/item',
    titleLimit: 99,
    descriptionLimit: 1000,
    category: 'general',
    bestFor: ['Local sales', 'No fees', 'Quick turnover'],
    formatter: (item, customDesc) => {
      const condition = getCondition('facebook', item.condition);
      const title = truncate(item.item_name, 99);
      const description = `${customDesc || item.description || ''}

📍 Local pickup available
💵 Price firm / OBO
${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${condition}` : ''}
${item.is_verified ? '\n✅ Verified authentic' : ''}`.trim();
      return { title, description: truncate(description, 1000), price: formatPrice(item.asking_price, 0), condition };
    },
  },
  {
    id: 'mercari',
    name: 'Mercari',
    icon: ShoppingBag,
    color: 'text-red-500',
    bgColor: 'bg-[#FF0211]',
    listingUrl: 'https://www.mercari.com/sell/',
    titleLimit: 40,
    descriptionLimit: 1000,
    category: 'general',
    bestFor: ['Easy shipping', 'Mobile users', 'Quick sales'],
    formatter: (item, customDesc) => {
      const condition = getCondition('mercari', item.condition);
      const title = truncate(item.item_name, 40);
      const description = `${customDesc || item.description || ''}

Condition: ${condition}
${item.brand ? `Brand: ${item.brand}` : ''}
${item.is_verified ? '✅ Authenticity verified' : ''}

Ships within 3 days • Smoke-free home`.trim();
      return { title, description: truncate(description, 1000), price: formatPrice(item.asking_price, 0), condition };
    },
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    icon: Globe,
    color: 'text-purple-400',
    bgColor: 'bg-[#5A3E85]',
    listingUrl: 'https://post.craigslist.org/',
    titleLimit: 70,
    descriptionLimit: 10000,
    category: 'general',
    bestFor: ['Local only', 'No fees', 'Cash sales'],
    formatter: (item, customDesc) => {
      const title = truncate(`${item.item_name} - $${item.asking_price}`, 70);
      const description = `${customDesc || item.description || ''}

DETAILS:
${item.brand ? `- Brand: ${item.brand}` : ''}
${item.condition ? `- Condition: ${item.condition}` : ''}
${item.is_verified ? 'Item verified for authenticity.' : ''}

PRICE: $${item.asking_price} CASH
Local pickup only. Serious buyers please.`.trim();
      return { title, description, price: formatPrice(item.asking_price, 0) };
    },
  },
  {
    id: 'offerup',
    name: 'OfferUp',
    icon: Store,
    color: 'text-teal-400',
    bgColor: 'bg-[#00AB80]',
    listingUrl: 'https://offerup.com/post',
    titleLimit: 50,
    descriptionLimit: 2000,
    category: 'general',
    bestFor: ['Local + shipping', 'TruYou verified', 'Mobile app'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 50);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
💰 Price: $${item.asking_price}
📦 Can ship or meet locally
${item.is_verified ? '✔ Verified item' : ''}

Message with questions!`.trim();
      return { title, description: truncate(description, 2000), price: formatPrice(item.asking_price, 0) };
    },
  },
  {
    id: 'bonanza',
    name: 'Bonanza',
    icon: Store,
    color: 'text-green-500',
    bgColor: 'bg-[#2D8B61]',
    listingUrl: 'https://www.bonanza.com/sell',
    titleLimit: 140,
    descriptionLimit: 10000,
    category: 'general',
    bestFor: ['eBay alternative', 'Lower fees', 'Collectibles'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 140);
      const description = `${customDesc || item.description || ''}

ITEM DETAILS:
${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.estimated_value ? `Market Value: $${item.estimated_value}` : ''}
${item.is_verified ? '✅ Verified' : ''}

Fast shipping • Secure packaging`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
];

// =============================================================================
// TRADING CARDS & SPORTS
// =============================================================================

const cardsPlatforms: PlatformConfig[] = [
  {
    id: 'tcgplayer',
    name: 'TCGplayer',
    icon: Gamepad2,
    color: 'text-orange-400',
    bgColor: 'bg-[#F5A623]',
    listingUrl: 'https://store.tcgplayer.com/sell',
    titleLimit: 200,
    descriptionLimit: 2000,
    category: 'cards',
    bestFor: ['Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh!'],
    formatter: (item, customDesc) => {
      const condition = getCondition('tcgplayer', item.condition);
      const title = truncate(item.item_name, 200);
      const description = `${customDesc || item.description || ''}

Card Condition: ${condition}
${item.year ? `Year: ${item.year}` : ''}
${item.is_verified ? '✅ Verified authentic' : ''}

Ships in toploader + bubble mailer`.trim();
      return { title, description, price: formatPrice(item.asking_price), condition };
    },
  },
  {
    id: 'comc',
    name: 'COMC',
    icon: Gamepad2,
    color: 'text-blue-600',
    bgColor: 'bg-[#003366]',
    listingUrl: 'https://www.comc.com/Sell',
    titleLimit: 100,
    descriptionLimit: 500,
    category: 'cards',
    bestFor: ['Sports cards', 'Graded cards', 'Consignment'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.year ? `Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Verified' : ''}`.trim();
      return { title, description: truncate(description, 500), price: formatPrice(item.asking_price) };
    },
  },
  {
    id: 'sportslots',
    name: 'SportLots',
    icon: Gamepad2,
    color: 'text-green-600',
    bgColor: 'bg-[#006600]',
    listingUrl: 'https://www.sportlots.com/sell',
    titleLimit: 100,
    descriptionLimit: 1000,
    category: 'cards',
    bestFor: ['Bulk sports cards', 'Set builders', 'Vintage cards'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.year ? `Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}`.trim();
      return { title, description: truncate(description, 1000), price: formatPrice(item.asking_price) };
    },
  },
];

// =============================================================================
// FASHION & STREETWEAR
// =============================================================================

const fashionPlatforms: PlatformConfig[] = [
  {
    id: 'poshmark',
    name: 'Poshmark',
    icon: Shirt,
    color: 'text-red-400',
    bgColor: 'bg-[#7F0353]',
    listingUrl: 'https://poshmark.com/create-listing',
    titleLimit: 80,
    descriptionLimit: 1500,
    category: 'fashion',
    bestFor: ['Designer fashion', 'Women\'s clothing', 'Accessories'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 80);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
${item.color ? `Color: ${item.color}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? '✨ Authenticity verified' : ''}

Bundle to save! 💕`.trim();
      return { title, description: truncate(description, 1500), price: formatPrice(item.asking_price, 0) };
    },
  },
  {
    id: 'depop',
    name: 'Depop',
    icon: Shirt,
    color: 'text-red-500',
    bgColor: 'bg-[#FF2300]',
    listingUrl: 'https://www.depop.com/sell/',
    titleLimit: 100,
    descriptionLimit: 1000,
    category: 'fashion',
    bestFor: ['Vintage fashion', 'Streetwear', 'Y2K trends'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

#vintage #streetwear #${item.brand?.toLowerCase().replace(/\s+/g, '') || 'fashion'}`.trim();
      return { title, description: truncate(description, 1000), price: formatPrice(item.asking_price, 0) };
    },
  },
  {
    id: 'grailed',
    name: 'Grailed',
    icon: Shirt,
    color: 'text-gray-300',
    bgColor: 'bg-[#000000]',
    listingUrl: 'https://www.grailed.com/sell',
    titleLimit: 100,
    descriptionLimit: 2000,
    category: 'fashion',
    bestFor: ['Designer menswear', 'Streetwear', 'Luxury fashion'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Authenticity guaranteed' : ''}

No trades. Price firm.`.trim();
      return { title, description: truncate(description, 2000), price: formatPrice(item.asking_price, 0) };
    },
  },
  {
    id: 'stockx',
    name: 'StockX',
    icon: Shirt,
    color: 'text-green-400',
    bgColor: 'bg-[#006340]',
    listingUrl: 'https://stockx.com/sell',
    titleLimit: 100,
    descriptionLimit: 500,
    category: 'fashion',
    bestFor: ['Sneakers', 'Streetwear', 'Verified authentic'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
Condition: New/Deadstock`.trim();
      return { title, description: truncate(description, 500), price: formatPrice(item.asking_price, 0) };
    },
  },
];

// =============================================================================
// MUSIC & AUDIO
// =============================================================================

const musicPlatforms: PlatformConfig[] = [
  {
    id: 'discogs',
    name: 'Discogs',
    icon: Music,
    color: 'text-orange-400',
    bgColor: 'bg-[#333333]',
    listingUrl: 'https://www.discogs.com/sell/list',
    titleLimit: 200,
    descriptionLimit: 2000,
    category: 'music',
    bestFor: ['Vinyl records', 'CDs', 'Music collectibles'],
    formatter: (item, customDesc) => {
      const condition = getCondition('discogs', item.condition);
      const title = truncate(item.item_name, 200);
      const description = `${customDesc || item.description || ''}

Media Condition: ${condition}
Sleeve Condition: ${condition}
${item.year ? `Year: ${item.year}` : ''}

Ships in protective mailer`.trim();
      return { title, description, price: formatPrice(item.asking_price), condition };
    },
  },
  {
    id: 'reverb',
    name: 'Reverb',
    icon: Music,
    color: 'text-orange-500',
    bgColor: 'bg-[#F15A22]',
    listingUrl: 'https://reverb.com/sell',
    titleLimit: 100,
    descriptionLimit: 5000,
    category: 'music',
    bestFor: ['Musical instruments', 'Audio gear', 'Vintage equipment'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.model ? `Model: ${item.model}` : ''}
${item.year ? `Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? '✅ Verified' : ''}

Ships safely in padded case`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
];

// =============================================================================
// LUXURY & ANTIQUES
// =============================================================================

const luxuryPlatforms: PlatformConfig[] = [
  {
    id: '1stdibs',
    name: '1stDibs',
    icon: Gem,
    color: 'text-amber-400',
    bgColor: 'bg-[#1A1A1A]',
    listingUrl: 'https://www.1stdibs.com/dealers/apply/',
    titleLimit: 200,
    descriptionLimit: 5000,
    category: 'luxury',
    bestFor: ['Antiques', 'Fine art', 'Luxury furniture'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 200);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Maker/Designer: ${item.brand}` : ''}
${item.year ? `Period/Year: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.material ? `Materials: ${item.material}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Provenance verified' : ''}`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
  {
    id: 'chairish',
    name: 'Chairish',
    icon: Gem,
    color: 'text-pink-400',
    bgColor: 'bg-[#FF6B81]',
    listingUrl: 'https://www.chairish.com/sell',
    titleLimit: 100,
    descriptionLimit: 2000,
    category: 'luxury',
    bestFor: ['Vintage furniture', 'Home decor', 'Art'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand/Designer: ${item.brand}` : ''}
${item.year ? `Era: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}`.trim();
      return { title, description: truncate(description, 2000), price: formatPrice(item.asking_price) };
    },
  },
  {
    id: 'rubylane',
    name: 'Ruby Lane',
    icon: Gem,
    color: 'text-red-400',
    bgColor: 'bg-[#8B0000]',
    listingUrl: 'https://www.rubylane.com/sell',
    titleLimit: 100,
    descriptionLimit: 3000,
    category: 'luxury',
    bestFor: ['Antiques', 'Vintage jewelry', 'Collectibles'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Maker: ${item.brand}` : ''}
${item.year ? `Age/Period: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Authenticated' : ''}`.trim();
      return { title, description: truncate(description, 3000), price: formatPrice(item.asking_price) };
    },
  },
];

// =============================================================================
// SPECIALTY
// =============================================================================

const specialtyPlatforms: PlatformConfig[] = [
  {
    id: 'etsy',
    name: 'Etsy',
    icon: Palette,
    color: 'text-orange-500',
    bgColor: 'bg-[#F56400]',
    listingUrl: 'https://www.etsy.com/your/shops/me/tools/listings/create',
    titleLimit: 140,
    descriptionLimit: 10000,
    category: 'specialty',
    bestFor: ['Vintage items', 'Handmade', 'Craft supplies'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 140);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand/Maker: ${item.brand}` : ''}
${item.year ? `Year/Era: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.material ? `Materials: ${item.material}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

✨ Thank you for visiting my shop!`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
  {
    id: 'ebid',
    name: 'eBid',
    icon: Globe,
    color: 'text-blue-400',
    bgColor: 'bg-[#0066CC]',
    listingUrl: 'https://www.ebid.net/us/sell/',
    titleLimit: 80,
    descriptionLimit: 5000,
    category: 'specialty',
    bestFor: ['Low fees', 'eBay alternative', 'All categories'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 80);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? '✅ Verified' : ''}`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
  {
    id: 'hibid',
    name: 'HiBid',
    icon: Globe,
    color: 'text-green-500',
    bgColor: 'bg-[#228B22]',
    listingUrl: 'https://www.hibid.com/',
    titleLimit: 100,
    descriptionLimit: 2000,
    category: 'specialty',
    bestFor: ['Auctions', 'Estate sales', 'Antiques'],
    formatter: (item, customDesc) => {
      const title = truncate(item.item_name, 100);
      const description = `${customDesc || item.description || ''}

${item.brand ? `Brand/Maker: ${item.brand}` : ''}
${item.year ? `Age/Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Authenticated item' : ''}`.trim();
      return { title, description, price: formatPrice(item.asking_price) };
    },
  },
];

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const PLATFORMS: PlatformConfig[] = [
  ...generalPlatforms,
  ...cardsPlatforms,
  ...fashionPlatforms,
  ...musicPlatforms,
  ...luxuryPlatforms,
  ...specialtyPlatforms,
];

export const getPlatformsByCategory = (category: string): PlatformConfig[] => {
  return PLATFORMS.filter(p => p.category === category);
};

export const getPlatformById = (id: string): PlatformConfig | undefined => {
  return PLATFORMS.find(p => p.id === id);
};