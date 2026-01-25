// FILE: api/flip/profit-calculator.ts
// Profit Calculator - Net profit across all major resale platforms
// Includes: seller fees, payment processing, estimated shipping

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

// ==================== PLATFORM FEE STRUCTURES ====================
// Updated January 2025

interface PlatformFees {
  name: string;
  slug: string;
  sellerFeePercent: number;      // Base seller fee percentage
  paymentProcessingPercent: number; // Payment processing (usually ~3%)
  paymentProcessingFlat: number;    // Flat fee per transaction
  minFee: number;                   // Minimum fee charged
  maxFee: number | null;            // Maximum fee cap (null = no cap)
  shippingPaidBy: 'seller' | 'buyer' | 'negotiable';
  promotedListingFee?: number;      // Optional promoted listing %
  notes: string;
}

const PLATFORM_FEES: Record<string, PlatformFees> = {
  ebay: {
    name: 'eBay',
    slug: 'ebay',
    sellerFeePercent: 13.25,        // Final value fee (most categories)
    paymentProcessingPercent: 0,     // Included in FVF now
    paymentProcessingFlat: 0.30,     // Per-order fee
    minFee: 0,
    maxFee: 750,                     // $750 cap per item
    shippingPaidBy: 'negotiable',
    promotedListingFee: 8,           // Average promoted listing rate
    notes: 'Final value fee includes payment processing. 13.25% for most categories.',
  },
  mercari: {
    name: 'Mercari',
    slug: 'mercari',
    sellerFeePercent: 10,
    paymentProcessingPercent: 2.9,
    paymentProcessingFlat: 0.50,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: '10% selling fee + payment processing on direct deposit.',
  },
  poshmark: {
    name: 'Poshmark',
    slug: 'poshmark',
    sellerFeePercent: 20,            // Flat 20% for sales > $15
    paymentProcessingPercent: 0,
    paymentProcessingFlat: 2.95,     // Flat $2.95 for sales < $15
    minFee: 2.95,
    maxFee: null,
    shippingPaidBy: 'buyer',         // Poshmark provides label
    notes: '$2.95 flat fee for sales under $15, 20% for sales $15+.',
  },
  facebook: {
    name: 'Facebook Marketplace',
    slug: 'facebook',
    sellerFeePercent: 0,             // FREE for local pickup!
    paymentProcessingPercent: 5,     // 5% if using shipping/checkout
    paymentProcessingFlat: 0.40,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: 'FREE for local pickup. 5% + $0.40 if using FB checkout with shipping.',
  },
  craigslist: {
    name: 'Craigslist',
    slug: 'craigslist',
    sellerFeePercent: 0,
    paymentProcessingPercent: 0,
    paymentProcessingFlat: 0,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'seller',        // Usually local pickup
    notes: 'FREE - cash transactions, local pickup only.',
  },
  offerup: {
    name: 'OfferUp',
    slug: 'offerup',
    sellerFeePercent: 0,             // Free for local
    paymentProcessingPercent: 12.9,  // If using shipping
    paymentProcessingFlat: 1.99,
    minFee: 1.99,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: 'FREE for local. 12.9% + $1.99 for shipped items.',
  },
  depop: {
    name: 'Depop',
    slug: 'depop',
    sellerFeePercent: 10,
    paymentProcessingPercent: 3.3,
    paymentProcessingFlat: 0.45,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: '10% Depop fee + payment processing.',
  },
  whatnot: {
    name: 'Whatnot',
    slug: 'whatnot',
    sellerFeePercent: 8,             // 8% for most sellers
    paymentProcessingPercent: 2.9,
    paymentProcessingFlat: 0.30,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'buyer',
    notes: '8% seller fee + payment processing. Great for collectibles.',
  },
  etsy: {
    name: 'Etsy',
    slug: 'etsy',
    sellerFeePercent: 6.5,           // Transaction fee
    paymentProcessingPercent: 3,
    paymentProcessingFlat: 0.25,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: '6.5% transaction fee + 3% + $0.25 payment processing + $0.20 listing fee.',
  },
  arena: {
    name: 'TagNet Arena',
    slug: 'arena',
    sellerFeePercent: 5,             // Your native marketplace!
    paymentProcessingPercent: 2.9,
    paymentProcessingFlat: 0.30,
    minFee: 0,
    maxFee: null,
    shippingPaidBy: 'negotiable',
    notes: 'TagNet native marketplace. 5% fee + payment processing.',
  },
};

