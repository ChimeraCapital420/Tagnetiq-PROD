// FILE: src/lib/hydra/fetchers/psa.ts
// HYDRA v5.2 - PSA (Professional Sports Authenticator) Fetcher
// Verifies graded cards/memorabilia certification
// API Key: Already configured in Vercel ENV as PSA_API_KEY

import type { MarketDataSource, AuthorityData } from '../types.js';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';

export interface PSACertData {
  certNumber: string;
  grade: string;
  gradeDescription: string;
  cardYear: string;
  cardBrand: string;
  cardCategory: string;
  cardSubject: string;
  cardVariety: string;
  cardNumber: string;
  totalPopulation: number;
  populationHigher: number;
  labelType: string;
  reverseBarcode: string;
  specNumber: string;
  specId: number;
  isCrossedOver: boolean;
  isGradeChanged: boolean;
  certDate: string;
}

export async function fetchPsaData(itemName: string, certNumber?: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  const apiKey = process.env.PSA_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ PSA API key not configured');
    return createFallbackResult(itemName, certNumber);
  }
  
  try {
    // Try to extract cert number from item name if not provided
    const cert = certNumber || extractCertNumber(itemName);
    
    if (!cert) {
      console.log('⚠️ PSA: No cert number found in item name');
      return {
        source: 'psa',
        available: false,
        query: itemName,
        totalListings: 0,
        error: 'No PSA certification number found. Include cert# in item name or provide separately.',
      };
    }
    
    console.log(`🔍 PSA cert lookup: ${cert}`);
    
    // PSA Cert Verification API
    const response = await fetch(`${PSA_API_BASE}/cert/GetByCertNumber/${cert}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`⚠️ PSA: Cert ${cert} not found`);
        return {
          source: 'psa',
          available: false,
          query: cert,
          totalListings: 0,
          error: `PSA certification #${cert} not found in database`,
        };
      }
      
      console.error(`❌ PSA API error: ${response.status}`);
      return createFallbackResult(itemName, cert);
    }
    
    const data = await response.json() as PSACertData;
    console.log(`✅ PSA: Found ${data.cardSubject} - Grade ${data.grade}`);
    
    // Fetch population data for value estimation
    const popData = await fetchPopulationData(data.specId, apiKey);
    
    // Calculate estimated value based on grade and population
    const valueEstimate = estimateValue(data, popData);
    
    // Build authority data
    const authorityData: AuthorityData = {
      source: 'psa',
      verified: true,
      confidence: 0.99, // PSA cert verification is definitive
      itemDetails: {
        certNumber: data.certNumber,
        grade: data.grade,
        gradeDescription: data.gradeDescription,
        gradeNumeric: parseGradeNumeric(data.grade),
        year: data.cardYear,
        brand: data.cardBrand,
        category: data.cardCategory,
        subject: data.cardSubject,
        variety: data.cardVariety,
        cardNumber: data.cardNumber,
        labelType: data.labelType,
        specNumber: data.specNumber,
        certDate: data.certDate,
        isCrossedOver: data.isCrossedOver,
        isGradeChanged: data.isGradeChanged,
        population: {
          total: data.totalPopulation,
          higher: data.populationHigher,
          same: data.totalPopulation - data.populationHigher,
        },
        // Construct full item description
        fullDescription: buildFullDescription(data),
        // PSA cert page URL
        certUrl: `https://www.psacard.com/cert/${data.certNumber}`,
      },
      priceData: valueEstimate ? {
        market: valueEstimate.estimated,
        conditions: [{
          condition: `PSA ${data.grade}`,
          price: valueEstimate.estimated,
        }],
      } : undefined,
      externalUrl: `https://www.psacard.com/cert/${data.certNumber}`,
      lastUpdated: new Date().toISOString(),
    };
    
    // Build sample listings (search URLs for marketplaces)
    const searchQuery = `PSA ${data.grade} ${data.cardYear} ${data.cardSubject} ${data.cardBrand}`;
    const sampleListings = [
      {
        title: `View PSA Cert #${data.certNumber}`,
        price: valueEstimate?.estimated || 0,
        condition: `PSA ${data.grade}`,
        url: `https://www.psacard.com/cert/${data.certNumber}`,
      },
      {
        title: `Search eBay for ${data.cardSubject} PSA ${data.grade}`,
        price: 0,
        condition: 'eBay Listings',
        url: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&LH_Sold=1`,
      },
      {
        title: `Search PWCC for ${data.cardSubject}`,
        price: 0,
        condition: 'Auction House',
        url: `https://www.pwccmarketplace.com/search?q=${encodeURIComponent(searchQuery)}`,
      },
    ];
    
    console.log(`✅ PSA: Authority data retrieved in ${Date.now() - startTime}ms`);
    
    return {
      source: 'psa',
      available: true,
      query: cert,
      totalListings: 1,
      priceAnalysis: valueEstimate ? {
        lowest: valueEstimate.low,
        highest: valueEstimate.high,
        average: valueEstimate.estimated,
        median: valueEstimate.estimated,
      } : undefined,
      suggestedPrices: valueEstimate ? {
        goodDeal: parseFloat((valueEstimate.low * 0.95).toFixed(2)),
        fairMarket: valueEstimate.estimated,
        sellPrice: parseFloat((valueEstimate.high * 0.9).toFixed(2)),
      } : undefined,
      sampleListings,
      authorityData,
      metadata: {
        responseTime: Date.now() - startTime,
        certNumber: data.certNumber,
        grade: data.grade,
        population: data.totalPopulation,
        specId: data.specId,
      },
    };
    
  } catch (error) {
    console.error('❌ PSA fetch error:', error);
    return {
      source: 'psa',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

function extractCertNumber(itemName: string): string | null {
  // Common patterns for PSA cert numbers
  const patterns = [
    /PSA\s*#?\s*(\d{8,})/i,           // "PSA #12345678" or "PSA 12345678"
    /cert\s*#?\s*(\d{8,})/i,          // "cert #12345678"
    /certification\s*#?\s*(\d{8,})/i, // "certification #12345678"
    /#(\d{8,})/,                       // Just "#12345678"
    /\b(\d{8,10})\b/,                  // 8-10 digit number (PSA certs are typically 8-10 digits)
  ];
  
  for (const pattern of patterns) {
    const match = itemName.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

function parseGradeNumeric(grade: string): number {
  // Extract numeric grade from strings like "GEM-MT 10", "MINT 9", "NM-MT 8"
  const match = grade.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function buildFullDescription(data: PSACertData): string {
  const parts = [
    data.cardYear,
    data.cardBrand,
    data.cardSubject,
    data.cardVariety,
    data.cardNumber ? `#${data.cardNumber}` : '',
    `PSA ${data.grade}`,
  ].filter(Boolean);
  
  return parts.join(' ');
}

async function fetchPopulationData(specId: number, apiKey: string): Promise<any> {
  try {
    const response = await fetch(`${PSA_API_BASE}/pop/GetItemPopulation/${specId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function estimateValue(data: PSACertData, popData: any): { low: number; estimated: number; high: number } | null {
  // This is a simplified estimation model
  // Real implementation would use historical sales data
  
  const gradeNum = parseGradeNumeric(data.grade);
  if (gradeNum === 0) return null;
  
  // Base value multipliers by grade
  const gradeMultipliers: Record<number, number> = {
    10: 10.0,   // Gem Mint
    9.5: 5.0,   // Gem Mint (half point)
    9: 2.5,     // Mint
    8.5: 1.8,
    8: 1.5,     // NM-MT
    7.5: 1.2,
    7: 1.0,     // NM
    6: 0.7,     // EX-MT
    5: 0.5,     // EX
    4: 0.35,    // VG-EX
    3: 0.25,    // VG
    2: 0.15,    // Good
    1: 0.10,    // Poor
  };
  
  const multiplier = gradeMultipliers[gradeNum] || 1.0;
  
  // Population scarcity factor
  let scarcityFactor = 1.0;
  if (data.totalPopulation < 10) {
    scarcityFactor = 3.0;  // Very rare
  } else if (data.totalPopulation < 50) {
    scarcityFactor = 2.0;  // Rare
  } else if (data.totalPopulation < 200) {
    scarcityFactor = 1.5;  // Uncommon
  } else if (data.totalPopulation > 1000) {
    scarcityFactor = 0.8;  // Common
  }
  
  // Base estimate (would normally come from market data)
  // This is a placeholder - real values need market integration
  const baseValue = 50; // Minimum base value
  const estimated = baseValue * multiplier * scarcityFactor;
  
  return {
    low: parseFloat((estimated * 0.7).toFixed(2)),
    estimated: parseFloat(estimated.toFixed(2)),
    high: parseFloat((estimated * 1.5).toFixed(2)),
  };
}

function createFallbackResult(itemName: string, certNumber?: string): MarketDataSource {
  const searchUrl = certNumber 
    ? `https://www.psacard.com/cert/${certNumber}`
    : `https://www.psacard.com/certlookup`;
  
  return {
    source: 'psa',
    available: true,
    query: certNumber || itemName,
    totalListings: 0,
    sampleListings: [{
      title: certNumber ? `Lookup PSA Cert #${certNumber}` : 'PSA Cert Lookup Tool',
      price: 0,
      condition: 'N/A',
      url: searchUrl,
    }],
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}

// ==================== BATCH VERIFICATION ====================

export async function verifyPsaCerts(certNumbers: string[]): Promise<Map<string, PSACertData | null>> {
  const apiKey = process.env.PSA_API_KEY;
  const results = new Map<string, PSACertData | null>();
  
  if (!apiKey) {
    certNumbers.forEach(cert => results.set(cert, null));
    return results;
  }
  
  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < certNumbers.length; i += batchSize) {
    const batch = certNumbers.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (cert) => {
      try {
        const response = await fetch(`${PSA_API_BASE}/cert/GetByCertNumber/${cert}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          results.set(cert, data);
        } else {
          results.set(cert, null);
        }
      } catch {
        results.set(cert, null);
      }
    }));
    
    // Small delay between batches
    if (i + batchSize < certNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}