// FILE: src/components/marketplace/ExportListingModal.tsx
// Multi-platform listing export with auto-formatting for each marketplace
// 20+ platforms organized by category
// User copies formatted text and posts themselves - no API integrations needed

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Copy, ExternalLink, ChevronRight, ChevronDown,
  Store, Globe, ShoppingBag, Camera, DollarSign,
  Package, Tag, FileText, Sparkles, CheckCircle2,
  ArrowRight, Loader2, Image as ImageIcon, Music,
  Gamepad2, Watch, Gem, Shirt, Car, Palette
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// =============================================================================
// TYPES
// =============================================================================

interface MarketplaceItem {
  id: string;
  challenge_id?: string;
  item_name: string;
  asking_price: number;
  estimated_value?: number;
  primary_photo_url?: string;
  additional_photos?: string[];
  is_verified?: boolean;
  confidence_score?: number;
  category?: string;
  condition?: string;
  description?: string;
  brand?: string;
  model?: string;
  year?: string;
  dimensions?: string;
  weight?: string;
  color?: string;
  material?: string;
  authenticity_details?: string;
}

interface ExportListingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MarketplaceItem;
  onListOnTagnetiq?: (item: MarketplaceItem, price: number, description: string) => Promise<void>;
}

interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  listingUrl: string;
  titleLimit: number;
  descriptionLimit: number;
  category: 'general' | 'cards' | 'fashion' | 'music' | 'luxury' | 'specialty';
  bestFor: string[];
  formatter: (item: MarketplaceItem, customDesc: string) => FormattedListing;
}

interface FormattedListing {
  title: string;
  description: string;
  price: string;
  condition?: string;
  category?: string;
  shipping?: string;
  extras?: Record<string, string>;
}

// =============================================================================
// CONDITION MAPPINGS
// =============================================================================

const CONDITION_MAP: Record<string, Record<string, string>> = {
  ebay: {
    'mint': 'New', 'near_mint': 'New', 'excellent': 'Like New',
    'good': 'Very Good', 'fair': 'Good', 'poor': 'Acceptable',
  },
  facebook: {
    'mint': 'New', 'near_mint': 'Like new', 'excellent': 'Good',
    'good': 'Good', 'fair': 'Fair', 'poor': 'Fair',
  },
  mercari: {
    'mint': 'Brand New', 'near_mint': 'Like New', 'excellent': 'Good',
    'good': 'Good', 'fair': 'Fair', 'poor': 'Poor',
  },
  tcgplayer: {
    'mint': 'Near Mint', 'near_mint': 'Near Mint', 'excellent': 'Lightly Played',
    'good': 'Moderately Played', 'fair': 'Heavily Played', 'poor': 'Damaged',
  },
  discogs: {
    'mint': 'Mint (M)', 'near_mint': 'Near Mint (NM)', 'excellent': 'Very Good Plus (VG+)',
    'good': 'Very Good (VG)', 'fair': 'Good (G)', 'poor': 'Fair (F)',
  },
  default: {
    'mint': 'Mint', 'near_mint': 'Near Mint', 'excellent': 'Excellent',
    'good': 'Good', 'fair': 'Fair', 'poor': 'Poor',
  },
};

// =============================================================================
// PLATFORM CONFIGURATIONS - 20+ PLATFORMS
// =============================================================================