// ==================== SHIPPING ESTIMATES ====================

interface ShippingEstimate {
  method: string;
  price: number;
  carrier: string;
  estimatedDays: string;
}

// Weight-based shipping estimates (in oz)
function estimateShipping(
  weight: number = 8,  // Default 8oz (half pound)
  category: string = 'general'
): ShippingEstimate[] {
  const estimates: ShippingEstimate[] = [];
  
  // Adjust weight based on category
  let adjustedWeight = weight;
  if (category.includes('coin') || category.includes('card')) {
    adjustedWeight = Math.max(weight, 4); // Light items, padded envelope
  } else if (category.includes('lego') || category.includes('book')) {
    adjustedWeight = Math.max(weight, 24); // Heavier items
  } else if (category.includes('sneaker') || category.includes('shoe')) {
    adjustedWeight = Math.max(weight, 48); // Shoes are heavy
  }
  
  // USPS First Class (under 16oz)
  if (adjustedWeight <= 16) {
    estimates.push({
      method: 'USPS First Class',
      price: 4.50 + (adjustedWeight * 0.15),
      carrier: 'USPS',
      estimatedDays: '2-5 days',
    });
  }
  
  // USPS Priority Mail
  estimates.push({
    method: 'USPS Priority Mail',
    price: adjustedWeight <= 16 ? 9.50 : 12.50 + (adjustedWeight / 16) * 2,
    carrier: 'USPS',
    estimatedDays: '1-3 days',
  });
  
  // Pirate Ship (discounted commercial rates)
  estimates.push({
    method: 'Pirate Ship (Discounted)',
    price: (adjustedWeight <= 16 ? 4.00 : 8.00) + (adjustedWeight * 0.10),
    carrier: 'USPS/UPS',
    estimatedDays: '2-5 days',
  });
  
  // UPS Ground (heavier items)
  if (adjustedWeight > 16) {
    estimates.push({
      method: 'UPS Ground',
      price: 10.00 + (adjustedWeight / 16) * 1.50,
      carrier: 'UPS',
      estimatedDays: '3-7 days',
    });
  }
  
  return estimates.sort((a, b) => a.price - b.price);
}

// ==================== PROFIT CALCULATION ====================

interface ProfitCalculation {
  platform: string;
  platformSlug: string;
  salePrice: number;
  buyPrice: number;
  
  // Fee breakdown
  sellerFee: number;
  paymentFee: number;
  totalFees: number;
  feePercent: number;
  
  // Shipping
  shippingCost: number;
  shippingPaidBy: string;
  
  // Profit
  grossProfit: number;
  netProfit: number;
  profitMargin: number;    // As percentage
  roi: number;             // Return on investment %
  
  // Recommendation
  viable: boolean;
  notes: string;
}

interface ProfitSummary {
  item: {
    name: string;
    category: string;
    estimatedValue: number;
    buyPrice: number;
    condition: string;
  };
  shipping: {
    estimatedWeight: number;
    cheapestOption: ShippingEstimate;
    allOptions: ShippingEstimate[];
  };
  platforms: ProfitCalculation[];
  bestPlatform: ProfitCalculation | null;
  quickVerdict: {
    score: number;          // 1-100
    emoji: string;          // 🔥 ✅ ⚠️ ❌
    verdict: string;        // "HOT FLIP" | "Good Buy" | "Marginal" | "Pass"
    reasoning: string;
  };
  calculatedAt: string;
}

