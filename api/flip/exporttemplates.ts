// FILE: api/flip/export-templates.ts
// Export Templates - Platform-specific formatted posts ready to copy/paste
// Supports: eBay, FB Marketplace, Craigslist, Mercari, Poshmark, OfferUp, Depop

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateListing, type GeneratedListing } from './listing-generator.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// ==================== TYPES ====================

interface ExportInput {
  itemName: string;
  category: string;
  estimatedValue: number;
  condition?: string;
  valuation_factors?: string[];
  tags?: string[];
  images?: string[];
  
  // Optional overrides
  askingPrice?: number;
  shippingIncluded?: boolean;
  acceptsOffers?: boolean;
  location?: string;
}

interface PlatformExport {
  platform: string;
  platformSlug: string;
  
  // Ready to paste content
  title: string;
  description: string;
  price: number;
  
  // Platform-specific fields
  fields: Record<string, any>;
  
  // Copy-paste formatted
  copyPasteText: string;
  
  // Platform tips
  tips: string[];
  
  // Direct link to create listing (if available)
  createListingUrl?: string;
}

interface ExportBundle {
  item: {
    name: string;
    category: string;
    condition: string;
  };
  generatedListing: GeneratedListing;
  exports: PlatformExport[];
  socialMediaPost: string;
  generatedAt: string;
}

// ==================== PLATFORM EXPORTERS ====================

function exportToEbay(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  const fields: Record<string, any> = {
    title: listing.title.medium,
    description: listing.description.full,
    price: price,
    condition: listing.conditionTags.ebay,
    category: input.category,
    shippingType: input.shippingIncluded ? 'Free shipping' : 'Calculated',
    acceptsOffers: input.acceptsOffers !== false,
    duration: '7 days',
    format: 'Buy It Now',
  };
  
  // Copy-paste formatted for eBay
  const copyPasteText = `
📋 EBAY LISTING TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE (80 chars max):
${listing.title.medium}

CONDITION:
${listing.conditionTags.ebay}

PRICE:
$${price.toFixed(2)}${input.acceptsOffers !== false ? ' (Best Offer enabled)' : ' (Fixed Price)'}

DESCRIPTION:
${listing.description.full}

ITEM SPECIFICS TO ADD:
• Brand: [Extract from item name]
• Type: ${input.category.replace(/_/g, ' ')}
• Condition: ${listing.conditionTags.ebay}

KEYWORDS FOR SEARCH:
${listing.keywords.join(', ')}
`.trim();

  const tips = [
    '📸 Use all 12 photo slots - more photos = more sales',
    '💰 Enable Best Offer to attract more buyers',
    '📦 Offer free shipping - eBay boosts free shipping listings',
    '⏰ End listings on Sunday evening for max visibility',
    '🏷️ Fill out ALL item specifics for better search ranking',
  ];
  
  return {
    platform: 'eBay',
    platformSlug: 'ebay',
    title: listing.title.medium,
    description: listing.description.full,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: `https://www.ebay.com/sl/sell`,
  };
}

function exportToFacebookMarketplace(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  // FB Marketplace prefers shorter, punchier descriptions
  const fbDescription = `${listing.description.medium}

📍 ${input.location || 'Local pickup available'}
💬 Message for details!

${listing.hashtags.slice(0, 5).join(' ')}`;

  const fields: Record<string, any> = {
    title: listing.title.short,
    description: fbDescription,
    price: price,
    condition: listing.conditionTags.standard,
    category: input.category,
    availability: 'In Stock',
    location: input.location || 'Your location',
  };
  
  const copyPasteText = `
📋 FACEBOOK MARKETPLACE TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE (keep it short!):
${listing.title.short}

PRICE:
$${price.toFixed(2)}

CONDITION:
${listing.conditionTags.descriptive}

DESCRIPTION:
${fbDescription}

CATEGORY TO SELECT:
${input.category.replace(/_/g, ' ').charAt(0).toUpperCase() + input.category.replace(/_/g, ' ').slice(1)}
`.trim();

  const tips = [
    '📸 First photo is EVERYTHING - make it eye-catching',
    '💵 FB is FREE for local sales - no fees!',
    '📍 Enable "shipping" to reach more buyers',
    '🔄 Renew listing every few days to stay on top',
    '💬 Respond to messages within 1 hour for best results',
  ];
  
  return {
    platform: 'Facebook Marketplace',
    platformSlug: 'facebook',
    title: listing.title.short,
    description: fbDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://www.facebook.com/marketplace/create/item',
  };
}

