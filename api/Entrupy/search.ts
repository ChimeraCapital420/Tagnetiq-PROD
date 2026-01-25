// Entrupy Search Helper
// Detects luxury goods items and provides authentication search

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  isLuxuryItem, 
  extractBrandFromText, 
  searchEntrupyByBrand,
  SUPPORTED_LUXURY_BRANDS,
  type EntrupyItemData 
} from './index';

// ==================== TYPES ====================

export interface LuxurySearchRequest {
  query: string;           // Item name or description
  entrupyId?: string;      // If Entrupy ID is known
  customerId?: string;     // If customer item ID is known
  checkAuthenticity?: boolean; // Whether to check if item might be fake
}

export interface LuxurySearchResult {
  isLuxuryItem: boolean;
  detectedBrand?: string;
  brandDisplay?: string;
  confidence: number;
  searchQueries: {
    ebay: string;
    generic: string;
  };
  authenticityIndicators: {
    hasSerialNumber: boolean;
    hasDateCode: boolean;
    mentionsCertificate: boolean;
    mentionsAuthentic: boolean;
    redFlags: string[];
  };
  comparables?: EntrupyItemData[];
  pricingGuidance?: string;
  authenticationRecommendation?: string;
}

// ==================== LUXURY ITEM ANALYSIS ====================

/**
 * Detect authenticity indicators and red flags
 */
