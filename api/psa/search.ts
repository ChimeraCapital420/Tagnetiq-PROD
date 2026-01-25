// PSA Search Helper
// PSA doesn't have name-based search, so this module:
// 1. Extracts cert numbers from text/images
// 2. Builds optimized eBay search queries for PSA graded items
// 3. Provides population-aware pricing guidance

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchPSAData, extractCertNumber, type PSACardData } from './index';

// ==================== TYPES ====================

export interface PSASearchRequest {
  query: string;           // User's search query or item name
  certNumber?: string;     // Optional: if cert number is already known
  category?: string;       // Optional: sports_cards, pokemon_cards, etc.
  grade?: string;          // Optional: desired grade (PSA 10, PSA 9, etc.)
}

export interface PSASearchResult {
  certFound: boolean;
  certData?: PSACardData;
  searchQueries: {
    ebay: string;
    generic: string;
  };
  gradeInfo?: {
    grade: string;
    gradeDescription: string;
    populationAtGrade: number;
    populationHigher: number;
    scarcityRating: string;
    pricingGuidance: string;
  };
  detectedCertNumbers: string[];
}

// ==================== CERT NUMBER DETECTION ====================

/**
 * Extract all potential PSA cert numbers from text
 * PSA certs are typically 8-digit numbers
 */
export function findCertNumbersInText(text: string): string[] {
  const certNumbers: string[] = [];
  
  // Pattern 1: Explicit PSA cert mentions
  const psaPatterns = [
    /PSA\s*#?\s*(\d{7,10})/gi,
    /cert(?:ificate)?\s*#?\s*(\d{7,10})/gi,
    /certification\s*#?\s*(\d{7,10})/gi,
  ];
  
  for (const pattern of psaPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length >= 7 && match[1].length <= 10) {
        certNumbers.push(match[1]);
      }
    }
  }
  
  // Pattern 2: Standalone 8-digit numbers (likely cert numbers in context)
  const standalonePattern = /\b(\d{8})\b/g;
  let match;
  while ((match = standalonePattern.exec(text)) !== null) {
    // Avoid years (1900-2030) and common non-cert numbers
    const num = parseInt(match[1]);
    if (num > 10000000 && !certNumbers.includes(match[1])) {
      certNumbers.push(match[1]);
    }
  }
  
  return [...new Set(certNumbers)]; // Remove duplicates
}

/**
 * Detect if text mentions PSA grading
 */
export function detectPSAMention(text: string): boolean {
  const psaIndicators = [
    /\bPSA\b/i,
    /\bPSA\s*\d+\b/i,       // PSA 10, PSA 9, etc.
    /\bPSA\s*GEM\b/i,       // PSA GEM
    /\bGEM[\s-]*MT\b/i,     // GEM-MT
    /\bMINT\s*\d+\b/i,      // MINT 10
    /graded\s+card/i,
    /slabbed/i,
    /professional\s+sports\s+authenticator/i,
  ];
  
  return psaIndicators.some(pattern => pattern.test(text));
}

/**
 * Extract grade from text (PSA 10, PSA 9, etc.)
 */
