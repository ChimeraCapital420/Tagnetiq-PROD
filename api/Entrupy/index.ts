// Entrupy API Fetcher
// Handles luxury goods authentication (Chanel, Louis Vuitton, Gucci, Prada, Hermes, etc.)
// API Docs: Based on Entrupy API v2 specification

import type { VercelRequest, VercelResponse } from '@vercel/node';

const ENTRUPY_API_BASE = process.env.ENTRUPY_API_BASE || 'https://api.entrupy.com';
const ENTRUPY_API_TOKEN = process.env.ENTRUPY_API_TOKEN;

// ==================== TYPES ====================

export interface EntrupyAuthenticationResponse {
  item: {
    entrupy_id: string;
    timestamp: {
      created_at: string;
      last_updated_at?: string;
    };
    status: {
      result: {
        id: 'authentic' | 'unidentified' | 'not_authentic' | 'inconclusive';
        final: boolean;
      };
      initial_result?: {
        id: string;
        final: boolean;
      };
      flag?: string;
    };
    activity: {
      form_factor: string;
      name: string;
      product_category: string;
      mode?: string;
    };
    properties: {
      customer_item_id?: string;
      brand?: string;
      material?: string;
    };
    owner?: {
      organization_id: string;
      user_id: string;
    };
    certificate?: {
      certificate_id: string;
      url: string;
    };
    text_fields?: Record<string, string>;
    images?: Array<{
      type: string;
      url: string;
    }>;
    catalog?: {
      product_information?: {
        brand: string;
        category: string;
        style: string;
        material: string;
        colorway: string;
        description: string;
      };
      condition_assessment?: {
        score: number;
        rating: string;
        issues: string[];
        details: Record<string, string>;
      };
      marketplace_listings?: Array<{
        platform: string;
        title: string;
        price: string;
        currency: string;
        link: string;
        confidence: number;
      }>;
    };
  };
}

export interface EntrupySearchResponse {
  items: EntrupyAuthenticationResponse['item'][];
  item_count: number;
  next_cursor?: string;
}

export interface EntrupyConfigResponse {
  config: {
    brands: Array<{
      brand_id: string;
      display: { name: string };
      materials: Array<{
        material_id: string;
        display: { name: string };
        details?: Array<{
          field_alias: string;
          display: { name: string };
        }>;
      }>;
    }>;
  };
  iat: number;
  exp: number;
}

export interface EntrupyItemData {
  source: 'entrupy';
  available: boolean;
  entrupyId?: string;
  authentication: {
    isAuthentic: boolean;
    result: string;
    isFinal: boolean;
    certificateUrl?: string;
    certificateId?: string;
  };
  product: {
    brand: string;
    category: string;
    style: string;
    material: string;
    colorway: string;
    description: string;
  };
  condition?: {
    score: number;
    rating: string;
    issues: string[];
    exteriorCondition?: string;
    interiorCondition?: string;
  };
  marketData?: {
    listings: Array<{
      platform: string;
      title: string;
      price: number;
      currency: string;
      url: string;
      confidence: number;
    }>;
    averagePrice?: number;
    priceRange?: { low: number; high: number };
  };
  images?: Array<{
    type: string;
    url: string;
  }>;
  metadata: {
    lookupTimestamp: string;
    apiSource: string;
    customerItemId?: string;
  };
  error?: string;
}

// ==================== SUPPORTED BRANDS ====================

export const SUPPORTED_LUXURY_BRANDS = [
  'louis vuitton', 'lv',
  'chanel',
  'gucci',
  'prada',
  'hermes', 'hermès',
  'dior', 'christian dior',
  'fendi',
  'balenciaga',
  'bottega veneta',
  'celine', 'céline',
  'givenchy',
  'valentino',
  'ysl', 'saint laurent', 'yves saint laurent',
  'burberry',
  'coach',
  'michael kors',
  'tory burch',
  'kate spade',
  'goyard',
  'loewe',
];

/**
 * Check if item is likely a luxury goods item
 */
export function isLuxuryItem(text: string): boolean {
  const textLower = text.toLowerCase();
  
  // Check for brand names
  if (SUPPORTED_LUXURY_BRANDS.some(brand => textLower.includes(brand))) {
    return true;
  }
  
  // Check for luxury item indicators
  const luxuryIndicators = [
    'designer bag', 'designer handbag', 'luxury bag',
    'authentic', 'authenticity', 'certificate of authenticity',
    'serial number', 'date code',
    'neverfull', 'speedy', 'birkin', 'kelly', 'classic flap',
    'monogram', 'damier', 'epi leather', 'caviar leather',
    'lambskin', 'calfskin', 'crocodile', 'ostrich',
  ];
  
  return luxuryIndicators.some(indicator => textLower.includes(indicator));
}