function analyzeAuthenticityIndicators(text: string): LuxurySearchResult['authenticityIndicators'] {
  const textLower = text.toLowerCase();
  
  const redFlags: string[] = [];
  
  // Check for concerning phrases
  const suspiciousPatterns = [
    { pattern: /replica/i, flag: 'Listed as replica' },
    { pattern: /inspired\s+by/i, flag: 'Described as "inspired by"' },
    { pattern: /aaa\s*(quality|grade)/i, flag: 'AAA quality mentioned (common counterfeit term)' },
    { pattern: /mirror\s*(quality|image)/i, flag: 'Mirror quality mentioned (counterfeit term)' },
    { pattern: /1:1/i, flag: '1:1 mentioned (counterfeit term)' },
    { pattern: /factory\s*(direct|outlet)/i, flag: 'Factory direct mentioned' },
    { pattern: /unbranded/i, flag: 'Listed as unbranded' },
    { pattern: /no\s*box/i, flag: 'No original packaging' },
    { pattern: /no\s*receipt/i, flag: 'No receipt/proof of purchase' },
    { pattern: /no\s*dust\s*bag/i, flag: 'Missing dust bag' },
  ];
  
  for (const { pattern, flag } of suspiciousPatterns) {
    if (pattern.test(text)) {
      redFlags.push(flag);
    }
  }
  
  // Price red flags would need actual price data
  
  return {
    hasSerialNumber: /serial\s*(number|#|no)/i.test(textLower) || /\b[A-Z]{2}\d{4,}\b/.test(text),
    hasDateCode: /date\s*code/i.test(textLower) || /\b[A-Z]{2}\d{4}\b/.test(text),
    mentionsCertificate: /certificate|authenticity|coa|entrupy|real\s*authentication/i.test(textLower),
    mentionsAuthentic: /authentic|genuine|real|original/i.test(textLower),
    redFlags,
  };
}

/**
 * Build search query for luxury items
 */
function buildLuxurySearchQuery(
  itemName: string,
  brand?: string,
  style?: string
): { ebay: string; generic: string } {
  const parts: string[] = [];
  
  if (brand) {
    // Map brand ID to display name
    const brandNames: Record<string, string> = {
      'louis_vuitton': 'Louis Vuitton',
      'chanel': 'Chanel',
      'gucci': 'Gucci',
      'prada': 'Prada',
      'hermes': 'Hermes',
      'dior': 'Dior',
      'fendi': 'Fendi',
      'balenciaga': 'Balenciaga',
      'bottega_veneta': 'Bottega Veneta',
      'celine': 'Celine',
      'saint_laurent': 'Saint Laurent',
    };
    parts.push(brandNames[brand] || brand);
  }
  
  // Clean the item name
  let cleanName = itemName;
  SUPPORTED_LUXURY_BRANDS.forEach(b => {
    cleanName = cleanName.replace(new RegExp(b, 'gi'), '');
  });
  cleanName = cleanName.replace(/authentic|genuine|real/gi, '').trim();
  
  if (cleanName) parts.push(cleanName);
  if (style) parts.push(style);
  
  const genericQuery = parts.join(' ').replace(/\s+/g, ' ').trim();
  const ebayQuery = `${genericQuery} authentic`;
  
  return { ebay: ebayQuery, generic: genericQuery };
}

/**
 * Generate authentication recommendation
 */
function getAuthenticationRecommendation(
  brand: string,
  indicators: LuxurySearchResult['authenticityIndicators'],
  estimatedValue?: number
): string {
  const highValueBrands = ['hermes', 'chanel', 'louis_vuitton'];
  const isHighValueBrand = highValueBrands.includes(brand);
  
  if (indicators.redFlags.length >= 2) {
    return '⚠️ CAUTION: Multiple red flags detected. Professional authentication strongly recommended before purchase.';
  }
  
  if (indicators.redFlags.length === 1) {
    return '⚠️ One concern noted. Consider requesting additional photos or authentication.';
  }
  
  if (isHighValueBrand && !indicators.mentionsCertificate) {
    return '💡 High-value brand without authentication certificate. Consider Entrupy authentication for peace of mind.';
  }
  
  if (indicators.mentionsCertificate && indicators.hasSerialNumber) {
    return '✅ Good signs: Authentication mentioned and serial number present. Verify certificate is legitimate.';
  }
  
  if (!indicators.hasSerialNumber && !indicators.hasDateCode) {
    return '💡 No serial/date code mentioned. Request photos of authentication markers before purchase.';
  }
  
  return '✅ No obvious red flags. Standard due diligence recommended.';
}

/**
 * Generate pricing guidance for luxury items
 */
function getLuxuryPricingGuidance(brand: string, style?: string): string {
  const guidance: Record<string, string> = {
    'hermes': 'Hermès items, especially Birkin and Kelly bags, often appreciate. Authentication is critical as counterfeits are sophisticated.',
    'chanel': 'Chanel Classic Flaps appreciate 10-15% annually. Vintage pieces with original receipts command premiums.',
    'louis_vuitton': 'Louis Vuitton holds value well but is heavily counterfeited. Limited editions and discontinued styles have best ROI.',
    'gucci': 'Gucci vintage (Tom Ford era) is highly collectible. Current styles depreciate ~30% from retail.',
    'prada': 'Prada nylon bags from the 90s are collectible. Standard styles depreciate ~40% from retail.',
    'dior': 'Dior Lady Dior and Saddle bags are most collectible. Authentication is important.',
    'balenciaga': 'Balenciaga City bags peaked in value. Current demand varies by style.',
    'bottega_veneta': 'Bottega woven leather (Intrecciato) holds value well. Daniel Lee era pieces are gaining collectibility.',
  };
  
  return guidance[brand] || 'Research recent sales for this brand to establish fair market value. Authentication recommended for items over $500.';
}

// ==================== MAIN SEARCH FUNCTION ====================

/**
 * Main luxury search function
 */
export async function searchLuxury(request: LuxurySearchRequest): Promise<LuxurySearchResult> {
  const { query, checkAuthenticity = true } = request;
  
  // Check if this is a luxury item
  const isLuxury = isLuxuryItem(query);
  const detectedBrand = extractBrandFromText(query);
  
  // Brand display names
  const brandDisplayNames: Record<string, string> = {
    'louis_vuitton': 'Louis Vuitton',
    'chanel': 'Chanel',
    'gucci': 'Gucci',
    'prada': 'Prada',
    'hermes': 'Hermès',
    'dior': 'Dior',
    'fendi': 'Fendi',
    'balenciaga': 'Balenciaga',
    'bottega_veneta': 'Bottega Veneta',
    'celine': 'Céline',
    'givenchy': 'Givenchy',
    'saint_laurent': 'Saint Laurent',
    'burberry': 'Burberry',
    'coach': 'Coach',
    'goyard': 'Goyard',
    'loewe': 'Loewe',
  };
  
  // Analyze authenticity indicators
  const indicators = analyzeAuthenticityIndicators(query);
  
  // Build search queries
  const searchQueries = buildLuxurySearchQuery(query, detectedBrand || undefined);
  
  // Calculate confidence
  let confidence = 0.5;
  if (isLuxury && detectedBrand) {
    confidence = 0.9;
  } else if (isLuxury) {
    confidence = 0.7;
  } else if (detectedBrand) {
    confidence = 0.6;
  }
  
  // Get pricing guidance
  const pricingGuidance = detectedBrand ? getLuxuryPricingGuidance(detectedBrand) : undefined;
  
  // Get authentication recommendation
  const authenticationRecommendation = detectedBrand 
    ? getAuthenticationRecommendation(detectedBrand, indicators)
    : isLuxury 
      ? 'Unable to identify brand. Verify authenticity before purchase.'
      : undefined;
  
  // Optionally fetch comparable authentications from Entrupy
  let comparables: EntrupyItemData[] | undefined;
  if (detectedBrand && checkAuthenticity) {
    try {
      comparables = await searchEntrupyByBrand(detectedBrand, 3);
    } catch (error) {
      console.log('Could not fetch Entrupy comparables:', error);
    }
  }
  
  return {
    isLuxuryItem: isLuxury,
    detectedBrand: detectedBrand || undefined,
    brandDisplay: detectedBrand ? brandDisplayNames[detectedBrand] : undefined,
    confidence,
    searchQueries,
    authenticityIndicators: indicators,
    comparables,
    pricingGuidance,
    authenticationRecommendation,
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params = req.method === 'GET' ? req.query : req.body;
    
    const { query, entrupyId, customerId, checkAuthenticity } = params as LuxurySearchRequest;

    if (!query) {
      return res.status(400).json({ 
        error: 'Missing required parameter: query',
        examples: {
          POST: { query: 'Louis Vuitton Neverfull MM Monogram', checkAuthenticity: true },
          GET: '?query=Chanel+Classic+Flap+Black+Caviar'
        }
      });
    }

    const result = await searchLuxury({ 
      query: query as string,
      entrupyId: entrupyId as string,
      customerId: customerId as string,
      checkAuthenticity: checkAuthenticity === 'true' || checkAuthenticity === true,
    });
    
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Luxury search error:', error);
    return res.status(500).json({ 
      error: 'Luxury search failed',
      details: error.message 
    });
  }
}