export function extractGradeFromText(text: string): string | null {
  const gradePatterns = [
    /PSA\s*(\d+(?:\.\d)?)/i,
    /GEM[\s-]*MT\s*(\d+)/i,
    /MINT\s*(\d+)/i,
    /grade[d]?\s*(\d+(?:\.\d)?)/i,
  ];
  
  for (const pattern of gradePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// ==================== SEARCH QUERY BUILDING ====================

/**
 * Build optimized eBay search query for PSA graded items
 */
export function buildEbaySearchQuery(
  itemName: string,
  grade?: string,
  year?: string,
  brand?: string
): string {
  const parts: string[] = [];
  
  // Clean item name - remove existing PSA references to avoid duplication
  let cleanName = itemName
    .replace(/PSA\s*\d+/gi, '')
    .replace(/GEM[\s-]*MT/gi, '')
    .replace(/graded/gi, '')
    .replace(/slabbed/gi, '')
    .trim();
  
  if (year) parts.push(year);
  if (brand) parts.push(brand);
  parts.push(cleanName);
  parts.push('PSA');
  if (grade) parts.push(grade);
  
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Generate pricing guidance based on population data
 */
function generatePricingGuidance(
  grade: string,
  populationAtGrade: number,
  populationHigher: number
): string {
  const gradeNum = parseFloat(grade) || 0;
  
  if (gradeNum === 10) {
    if (populationAtGrade <= 5) {
      return 'ULTRA RARE - Extreme premium expected. Verify recent sales carefully.';
    } else if (populationAtGrade <= 25) {
      return 'Very low population PSA 10 - Significant premium over PSA 9 expected.';
    } else if (populationAtGrade <= 100) {
      return 'Low population PSA 10 - Premium pricing, compare to recent sales.';
    } else if (populationAtGrade <= 500) {
      return 'Moderate PSA 10 population - Standard gem mint premium applies.';
    } else {
      return 'High PSA 10 population - Pricing should be competitive, many available.';
    }
  }
  
  if (gradeNum === 9) {
    if (populationHigher <= 10) {
      return 'Very few grade higher - This PSA 9 commands near-PSA 10 premium.';
    } else if (populationHigher <= 50) {
      return 'Low pop higher - Strong PSA 9 value, limited upgrade potential.';
    } else {
      return 'Standard PSA 9 - Price based on typical PSA 9 market.';
    }
  }
  
  return `PSA ${grade} - Value based on condition and market demand.`;
}

// ==================== MAIN SEARCH FUNCTION ====================

/**
 * Main PSA search function
 * Attempts to find cert data and builds search queries
 */
export async function searchPSA(request: PSASearchRequest): Promise<PSASearchResult> {
  const { query, certNumber, category, grade } = request;
  
  // Find all cert numbers in the query
  const detectedCertNumbers = findCertNumbersInText(query);
  
  // Use provided cert number or first detected one
  const certToLookup = certNumber || detectedCertNumbers[0];
  
  let certData: PSACardData | undefined;
  
  // If we have a cert number, look it up
  if (certToLookup) {
    certData = await fetchPSAData(certToLookup);
    if (!certData.available) {
      certData = undefined;
    }
  }
  
  // Build search queries
  const extractedGrade = grade || extractGradeFromText(query);
  
  let ebayQuery: string;
  let genericQuery: string;
  
  if (certData?.available) {
    // Use PSA data to build precise query
    ebayQuery = buildEbaySearchQuery(
      certData.card.subject,
      certData.grade.grade,
      certData.card.year,
      certData.card.brand
    );
    genericQuery = certData.card.fullName;
  } else {
    // Build query from user input
    ebayQuery = buildEbaySearchQuery(query, extractedGrade);
    genericQuery = query;
  }
  
  // Build grade info if we have cert data
  let gradeInfo: PSASearchResult['gradeInfo'];
  if (certData?.available) {
    gradeInfo = {
      grade: certData.grade.grade,
      gradeDescription: certData.grade.gradeDescription,
      populationAtGrade: certData.population.totalAtGrade,
      populationHigher: certData.population.populationHigher,
      scarcityRating: certData.population.scarcityRating,
      pricingGuidance: generatePricingGuidance(
        certData.grade.grade,
        certData.population.totalAtGrade,
        certData.population.populationHigher
      ),
    };
  }
  
  return {
    certFound: !!certData?.available,
    certData,
    searchQueries: {
      ebay: ebayQuery,
      generic: genericQuery,
    },
    gradeInfo,
    detectedCertNumbers,
  };
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const params = req.method === 'GET' ? req.query : req.body;
    
    const { query, certNumber, category, grade } = params as PSASearchRequest;

    if (!query && !certNumber) {
      return res.status(400).json({ 
        error: 'Missing required parameter: query or certNumber',
        example: {
          POST: { query: '2020 Topps Mike Trout PSA 10', grade: '10' },
          GET: '?query=2020+Topps+Mike+Trout&certNumber=12345678'
        }
      });
    }

    const result = await searchPSA({ 
      query: query || '', 
      certNumber: certNumber as string,
      category: category as string,
      grade: grade as string,
    });
    
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('PSA search error:', error);
    return res.status(500).json({ 
      error: 'PSA search failed',
      details: error.message 
    });
  }
}