/**
 * Extract brand from text
 */
export function extractBrandFromText(text: string): string | null {
  const textLower = text.toLowerCase();
  
  const brandMappings: Record<string, string> = {
    'louis vuitton': 'louis_vuitton',
    'lv': 'louis_vuitton',
    'chanel': 'chanel',
    'gucci': 'gucci',
    'prada': 'prada',
    'hermes': 'hermes',
    'hermès': 'hermes',
    'dior': 'dior',
    'christian dior': 'dior',
    'fendi': 'fendi',
    'balenciaga': 'balenciaga',
    'bottega veneta': 'bottega_veneta',
    'celine': 'celine',
    'céline': 'celine',
    'givenchy': 'givenchy',
    'valentino': 'valentino',
    'ysl': 'saint_laurent',
    'saint laurent': 'saint_laurent',
    'yves saint laurent': 'saint_laurent',
    'burberry': 'burberry',
    'coach': 'coach',
    'goyard': 'goyard',
    'loewe': 'loewe',
  };
  
  for (const [key, value] of Object.entries(brandMappings)) {
    if (textLower.includes(key)) {
      return value;
    }
  }
  
  return null;
}

// ==================== API FUNCTIONS ====================

/**
 * Get authentication by Entrupy ID
 */
async function getAuthenticationById(entrupyId: string): Promise<EntrupyAuthenticationResponse | null> {
  if (!ENTRUPY_API_TOKEN) {
    console.error('❌ ENTRUPY_API_TOKEN not configured');
    return null;
  }

  try {
    const url = `${ENTRUPY_API_BASE}/v2/authentications/${entrupyId}?include_catalog=true&include_images=true`;
    console.log(`🔍 Entrupy API: Fetching authentication ${entrupyId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENTRUPY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Entrupy API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`✅ Entrupy API: Found authentication ${entrupyId}`);
    return data as EntrupyAuthenticationResponse;
    
  } catch (error) {
    console.error('❌ Entrupy API fetch error:', error);
    return null;
  }
}

/**
 * Lookup authentication by customer item ID
 */
async function lookupByCustomerId(customerId: string): Promise<EntrupyAuthenticationResponse | null> {
  if (!ENTRUPY_API_TOKEN) return null;

  try {
    const url = `${ENTRUPY_API_BASE}/v2/lookup/authentications/${customerId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ENTRUPY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    return await response.json() as EntrupyAuthenticationResponse;
    
  } catch (error) {
    console.error('❌ Entrupy lookup error:', error);
    return null;
  }
}

/**
 * Search authentications
 */
async function searchAuthentications(
  filters: Array<{ key: string; value: string }>,
  limit: number = 10
): Promise<EntrupySearchResponse | null> {
  if (!ENTRUPY_API_TOKEN) return null;

  try {
    const url = `${ENTRUPY_API_BASE}/v2/search/authentications`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENTRUPY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit,
        filters: filters.map(f => ({
          key: f.key,
          value: f.value,
          values: null,
          exclude: false,
          text_fields: null,
        })),
      }),
    });

    if (!response.ok) return null;
    return await response.json() as EntrupySearchResponse;
    
  } catch (error) {
    console.error('❌ Entrupy search error:', error);
    return null;
  }
}

/**
 * Get configuration (supported brands and materials)
 */
