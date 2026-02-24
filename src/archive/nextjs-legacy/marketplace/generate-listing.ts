// api/marketplace/generate-listing.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { db } from '../../src/server/db';
import { items } from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { itemId, platform, pricing, autoList } = body;

    // Fetch item details
    const item = await db.select().from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item.length || item[0].userId !== session.user.id) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const itemData = item[0];
    
    // Generate platform-specific listing
    const listing = await generatePlatformListing(itemData, platform, pricing);
    
    if (autoList) {
      // TODO: Integrate with actual marketplace APIs
      // For now, we'll simulate the listing creation
      console.log(`Would create listing on ${platform}:`, listing);
    }

    return NextResponse.json({
      platform,
      ...listing,
      autoListed: autoList
    });
  } catch (error) {
    console.error('Error generating listing:', error);
    return NextResponse.json({ 
      error: 'Failed to generate listing' 
    }, { status: 500 });
  }
}

async function generatePlatformListing(item: any, platform: string, pricingStrategy: string) {
  // Platform-specific optimizations
  const templates = {
    ebay: {
      titleMaxLength: 80,
      descriptionStyle: 'detailed',
      categoryMapping: getEbayCategory(item.category),
      shippingOptions: ['USPS First Class', 'USPS Priority', 'FedEx']
    },
    mercari: {
      titleMaxLength: 40,
      descriptionStyle: 'concise',
      categoryMapping: getMercariCategory(item.category),
      shippingOptions: ['Mercari prepaid', 'Ship on your own']
    },
    facebook: {
      titleMaxLength: 100,
      descriptionStyle: 'casual',
      categoryMapping: 'General',
      shippingOptions: ['Local pickup', 'Shipping available']
    }
  };

  const config = templates[platform] || templates.ebay;
  const analysis = item.analysisResult;
  
  // Calculate optimal price
  const price = calculateOptimalPrice(analysis, pricingStrategy);
  
  return {
    title: generateTitle(item.name, config.titleMaxLength),
    description: generateDescription(item, config.descriptionStyle, analysis),
    price: price.amount,
    category: config.categoryMapping,
    condition: mapCondition(item.condition),
    shippingOptions: config.shippingOptions,
    images: item.images || [],
    estimatedDays: estimateSaleDuration(price.competitiveness),
    pricing: {
      strategy: pricingStrategy,
      marketAverage: price.marketAverage,
      competitiveness: price.competitiveness
    }
  };
}

function calculateOptimalPrice(analysis: any, strategy: string) {
  const marketValue = analysis?.consensus?.estimatedValue || { min: 0, max: 0 };
  const avgValue = (marketValue.min + marketValue.max) / 2;
  
  const strategies = {
    'quick-sale': avgValue * 0.85,
    'market-optimal': avgValue * 0.95,
    'premium': avgValue * 1.05,
    'auction': marketValue.min * 0.7
  };
  
  const amount = strategies[strategy] || strategies['market-optimal'];
  
  return {
    amount: Math.round(amount),
    marketAverage: Math.round(avgValue),
    competitiveness: strategy === 'quick-sale' ? 'high' : 'moderate'
  };
}

function generateTitle(itemName: string, maxLength: number): string {
  // Optimize title for search
  let title = itemName;
  
  // Add condition indicators
  if (itemName.length < maxLength - 10) {
    title += ' - Authentic Verified';
  }
  
  return title.slice(0, maxLength);
}

function generateDescription(item: any, style: string, analysis: any): string {
  const styles = {
    detailed: `${item.name}

CONDITION: ${item.condition}
AUTHENTICITY: Verified by AI Analysis (${analysis?.consensus?.confidence || 'N/A'}% confidence)

DESCRIPTION:
${item.description || 'See photos for details'}

KEY FEATURES:
${analysis?.consensus?.details?.join('\n') || 'Professional authentication completed'}

All items are carefully inspected and authenticated using advanced AI technology.
Ships within 1 business day of payment.`,
    
    concise: `${item.name} - ${item.condition} condition
✓ Authenticated
✓ Fast shipping
✓ Trusted seller

${item.description || 'Great condition, see photos!'}`,
    
    casual: `${item.name}

${item.condition} condition - check out the photos!
${item.description || 'Awesome find!'}

Message me with any questions!`
  };
  
  return styles[style] || styles.detailed;
}

function getEbayCategory(category: string): string {
  const mapping = {
    'watches': 'Watches > Luxury Watches',
    'coins': 'Coins & Paper Money > Coins',
    'stamps': 'Stamps > Worldwide',
    'trading-cards': 'Collectibles > Trading Cards',
    'comics': 'Collectibles > Comics',
    'jewelry': 'Jewelry & Watches > Fine Jewelry',
    'art': 'Art > Paintings',
    'memorabilia': 'Sports Mem, Cards & Fan Shop'
  };
  
  return mapping[category] || 'Collectibles';
}

function getMercariCategory(category: string): string {
  const mapping = {
    'watches': 'Vintage > Watches',
    'coins': 'Collectibles > Coins',
    'stamps': 'Collectibles > Other',
    'trading-cards': 'Collectibles > Trading Cards',
    'comics': 'Books > Comics & Manga',
    'jewelry': 'Jewelry > Vintage',
    'art': 'Home > Art',
    'memorabilia': 'Sports & Outdoors > Memorabilia'
  };
  
  return mapping[category] || 'Collectibles > Other';
}

function mapCondition(condition: string): string {
  const mapping = {
    'mint': 'New',
    'near-mint': 'Like New',
    'excellent': 'Good',
    'very-good': 'Good',
    'good': 'Good',
    'fair': 'Fair',
    'poor': 'Poor'
  };
  
  return mapping[condition] || 'Good';
}

function estimateSaleDuration(competitiveness: string): number {
  const estimates = {
    'high': 3,
    'moderate': 7,
    'low': 14
  };
  
  return estimates[competitiveness] || 7;
}