function exportToCraigslist(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  // Craigslist: plain text, no frills, safety focused
  const clDescription = `${listing.title.medium}

${listing.description.medium}

Price: $${price.toFixed(2)}${input.acceptsOffers !== false ? ' OBO' : ' FIRM'}

━━━━━━━━━━━━━━━━━━━━━━━━
📍 Cash only, local pickup
📱 Text or email to arrange viewing
⚠️ Will meet in public place only
━━━━━━━━━━━━━━━━━━━━━━━━

Keywords: ${listing.keywords.slice(0, 8).join(', ')}`;

  const fields: Record<string, any> = {
    title: listing.title.short,
    description: clDescription,
    price: price,
    location: input.location || 'Your city',
    category: 'for sale > general',
  };
  
  const copyPasteText = `
📋 CRAIGSLIST TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
${listing.title.short} - $${price.toFixed(2)}

PRICE:
$${price.toFixed(2)}

POSTING BODY:
${clDescription}

CATEGORY:
for sale > general (or appropriate subcategory)

LOCATION:
${input.location || '[Your city/neighborhood]'}
`.trim();

  const tips = [
    '🆓 Craigslist is FREE - $0 fees!',
    '🔒 Meet in public, bring a friend',
    '💵 Cash only - no PayPal/Venmo for safety',
    '📸 Include multiple clear photos',
    '🔄 Repost every 48 hours to stay visible',
  ];
  
  return {
    platform: 'Craigslist',
    platformSlug: 'craigslist',
    title: listing.title.short,
    description: clDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://post.craigslist.org/',
  };
}

function exportToMercari(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  // Mercari loves emojis and hashtags
  const mercariDescription = `${listing.description.medium}

✨ Fast shipper! Usually ships within 24 hours
📦 Carefully packaged
💯 Check my reviews!

${listing.hashtags.slice(0, 8).join(' ')}`;

  const fields: Record<string, any> = {
    title: listing.title.medium,
    description: mercariDescription,
    price: price,
    condition: listing.conditionTags.mercari,
    category: input.category,
    brand: 'Extract from item',
    color: 'As shown',
    shippingPaidBy: input.shippingIncluded ? 'seller' : 'buyer',
  };
  
  const copyPasteText = `
📋 MERCARI TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
${listing.title.medium}

PRICE:
$${price.toFixed(2)}

CONDITION:
${listing.conditionTags.mercari}

DESCRIPTION:
${mercariDescription}

SHIPPING:
${input.shippingIncluded ? 'I\'ll pay for shipping' : 'Buyer pays shipping'}

TAGS/KEYWORDS:
${listing.keywords.slice(0, 10).join(', ')}
`.trim();

  const tips = [
    '📸 10 photos max - use them all!',
    '💰 10% fee - price accordingly',
    '🏷️ Use Smart Pricing to auto-lower price',
    '⭐ Promote listings for 10% to boost visibility',
    '📦 Use Mercari prepaid labels for easy shipping',
  ];
  
  return {
    platform: 'Mercari',
    platformSlug: 'mercari',
    title: listing.title.medium,
    description: mercariDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://www.mercari.com/sell/',
  };
}