export async function getEntrupyConfig(): Promise<EntrupyConfigResponse | null> {
  if (!ENTRUPY_API_TOKEN) return null;

  try {
    const url = `${ENTRUPY_API_BASE}/v2/config/authentications`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ENTRUPY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    return await response.json() as EntrupyConfigResponse;
    
  } catch (error) {
    console.error('❌ Entrupy config error:', error);
    return null;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Parse price string to number
 */
function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Transform Entrupy API response to our standard format
 */
function transformEntrupyResponse(response: EntrupyAuthenticationResponse): EntrupyItemData {
  const item = response.item;
  const catalog = item.catalog;
  
  // Parse marketplace listings
  let marketData: EntrupyItemData['marketData'];
  if (catalog?.marketplace_listings && catalog.marketplace_listings.length > 0) {
    const listings = catalog.marketplace_listings.map(listing => ({
      platform: listing.platform,
      title: listing.title,
      price: parsePrice(listing.price),
      currency: listing.currency,
      url: listing.link,
      confidence: listing.confidence,
    }));
    
    const prices = listings.map(l => l.price).filter(p => p > 0);
    const averagePrice = prices.length > 0 
      ? prices.reduce((a, b) => a + b, 0) / prices.length 
      : undefined;
    
    marketData = {
      listings,
      averagePrice,
      priceRange: prices.length > 0 
        ? { low: Math.min(...prices), high: Math.max(...prices) }
        : undefined,
    };
  }
  
  return {
    source: 'entrupy',
    available: true,
    entrupyId: item.entrupy_id,
    authentication: {
      isAuthentic: item.status.result.id === 'authentic',
      result: item.status.result.id,
      isFinal: item.status.result.final,
      certificateUrl: item.certificate?.url,
      certificateId: item.certificate?.certificate_id,
    },
    product: {
      brand: catalog?.product_information?.brand || item.properties?.brand || '',
      category: catalog?.product_information?.category || '',
      style: catalog?.product_information?.style || '',
      material: catalog?.product_information?.material || item.properties?.material || '',
      colorway: catalog?.product_information?.colorway || '',
      description: catalog?.product_information?.description || '',
    },
    condition: catalog?.condition_assessment ? {
      score: catalog.condition_assessment.score,
      rating: catalog.condition_assessment.rating,
      issues: catalog.condition_assessment.issues || [],
      exteriorCondition: catalog.condition_assessment.details?.exterior_condition,
      interiorCondition: catalog.condition_assessment.details?.interior_condition,
    } : undefined,
    marketData,
    images: item.images,
    metadata: {
      lookupTimestamp: new Date().toISOString(),
      apiSource: 'entrupy',
      customerItemId: item.properties?.customer_item_id,
    },
  };
}

// ==================== MAIN EXPORT FUNCTIONS ====================

/**
 * Fetch Entrupy data by Entrupy ID
 */
export async function fetchEntrupyById(entrupyId: string): Promise<EntrupyItemData> {
  const response = await getAuthenticationById(entrupyId);
  
  if (!response) {
    return {
      source: 'entrupy',
      available: false,
      authentication: { isAuthentic: false, result: 'unknown', isFinal: false },
      product: { brand: '', category: '', style: '', material: '', colorway: '', description: '' },
      metadata: { lookupTimestamp: new Date().toISOString(), apiSource: 'entrupy' },
      error: 'Authentication not found',
    };
  }
  
  return transformEntrupyResponse(response);
}

/**
 * Fetch Entrupy data by customer item ID
 */
export async function fetchEntrupyByCustomerId(customerId: string): Promise<EntrupyItemData> {
  const response = await lookupByCustomerId(customerId);
  
  if (!response) {
    return {
      source: 'entrupy',
      available: false,
      authentication: { isAuthentic: false, result: 'unknown', isFinal: false },
      product: { brand: '', category: '', style: '', material: '', colorway: '', description: '' },
      metadata: { lookupTimestamp: new Date().toISOString(), apiSource: 'entrupy' },
      error: 'Item not found',
    };
  }
  
  return transformEntrupyResponse(response);
}

/**
 * Search for Entrupy authentications by brand
 */
export async function searchEntrupyByBrand(brandId: string, limit: number = 5): Promise<EntrupyItemData[]> {
  const response = await searchAuthentications([
    { key: 'properties.brand.id', value: brandId },
    { key: 'status.result.id', value: 'authentic' },
  ], limit);
  
  if (!response || !response.items) {
    return [];
  }
  
  return response.items.map(item => 
    transformEntrupyResponse({ item })
  );
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params = req.method === 'GET' ? req.query : req.body;
    const { entrupyId, customerId, brandId, action } = params;

    if (action === 'config') {
      const config = await getEntrupyConfig();
      return res.status(200).json(config || { error: 'Config not available' });
    }

    if (entrupyId) {
      const result = await fetchEntrupyById(entrupyId as string);
      return res.status(200).json(result);
    }

    if (customerId) {
      const result = await fetchEntrupyByCustomerId(customerId as string);
      return res.status(200).json(result);
    }

    if (brandId) {
      const results = await searchEntrupyByBrand(brandId as string);
      return res.status(200).json({ items: results, count: results.length });
    }

    return res.status(400).json({ 
      error: 'Missing required parameter: entrupyId, customerId, or brandId',
      examples: {
        byId: '/api/entrupy?entrupyId=ENTPY12345',
        byCustomerId: '/api/entrupy?customerId=SKU9876',
        byBrand: '/api/entrupy?brandId=louis_vuitton',
        config: '/api/entrupy?action=config',
      }
    });

  } catch (error: any) {
    console.error('Entrupy API handler error:', error);
    return res.status(500).json({ 
      error: 'Entrupy lookup failed',
      details: error.message 
    });
  }
}