const PLATFORMS: PlatformConfig[] = [
  // =========================================================================
  // GENERAL MARKETPLACES
  // =========================================================================
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
      const condition = CONDITION_MAP.ebay[item.condition?.toLowerCase() || ''] || 'Used';
      const title = item.item_name.slice(0, 80);
      let description = `${customDesc || item.description || ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 ITEM DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${item.brand ? `• Brand: ${item.brand}` : ''}
${item.model ? `• Model: ${item.model}` : ''}
${item.year ? `• Year: ${item.year}` : ''}
${item.color ? `• Color: ${item.color}` : ''}
${item.dimensions ? `• Dimensions: ${item.dimensions}` : ''}
• Condition: ${condition}

${item.is_verified ? `✅ VERIFIED by HYDRA AI (${Math.round((item.confidence_score || 0.9) * 100)}% confidence)` : ''}
${item.estimated_value ? `💰 Market Value: $${item.estimated_value.toLocaleString()}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SHIPPING & RETURNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Ships within 1-2 business days
• Carefully packaged for safe delivery
• Returns accepted within 30 days

Questions? Message me!`.trim();
      return { title, description, price: item.asking_price.toFixed(2), condition };
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
      const condition = CONDITION_MAP.facebook[item.condition?.toLowerCase() || ''] || 'Good';
      const title = item.item_name.slice(0, 99);
      let description = `${customDesc || item.description || ''}

📍 Local pickup available
💵 Price firm / OBO
📱 Message for details

${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${condition}` : ''}
${item.is_verified ? '\n✅ Verified authentic' : ''}`.trim();
      return { title, description: description.slice(0, 1000), price: item.asking_price.toFixed(0), condition };
    },
  },
  {
    id: 'mercari',
    name: 'Mercari',
    icon: ShoppingBag,
    color: 'text-red-400',
    bgColor: 'bg-[#FF0211]',
    listingUrl: 'https://www.mercari.com/sell/',
    titleLimit: 40,
    descriptionLimit: 1000,
    category: 'general',
    bestFor: ['Easy shipping', 'Mobile users', 'Quick sales'],
    formatter: (item, customDesc) => {
      const condition = CONDITION_MAP.mercari[item.condition?.toLowerCase() || ''] || 'Good';
      const title = item.item_name.slice(0, 40);
      let description = `${customDesc || item.description || ''}

Condition: ${condition}
${item.brand ? `Brand: ${item.brand}` : ''}
${item.is_verified ? '✅ Authenticity verified' : ''}

Ships within 3 days • Smoke-free home`.trim();
      return { title, description: description.slice(0, 1000), price: item.asking_price.toFixed(0), condition };
    },
  },
  {
    id: 'craigslist',
    name: 'Craigslist',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-[#5A3E85]',
    listingUrl: 'https://post.craigslist.org/',
    titleLimit: 70,
    descriptionLimit: 10000,
    category: 'general',
    bestFor: ['Local only', 'No fees', 'Cash sales'],
    formatter: (item, customDesc) => {
      const title = `${item.item_name} - $${item.asking_price}`.slice(0, 70);
      let description = `${customDesc || item.description || ''}

DETAILS:
${item.brand ? `- Brand: ${item.brand}` : ''}
${item.condition ? `- Condition: ${item.condition}` : ''}

PRICE: $${item.asking_price} CASH

${item.is_verified ? 'Item verified for authenticity.' : ''}

Local pickup only. Serious buyers please.`.trim();
      return { title, description, price: item.asking_price.toFixed(0) };
    },
  },
  {
    id: 'offerup',
    name: 'OfferUp',
    icon: Tag,
    color: 'text-green-400',
    bgColor: 'bg-[#00AB80]',
    listingUrl: 'https://offerup.com/post',
    titleLimit: 50,
    descriptionLimit: 2000,
    category: 'general',
    bestFor: ['Local + shipping', 'TruYou verified', 'Mobile app'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 50);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

💰 Price: $${item.asking_price}
📦 Can ship or meet locally
${item.is_verified ? '✓ Verified item' : ''}

Message with questions!`.trim();
      return { title, description: description.slice(0, 2000), price: item.asking_price.toFixed(0) };
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
      const title = item.item_name.slice(0, 140);
      let description = `${customDesc || item.description || ''}

ITEM DETAILS:
${item.brand ? `Brand: ${item.brand}` : ''}
${item.model ? `Model: ${item.model}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

${item.is_verified ? '✅ Verified by HYDRA AI' : ''}
${item.estimated_value ? `Market Value: $${item.estimated_value}` : ''}

Fast shipping • Secure packaging`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },

  // =========================================================================
  // TRADING CARDS & SPORTS CARDS
  // =========================================================================
  {
    id: 'tcgplayer',
    name: 'TCGPlayer',
    icon: Gamepad2,
    color: 'text-orange-400',
    bgColor: 'bg-[#F5A623]',
    listingUrl: 'https://store.tcgplayer.com/sell',
    titleLimit: 200,
    descriptionLimit: 2000,
    category: 'cards',
    bestFor: ['Pokemon', 'Magic: The Gathering', 'Yu-Gi-Oh!'],
    formatter: (item, customDesc) => {
      const condition = CONDITION_MAP.tcgplayer[item.condition?.toLowerCase() || ''] || 'Near Mint';
      const title = item.item_name.slice(0, 200);
      let description = `${customDesc || item.description || ''}

Card Condition: ${condition}
${item.year ? `Year: ${item.year}` : ''}

${item.is_verified ? '✅ Verified authentic' : ''}
Ships in toploader + bubble mailer`.trim();
      return { title, description, price: item.asking_price.toFixed(2), condition };
    },
  },
  {
    id: 'comc',
    name: 'COMC',
    icon: Package,
    color: 'text-blue-500',
    bgColor: 'bg-[#003366]',
    listingUrl: 'https://www.comc.com/Sell',
    titleLimit: 100,
    descriptionLimit: 500,
    category: 'cards',
    bestFor: ['Sports cards', 'Graded cards', 'Consignment'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

${item.year ? `Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}
${item.is_verified ? 'Verified' : ''}`.trim();
      return { title, description: description.slice(0, 500), price: item.asking_price.toFixed(2) };
    },
  },
  {
    id: 'whatnot',
    name: 'Whatnot',
    icon: Camera,
    color: 'text-purple-400',
    bgColor: 'bg-[#7C3AED]',
    listingUrl: 'https://www.whatnot.com/sell',
    titleLimit: 80,
    descriptionLimit: 1000,
    category: 'cards',
    bestFor: ['Live auctions', 'Trading cards', 'Funko Pops'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 80);
      let description = `${customDesc || item.description || ''}

🔥 ${item.condition || 'Great'} Condition
${item.brand ? `Brand: ${item.brand}` : ''}
${item.is_verified ? '✅ Verified' : ''}

Ships fast! Follow for more deals!`.trim();
      return { title, description: description.slice(0, 1000), price: item.asking_price.toFixed(2) };
    },
  },
  {
    id: 'sportslots',
    name: 'SportLots',
    icon: Package,
    color: 'text-red-500',
    bgColor: 'bg-[#CC0000]',
    listingUrl: 'https://www.sportlots.com/inven/delsell.tpl',
    titleLimit: 100,
    descriptionLimit: 1000,
    category: 'cards',
    bestFor: ['Sports cards', 'Bulk lots', 'Low fees'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

${item.year ? `Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },

  // =========================================================================
  // FASHION & STREETWEAR
  // =========================================================================
  {
    id: 'poshmark',
    name: 'Poshmark',
    icon: Shirt,
    color: 'text-pink-400',
    bgColor: 'bg-[#C10058]',
    listingUrl: 'https://poshmark.com/create-listing',
    titleLimit: 80,
    descriptionLimit: 1500,
    category: 'fashion',
    bestFor: ['Fashion', 'Designer items', 'Social selling'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 80);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.color ? `Color: ${item.color}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
Condition: ${item.condition || 'Good'}

${item.is_verified ? '✨ Authenticity verified' : ''}
Bundle to save! 💕`.trim();
      return { title, description: description.slice(0, 1500), price: item.asking_price.toFixed(0) };
    },
  },
  {
    id: 'depop',
    name: 'Depop',
    icon: Shirt,
    color: 'text-red-400',
    bgColor: 'bg-[#FF2300]',
    listingUrl: 'https://www.depop.com/sell/',
    titleLimit: 80,
    descriptionLimit: 1000,
    category: 'fashion',
    bestFor: ['Vintage', 'Streetwear', 'Gen Z audience'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 80);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.color ? `Color: ${item.color}` : ''}
${item.dimensions ? `Size: ${item.dimensions}` : ''}
Condition: ${item.condition || 'Good'}

#vintage #streetwear #${item.brand?.toLowerCase().replace(/\s+/g, '') || 'fashion'}`.trim();
      return { title, description: description.slice(0, 1000), price: item.asking_price.toFixed(0) };
    },
  },
  {
    id: 'grailed',
    name: 'Grailed',
    icon: Shirt,
    color: 'text-gray-400',
    bgColor: 'bg-[#000000]',
    listingUrl: 'https://www.grailed.com/sell',
    titleLimit: 100,
    descriptionLimit: 2000,
    category: 'fashion',
    bestFor: ["Men's fashion", 'Streetwear', 'Designer'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

Designer: ${item.brand || 'N/A'}
Size: ${item.dimensions || 'See photos'}
Color: ${item.color || 'See photos'}
Condition: ${item.condition || 'Good'}

${item.is_verified ? 'Authenticity guaranteed' : ''}

No trades. Price firm.`.trim();
      return { title, description: description.slice(0, 2000), price: item.asking_price.toFixed(0) };
    },
  },
  {
    id: 'stockx',
    name: 'StockX',
    icon: Package,
    color: 'text-green-400',
    bgColor: 'bg-[#006340]',
    listingUrl: 'https://stockx.com/sell',
    titleLimit: 100,
    descriptionLimit: 500,
    category: 'fashion',
    bestFor: ['Sneakers', 'Streetwear', 'Authentication'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${item.brand || ''} ${item.model || ''}
Size: ${item.dimensions || 'N/A'}
Condition: ${item.condition || 'New'}
${item.color ? `Colorway: ${item.color}` : ''}`.trim();
      return { title, description, price: item.asking_price.toFixed(0) };
    },
  },
  {
    id: 'goat',
    name: 'GOAT',
    icon: Package,
    color: 'text-gray-300',
    bgColor: 'bg-[#1A1A1A]',
    listingUrl: 'https://www.goat.com/sell',
    titleLimit: 100,
    descriptionLimit: 500,
    category: 'fashion',
    bestFor: ['Sneakers', 'New & used', 'Authentication'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${item.brand || ''} ${item.model || ''}
Size: ${item.dimensions || 'N/A'}
Condition: ${item.condition || 'New'}`.trim();
      return { title, description, price: item.asking_price.toFixed(0) };
    },
  },

  // =========================================================================
  // MUSIC & VINYL
  // =========================================================================
  {
    id: 'discogs',
    name: 'Discogs',
    icon: Music,
    color: 'text-orange-400',
    bgColor: 'bg-[#333333]',
    listingUrl: 'https://www.discogs.com/sell/post',
    titleLimit: 200,
    descriptionLimit: 2000,
    category: 'music',
    bestFor: ['Vinyl records', 'CDs', 'Music collectors'],
    formatter: (item, customDesc) => {
      const condition = CONDITION_MAP.discogs[item.condition?.toLowerCase() || ''] || 'Very Good Plus (VG+)';
      const title = item.item_name.slice(0, 200);
      let description = `${customDesc || item.description || ''}

Media Condition: ${condition}
Sleeve Condition: ${condition}
${item.year ? `Year: ${item.year}` : ''}

${item.is_verified ? 'Verified pressing' : ''}

Ships in mailer with cardboard stiffeners`.trim();
      return { title, description, price: item.asking_price.toFixed(2), condition };
    },
  },
  {
    id: 'reverb',
    name: 'Reverb',
    icon: Music,
    color: 'text-orange-500',
    bgColor: 'bg-[#FF6600]',
    listingUrl: 'https://reverb.com/my/selling/listings/new',
    titleLimit: 120,
    descriptionLimit: 3000,
    category: 'music',
    bestFor: ['Music gear', 'Instruments', 'Vintage audio'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 120);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.model ? `Model: ${item.model}` : ''}
${item.year ? `Year: ${item.year}` : ''}
Condition: ${item.condition || 'Good'}

${item.is_verified ? '✅ Verified authentic' : ''}

Ships safely packed within 2 business days.`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },

  // =========================================================================
  // LUXURY & HIGH-END
  // =========================================================================
  {
    id: 'etsy',
    name: 'Etsy',
    icon: Sparkles,
    color: 'text-orange-400',
    bgColor: 'bg-[#F56400]',
    listingUrl: 'https://www.etsy.com/your/shops/me/tools/listings/create',
    titleLimit: 140,
    descriptionLimit: 10000,
    category: 'luxury',
    bestFor: ['Vintage', 'Handmade', 'Unique items'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 140);
      let description = `${customDesc || item.description || ''}

✦ ITEM DETAILS ✦
${item.brand ? `• Brand: ${item.brand}` : ''}
${item.model ? `• Model: ${item.model}` : ''}
${item.year ? `• Era/Year: ${item.year}` : ''}
${item.color ? `• Color: ${item.color}` : ''}
${item.dimensions ? `• Dimensions: ${item.dimensions}` : ''}
${item.material ? `• Material: ${item.material}` : ''}
• Condition: ${item.condition || 'Good'}

✦ SHIPPING ✦
Ships within 1-3 business days
Carefully packaged for safe delivery

${item.is_verified ? '✦ AUTHENTICITY VERIFIED ✦' : ''}

Thank you for visiting my shop! 💫`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
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
    descriptionLimit: 5000,
    category: 'luxury',
    bestFor: ['Antiques', 'Vintage jewelry', 'Fine art'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

DETAILS:
${item.brand ? `Maker/Brand: ${item.brand}` : ''}
${item.year ? `Period/Age: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.material ? `Materials: ${item.material}` : ''}
Condition: ${item.condition || 'Good'}

${item.is_verified ? 'Authenticity verified.' : ''}

Provenance documentation available upon request.`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },
  {
    id: '1stdibs',
    name: '1stDibs',
    icon: Gem,
    color: 'text-amber-400',
    bgColor: 'bg-[#000000]',
    listingUrl: 'https://www.1stdibs.com/dealers/apply/',
    titleLimit: 150,
    descriptionLimit: 5000,
    category: 'luxury',
    bestFor: ['High-end antiques', 'Luxury items', 'Fine art'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 150);
      let description = `${customDesc || item.description || ''}

SPECIFICATIONS
${item.brand ? `Creator/Designer: ${item.brand}` : ''}
${item.year ? `Period: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.material ? `Materials: ${item.material}` : ''}
Condition: ${item.condition || 'Excellent'}

${item.is_verified ? 'AUTHENTICATION: Verified' : ''}

Professional shipping and white-glove delivery available.`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },
  {
    id: 'chairish',
    name: 'Chairish',
    icon: Palette,
    color: 'text-pink-400',
    bgColor: 'bg-[#E91E63]',
    listingUrl: 'https://www.chairish.com/sell',
    titleLimit: 100,
    descriptionLimit: 3000,
    category: 'luxury',
    bestFor: ['Furniture', 'Home decor', 'Art'],
    formatter: (item, customDesc) => {
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Designer/Maker: ${item.brand}` : ''}
${item.year ? `Period: ${item.year}` : ''}
${item.dimensions ? `Dimensions: ${item.dimensions}` : ''}
${item.material ? `Materials: ${item.material}` : ''}
${item.color ? `Color/Finish: ${item.color}` : ''}
Condition: ${item.condition || 'Good'}

${item.is_verified ? 'Authenticity verified' : ''}`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },

  // =========================================================================
  // SPECIALTY
  // =========================================================================
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
      const title = item.item_name.slice(0, 80);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand: ${item.brand}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

${item.is_verified ? '✅ Verified' : ''}`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
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
      const title = item.item_name.slice(0, 100);
      let description = `${customDesc || item.description || ''}

${item.brand ? `Brand/Maker: ${item.brand}` : ''}
${item.year ? `Age/Year: ${item.year}` : ''}
${item.condition ? `Condition: ${item.condition}` : ''}

${item.is_verified ? 'Authenticated item' : ''}`.trim();
      return { title, description, price: item.asking_price.toFixed(2) };
    },
  },
];

// Group platforms by category
const PLATFORM_CATEGORIES = [
  { id: 'general', label: 'General Marketplaces', icon: Store },
  { id: 'cards', label: 'Trading Cards & Sports', icon: Gamepad2 },
  { id: 'fashion', label: 'Fashion & Streetwear', icon: Shirt },
  { id: 'music', label: 'Music & Audio', icon: Music },
  { id: 'luxury', label: 'Luxury & Antiques', icon: Gem },
  { id: 'specialty', label: 'Specialty', icon: Globe },
];

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const PlatformCard: React.FC<{
  platform: PlatformConfig;
  selected: boolean;
  onToggle: () => void;
  copied: boolean;
  onCopy: () => void;
  onOpenPlatform: () => void;
  listing: FormattedListing;
}> = ({ platform, selected, onToggle, copied, onCopy, onOpenPlatform, listing }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200 overflow-hidden',
        selected 
          ? 'border-primary bg-primary/5' 
          : 'border-zinc-800/50 hover:border-zinc-700 bg-zinc-900/30'
      )}
    >
      {/* Header */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className={cn('p-1.5 rounded', platform.bgColor)}>
          <platform.icon className="h-4 w-4 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm">{platform.name}</h4>
          <p className="text-[10px] text-zinc-500 truncate">
            {platform.bestFor.join(' • ')}
          </p>
        </div>
        
        <Checkbox checked={selected} className="h-4 w-4" />
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Separator className="bg-zinc-800/50" />
            
            <div className="p-3 space-y-2">
              {/* Title Preview */}
              <div>
                <Label className="text-[10px] text-zinc-500 mb-1 block">
                  Title ({listing.title.length}/{platform.titleLimit})
                </Label>
                <div className="p-2 rounded bg-zinc-800/50 text-xs text-zinc-300 font-mono truncate">
                  {listing.title}
                </div>
              </div>
              
              {/* Description Toggle */}
              <Collapsible open={expanded} onOpenChange={setExpanded}>
                <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400">
                  <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                  {expanded ? 'Hide' : 'Show'} description preview
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-2 rounded bg-zinc-800/50 text-xs text-zinc-400 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                    {listing.description}
                  </div>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs border-zinc-700 hover:bg-zinc-800"
                  onClick={(e) => { e.stopPropagation(); onCopy(); }}
                >
                  {copied ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> Copied!</>
                  ) : (
                    <><Copy className="h-3 w-3 mr-1" /> Copy</>
                  )}
                </Button>
                <Button
                  size="sm"
                  className={cn('flex-1 h-8 text-xs text-white', platform.bgColor, 'hover:opacity-90')}
                  onClick={(e) => { e.stopPropagation(); onOpenPlatform(); }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const ExportListingModal: React.FC<ExportListingModalProps> = ({
  open,
  onOpenChange,
  item,
  onListOnTagnetiq,
}) => {
  const [activeTab, setActiveTab] = useState('tagnetiq');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [copiedPlatforms, setCopiedPlatforms] = useState<Set<string>>(new Set());
  const [customDescription, setCustomDescription] = useState(item.description || '');
  const [customPrice, setCustomPrice] = useState(item.asking_price.toString());
  const [isListingOnTagnetiq, setIsListingOnTagnetiq] = useState(false);
  const [tagnetiqListed, setTagnetiqListed] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['general']));

  // Generate formatted listings for all platforms
  const formattedListings = useMemo(() => {
    const listings: Record<string, FormattedListing> = {};
    PLATFORMS.forEach(platform => {
      listings[platform.id] = platform.formatter(
        { ...item, asking_price: parseFloat(customPrice) || item.asking_price },
        customDescription
      );
    });
    return listings;
  }, [item, customDescription, customPrice]);

  // Toggle platform selection
  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platformId)) {
        next.delete(platformId);
      } else {
        next.add(platformId);
      }
      return next;
    });
  };

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Copy listing to clipboard
  const copyListing = async (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    const listing = formattedListings[platformId];
    if (!platform || !listing) return;

    const textToCopy = `${listing.title}\n\nPrice: $${listing.price}\n\n${listing.description}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPlatforms(prev => new Set(prev).add(platformId));
      toast.success(`${platform.name} listing copied!`);
      setTimeout(() => {
        setCopiedPlatforms(prev => {
          const next = new Set(prev);
          next.delete(platformId);
          return next;
        });
      }, 3000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  // Open platform
  const openPlatform = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (platform) window.open(platform.listingUrl, '_blank');
  };

  // Copy all selected
  const copyAllSelected = async () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Select at least one platform');
      return;
    }

    let allText = '';
    selectedPlatforms.forEach(platformId => {
      const platform = PLATFORMS.find(p => p.id === platformId);
      const listing = formattedListings[platformId];
      if (platform && listing) {
        allText += `\n${'═'.repeat(40)}\n${platform.name.toUpperCase()}\n${'═'.repeat(40)}\n\n`;
        allText += `TITLE:\n${listing.title}\n\nPRICE: $${listing.price}\n\nDESCRIPTION:\n${listing.description}\n\n`;
      }
    });

    await navigator.clipboard.writeText(allText.trim());
    toast.success(`${selectedPlatforms.size} listings copied!`);
  };

  // Open all selected
  const openAllSelected = () => {
    if (selectedPlatforms.size === 0) {
      toast.error('Select at least one platform');
      return;
    }
    selectedPlatforms.forEach(platformId => {
      const platform = PLATFORMS.find(p => p.id === platformId);
      if (platform) window.open(platform.listingUrl, '_blank');
    });
  };

  // List on TagnetIQ
  const handleListOnTagnetiq = async () => {
    if (!onListOnTagnetiq) return;
    setIsListingOnTagnetiq(true);
    try {
      await onListOnTagnetiq(item, parseFloat(customPrice) || item.asking_price, customDescription);
      setTagnetiqListed(true);
      toast.success('Listed on TagnetIQ!');
    } catch (err) {
      toast.error('Failed to create listing');
    } finally {
      setIsListingOnTagnetiq(false);
    }
  };

  // Select all in category
  const selectAllInCategory = (categoryId: string) => {
    const categoryPlatforms = PLATFORMS.filter(p => p.category === categoryId);
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      categoryPlatforms.forEach(p => next.add(p.id));
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-zinc-950 border-zinc-800">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-xl flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            List & Export
          </DialogTitle>
          <DialogDescription>
            List on TagnetIQ and export to 20+ marketplaces with optimized formatting
          </DialogDescription>
        </DialogHeader>

        {/* Item Preview */}
        <div className="px-6 py-3 border-y border-zinc-800/50 bg-zinc-900/30">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              {item.primary_photo_url ? (
                <img src={item.primary_photo_url} alt={item.item_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-zinc-600" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm">{item.item_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold">${item.asking_price.toLocaleString()}</span>
                {item.is_verified && (
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                    Verified
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2">
            <TabsList className="w-full bg-zinc-900/50 p-1">
              <TabsTrigger value="tagnetiq" className="flex-1 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Sparkles className="h-4 w-4 mr-2" />
                TagnetIQ
              </TabsTrigger>
              <TabsTrigger value="export" className="flex-1 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <ExternalLink className="h-4 w-4 mr-2" />
                Export ({PLATFORMS.length} platforms)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TagnetIQ Tab */}
          <TabsContent value="tagnetiq" className="flex-1 p-6 pt-4 space-y-4">
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label>Asking Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="number"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="pl-9 bg-zinc-900 border-zinc-800"
                  />
                </div>
                {item.estimated_value && (
                  <p className="text-xs text-zinc-500">HYDRA Value: ${item.estimated_value.toLocaleString()}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="min-h-[100px] bg-zinc-900 border-zinc-800 resize-none"
                  placeholder="Describe your item..."
                />
              </div>

              <Button
                className="w-full h-11"
                disabled={isListingOnTagnetiq || tagnetiqListed || !onListOnTagnetiq}
                onClick={handleListOnTagnetiq}
              >
                {isListingOnTagnetiq ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : tagnetiqListed ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Listed!</>
                ) : (
                  <><Store className="h-4 w-4 mr-2" /> List on TagnetIQ</>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="flex-1 flex flex-col min-h-0 p-0">
            {/* Description customization */}
            <div className="px-6 py-3 border-b border-zinc-800/50">
              <Label className="text-xs text-zinc-400 mb-2 block">Custom description (applies to all)</Label>
              <Textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                className="h-16 bg-zinc-900 border-zinc-800 resize-none text-sm"
                placeholder="Add description..."
              />
            </div>

            {/* Actions Bar */}
            {selectedPlatforms.size > 0 && (
              <div className="px-6 py-2 border-b border-zinc-800/50 bg-primary/5 flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/20 text-primary">
                  {selectedPlatforms.size} selected
                </Badge>
                <div className="flex-1" />
                <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700" onClick={copyAllSelected}>
                  <Copy className="h-3 w-3 mr-1" /> Copy All
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={openAllSelected}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Open All
                </Button>
              </div>
            )}

            {/* Platform List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {PLATFORM_CATEGORIES.map(category => {
                  const categoryPlatforms = PLATFORMS.filter(p => p.category === category.id);
                  const selectedCount = categoryPlatforms.filter(p => selectedPlatforms.has(p.id)).length;
                  const isExpanded = expandedCategories.has(category.id);

                  return (
                    <div key={category.id} className="space-y-2">
                      {/* Category Header */}
                      <div 
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => toggleCategory(category.id)}
                      >
                        <ChevronDown className={cn(
                          'h-4 w-4 text-zinc-500 transition-transform',
                          !isExpanded && '-rotate-90'
                        )} />
                        <category.icon className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-300">{category.label}</span>
                        <Badge variant="outline" className="text-[10px] h-5 border-zinc-700">
                          {categoryPlatforms.length}
                        </Badge>
                        {selectedCount > 0 && (
                          <Badge className="text-[10px] h-5 bg-primary/20 text-primary border-0">
                            {selectedCount} selected
                          </Badge>
                        )}
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); selectAllInCategory(category.id); }}
                        >
                          Select All
                        </Button>
                      </div>

                      {/* Category Platforms */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6"
                          >
                            {categoryPlatforms.map(platform => (
                              <PlatformCard
                                key={platform.id}
                                platform={platform}
                                selected={selectedPlatforms.has(platform.id)}
                                onToggle={() => togglePlatform(platform.id)}
                                copied={copiedPlatforms.has(platform.id)}
                                onCopy={() => copyListing(platform.id)}
                                onOpenPlatform={() => openPlatform(platform.id)}
                                listing={formattedListings[platform.id]}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                {/* Help Text */}
                <div className="bg-zinc-900/30 rounded-lg p-4 mt-4">
                  <h4 className="text-xs font-medium text-zinc-400 mb-2">How to export:</h4>
                  <ol className="text-[11px] text-zinc-500 space-y-1">
                    <li>1. Select platforms you want to list on</li>
                    <li>2. Click "Copy" to copy the pre-formatted listing</li>
                    <li>3. Click "Open" to go to the platform's listing page</li>
                    <li>4. Paste your listing and add photos</li>
                  </ol>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ExportListingModal;