function exportToPoshmark(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  // Poshmark is fashion-focused, community-driven
  const poshDescription = `${listing.title.long}

${listing.description.short}

📏 Size: [ADD SIZE]
📐 Measurements: [ADD IF APPLICABLE]

${listing.conditionTags.descriptive}

❤️ Bundle for discount!
🏷️ Reasonable offers welcome via Offer button

${listing.hashtags.filter(h => !h.includes('ForSale')).slice(0, 5).join(' ')}`;

  const fields: Record<string, any> = {
    title: listing.title.medium,
    description: poshDescription,
    price: price,
    originalPrice: Math.round(price * 1.5),
    size: 'TO BE FILLED',
    brand: 'TO BE FILLED',
    category: input.category,
    color: 'As shown',
  };
  
  const copyPasteText = `
📋 POSHMARK TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
${listing.title.medium}

LISTING PRICE:
$${price.toFixed(2)}

ORIGINAL RETAIL:
$${Math.round(price * 1.5).toFixed(2)}

DESCRIPTION:
${poshDescription}

SIZE:
[FILL IN]

BRAND:
[FILL IN]

CATEGORY:
${input.category.replace(/_/g, ' ')}
`.trim();

  const tips = [
    '👗 Poshmark is 20% fee ($2.95 for <$15)',
    '📦 Shipping is included for buyer (prepaid label)',
    '🎉 Host/join Posh Parties for exposure',
    '❤️ Share your closet daily for more views',
    '💬 Leave love notes on sales for good reviews',
  ];
  
  return {
    platform: 'Poshmark',
    platformSlug: 'poshmark',
    title: listing.title.medium,
    description: poshDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://poshmark.com/create-listing',
  };
}

function exportToOfferUp(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  const offerUpDescription = `${listing.title.medium}

${listing.description.short}

📍 ${input.location || 'Local pickup available'}
💵 Cash or OfferUp payment accepted
📱 Message me to arrange pickup!

Condition: ${listing.conditionTags.descriptive}`;

  const fields: Record<string, any> = {
    title: listing.title.short,
    description: offerUpDescription,
    price: price,
    condition: listing.conditionTags.standard,
    category: input.category,
    firmOnPrice: input.acceptsOffers === false,
  };
  
  const copyPasteText = `
📋 OFFERUP TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TITLE:
${listing.title.short}

PRICE:
$${price.toFixed(2)}${input.acceptsOffers !== false ? '' : ' (Firm)'}

CONDITION:
${listing.conditionTags.standard}

DESCRIPTION:
${offerUpDescription}

LOCATION:
${input.location || '[Your area]'}
`.trim();

  const tips = [
    '🆓 FREE for local sales!',
    '💳 12.9% + $1.99 if shipping',
    '⭐ TruYou verification builds trust',
    '🚗 Offer delivery for premium',
    '📱 Respond fast - buyers expect quick replies',
  ];
  
  return {
    platform: 'OfferUp',
    platformSlug: 'offerup',
    title: listing.title.short,
    description: offerUpDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://offerup.com/post',
  };
}

function exportToDepop(
  listing: GeneratedListing,
  input: ExportInput
): PlatformExport {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  // Depop is very hashtag-heavy, Gen Z focused
  const depopDescription = `${listing.title.short} ✨

${listing.description.short}

#${listing.keywords.slice(0, 5).map(k => k.replace(/\s+/g, '')).join(' #')}

${listing.hashtags.slice(0, 8).join(' ')}

#depop #vintage #y2k #aesthetic`;

  const fields: Record<string, any> = {
    description: depopDescription,
    price: price,
    condition: listing.conditionTags.standard,
    category: input.category,
    size: 'TO BE FILLED',
    brand: 'TO BE FILLED',
  };
  
  const copyPasteText = `
📋 DEPOP TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICE:
$${price.toFixed(2)}

DESCRIPTION (paste this):
${depopDescription}

SIZE:
[FILL IN]

BRAND:
[FILL IN or "Vintage" / "Unbranded"]

CONDITION:
${listing.conditionTags.standard}
`.trim();

  const tips = [
    '📸 Aesthetic photos perform best - good lighting!',
    '🏷️ Hashtags are ESSENTIAL on Depop',
    '💫 Refresh listings daily to stay in search',
    '✨ Use trendy keywords: y2k, vintage, aesthetic, cottagecore',
    '💬 Engage with the community for more followers',
  ];
  
  return {
    platform: 'Depop',
    platformSlug: 'depop',
    title: listing.title.short,
    description: depopDescription,
    price,
    fields,
    copyPasteText,
    tips,
    createListingUrl: 'https://www.depop.com/sell/',
  };
}