function calculatePlatformProfit(
  salePrice: number,
  buyPrice: number,
  platform: PlatformFees,
  shippingCost: number,
  sellerPaysShipping: boolean
): ProfitCalculation {
  
  // Calculate seller fee
  let sellerFee = (salePrice * platform.sellerFeePercent) / 100;
  
  // Special case: Poshmark's $2.95 flat fee for sales under $15
  if (platform.slug === 'poshmark' && salePrice < 15) {
    sellerFee = platform.paymentProcessingFlat;
  }
  
  // Apply fee caps
  if (platform.maxFee !== null) {
    sellerFee = Math.min(sellerFee, platform.maxFee);
  }
  sellerFee = Math.max(sellerFee, platform.minFee);
  
  // Calculate payment processing fee
  const paymentFee = (salePrice * platform.paymentProcessingPercent) / 100 + platform.paymentProcessingFlat;
  
  // Total fees
  const totalFees = sellerFee + paymentFee;
  const feePercent = (totalFees / salePrice) * 100;
  
  // Shipping cost (only if seller pays)
  const effectiveShipping = sellerPaysShipping ? shippingCost : 0;
  
  // Profit calculations
  const grossProfit = salePrice - buyPrice;
  const netProfit = salePrice - buyPrice - totalFees - effectiveShipping;
  const profitMargin = (netProfit / salePrice) * 100;
  const roi = buyPrice > 0 ? (netProfit / buyPrice) * 100 : 0;
  
  // Viability check
  const viable = netProfit > 0 && profitMargin > 10;
  
  // Generate notes
  let notes = '';
  if (netProfit <= 0) {
    notes = '❌ Loss - not recommended';
  } else if (profitMargin < 10) {
    notes = '⚠️ Low margin - risky';
  } else if (profitMargin < 25) {
    notes = '✅ Decent profit';
  } else if (profitMargin < 50) {
    notes = '🔥 Good flip!';
  } else {
    notes = '💰 Excellent margin!';
  }
  
  if (platform.slug === 'facebook' || platform.slug === 'craigslist') {
    notes += ' (Local pickup = no shipping!)';
  }
  
  return {
    platform: platform.name,
    platformSlug: platform.slug,
    salePrice: Math.round(salePrice * 100) / 100,
    buyPrice: Math.round(buyPrice * 100) / 100,
    sellerFee: Math.round(sellerFee * 100) / 100,
    paymentFee: Math.round(paymentFee * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    feePercent: Math.round(feePercent * 10) / 10,
    shippingCost: Math.round(effectiveShipping * 100) / 100,
    shippingPaidBy: sellerPaysShipping ? 'seller' : 'buyer',
    grossProfit: Math.round(grossProfit * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    profitMargin: Math.round(profitMargin * 10) / 10,
    roi: Math.round(roi * 10) / 10,
    viable,
    notes,
  };
}

function generateQuickVerdict(
  bestProfit: ProfitCalculation | null,
  buyPrice: number
): ProfitSummary['quickVerdict'] {
  
  if (!bestProfit || bestProfit.netProfit <= 0) {
    return {
      score: 10,
      emoji: '❌',
      verdict: 'Pass',
      reasoning: 'No profitable platform found at this buy price.',
    };
  }
  
  const { netProfit, profitMargin, roi } = bestProfit;
  
  // Score calculation (weighted)
  let score = 0;
  
  // ROI contribution (0-40 points)
  if (roi >= 200) score += 40;
  else if (roi >= 100) score += 30;
  else if (roi >= 50) score += 20;
  else if (roi >= 25) score += 10;
  
  // Profit margin contribution (0-30 points)
  if (profitMargin >= 50) score += 30;
  else if (profitMargin >= 35) score += 22;
  else if (profitMargin >= 25) score += 15;
  else if (profitMargin >= 15) score += 8;
  
  // Absolute profit contribution (0-30 points)
  if (netProfit >= 50) score += 30;
  else if (netProfit >= 25) score += 22;
  else if (netProfit >= 15) score += 15;
  else if (netProfit >= 5) score += 8;
  else score += 3;
  
  // Generate verdict
  let emoji: string;
  let verdict: string;
  let reasoning: string;
  
  if (score >= 80) {
    emoji = '🔥';
    verdict = 'HOT FLIP';
    reasoning = `$${netProfit.toFixed(2)} profit (${roi.toFixed(0)}% ROI) - Don't miss this!`;
  } else if (score >= 60) {
    emoji = '✅';
    verdict = 'Good Buy';
    reasoning = `$${netProfit.toFixed(2)} profit (${roi.toFixed(0)}% ROI) - Solid flip potential.`;
  } else if (score >= 40) {
    emoji = '⚠️';
    verdict: 'Marginal';
    reasoning = `$${netProfit.toFixed(2)} profit (${roi.toFixed(0)}% ROI) - Low margin, proceed with caution.`;
  } else {
    emoji = '🤔';
    verdict = 'Consider';
    reasoning = `$${netProfit.toFixed(2)} profit - Small margin. Only if quick sale expected.`;
  }
  
  return { score, emoji, verdict, reasoning };
}

// ==================== MAIN EXPORT FUNCTION ====================

export function calculateProfit(
  itemName: string,
  category: string,
  estimatedValue: number,
  buyPrice: number,
  condition: string = 'good',
  weightOz: number = 8,
  sellerPaysShipping: boolean = true
): ProfitSummary {
  
  // Get shipping estimates
  const shippingOptions = estimateShipping(weightOz, category);
  const cheapestShipping = shippingOptions[0];
  
  // Calculate profit for each platform
  const platforms: ProfitCalculation[] = [];
  
  for (const [slug, platform] of Object.entries(PLATFORM_FEES)) {
    // For local-only platforms, shipping is $0
    const effectiveShipping = 
      (slug === 'facebook' || slug === 'craigslist') 
        ? 0 
        : cheapestShipping.price;
    
    // For platforms where buyer typically pays shipping
    const sellerPays = 
      platform.shippingPaidBy === 'seller' || 
      (platform.shippingPaidBy === 'negotiable' && sellerPaysShipping);
    
    const calc = calculatePlatformProfit(
      estimatedValue,
      buyPrice,
      platform,
      effectiveShipping,
      sellerPays
    );
    
    platforms.push(calc);
  }
  
  // Sort by net profit (highest first)
  platforms.sort((a, b) => b.netProfit - a.netProfit);
  
  // Find best platform
  const bestPlatform = platforms.find(p => p.viable) || platforms[0];
  
  // Generate quick verdict
  const quickVerdict = generateQuickVerdict(bestPlatform, buyPrice);
  
  return {
    item: {
      name: itemName,
      category,
      estimatedValue,
      buyPrice,
      condition,
    },
    shipping: {
      estimatedWeight: weightOz,
      cheapestOption: cheapestShipping,
      allOptions: shippingOptions,
    },
    platforms,
    bestPlatform,
    quickVerdict,
    calculatedAt: new Date().toISOString(),
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const {
      itemName,
      category,
      estimatedValue,
      buyPrice,
      condition = 'good',
      weightOz = 8,
      sellerPaysShipping = true,
    } = req.body;
    
    // Validation
    if (!itemName || typeof itemName !== 'string') {
      return res.status(400).json({ error: 'itemName is required' });
    }
    
    if (typeof estimatedValue !== 'number' || estimatedValue <= 0) {
      return res.status(400).json({ error: 'estimatedValue must be a positive number' });
    }
    
    if (typeof buyPrice !== 'number' || buyPrice < 0) {
      return res.status(400).json({ error: 'buyPrice must be a non-negative number' });
    }
    
    const result = calculateProfit(
      itemName,
      category || 'general',
      estimatedValue,
      buyPrice,
      condition,
      weightOz,
      sellerPaysShipping
    );
    
    return res.status(200).json(result);
    
  } catch (error: any) {
    console.error('Profit calculator error:', error);
    return res.status(500).json({
      error: 'Failed to calculate profit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}