// ==================== SOCIAL MEDIA POST ====================

function generateSocialMediaPost(
  listing: GeneratedListing,
  input: ExportInput
): string {
  const price = input.askingPrice || listing.pricing.listPrice;
  
  return `
🔥 FOR SALE 🔥

${listing.title.medium}

💰 $${price.toFixed(2)}
📦 ${input.shippingIncluded ? 'Free shipping!' : 'Shipping available'}
✨ ${listing.conditionTags.descriptive}

DM to purchase! 📩

${listing.hashtags.slice(0, 10).join(' ')}

#forsale #reseller #thriftflip #flipping
`.trim();
}

// ==================== MAIN EXPORT FUNCTION ====================

export function exportToAllPlatforms(input: ExportInput): ExportBundle {
  // Generate the base listing
  const generatedListing = generateListing({
    itemName: input.itemName,
    category: input.category,
    estimatedValue: input.estimatedValue,
    condition: input.condition,
    valuation_factors: input.valuation_factors,
    tags: input.tags,
  });
  
  // Generate exports for all platforms
  const exports: PlatformExport[] = [
    exportToEbay(generatedListing, input),
    exportToFacebookMarketplace(generatedListing, input),
    exportToCraigslist(generatedListing, input),
    exportToMercari(generatedListing, input),
    exportToPoshmark(generatedListing, input),
    exportToOfferUp(generatedListing, input),
    exportToDepop(generatedListing, input),
  ];
  
  // Generate social media post
  const socialMediaPost = generateSocialMediaPost(generatedListing, input);
  
  return {
    item: {
      name: input.itemName,
      category: input.category,
      condition: input.condition || 'good',
    },
    generatedListing,
    exports,
    socialMediaPost,
    generatedAt: new Date().toISOString(),
  };
}

// Export single platform
export function exportToPlatform(
  input: ExportInput,
  platform: string
): PlatformExport | null {
  const generatedListing = generateListing({
    itemName: input.itemName,
    category: input.category,
    estimatedValue: input.estimatedValue,
    condition: input.condition,
    valuation_factors: input.valuation_factors,
    tags: input.tags,
  });
  
  switch (platform.toLowerCase()) {
    case 'ebay':
      return exportToEbay(generatedListing, input);
    case 'facebook':
    case 'fb':
      return exportToFacebookMarketplace(generatedListing, input);
    case 'craigslist':
    case 'cl':
      return exportToCraigslist(generatedListing, input);
    case 'mercari':
      return exportToMercari(generatedListing, input);
    case 'poshmark':
      return exportToPoshmark(generatedListing, input);
    case 'offerup':
      return exportToOfferUp(generatedListing, input);
    case 'depop':
      return exportToDepop(generatedListing, input);
    default:
      return null;
  }
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { platform, ...input } = req.body as ExportInput & { platform?: string };
    
    // Validation
    if (!input.itemName || typeof input.itemName !== 'string') {
      return res.status(400).json({ error: 'itemName is required' });
    }
    
    if (typeof input.estimatedValue !== 'number' || input.estimatedValue <= 0) {
      return res.status(400).json({ error: 'estimatedValue must be a positive number' });
    }
    
    // If specific platform requested, return just that
    if (platform) {
      const singleExport = exportToPlatform(input, platform);
      if (!singleExport) {
        return res.status(400).json({ 
          error: `Unknown platform: ${platform}`,
          availablePlatforms: ['ebay', 'facebook', 'craigslist', 'mercari', 'poshmark', 'offerup', 'depop']
        });
      }
      return res.status(200).json(singleExport);
    }
    
    // Otherwise return all platforms
    const bundle = exportToAllPlatforms(input);
    
    return res.status(200).json(bundle);
    
  } catch (error: any) {
    console.error('Export templates error:', error);
    return res.status(500).json({
      error: 'Failed to generate export templates',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}