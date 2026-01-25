// PSA (Professional Sports Authenticator) API Fetcher
// Handles graded sports cards, Pokemon cards, and other collectible cards
// API Docs: https://api.psacard.com/publicapi/

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PSA_API_BASE = 'https://api.psacard.com/publicapi';
const PSA_API_TOKEN = process.env.PSA_API_TOKEN;

// ==================== TYPES ====================

interface PSACertResponse {
  PSACert: {
    CertNumber: string;
    SpecID: number;
    SpecNumber: string;
    LabelType: string;
    ReverseBarCode: boolean;
    Year: string;
    Brand: string;
    Category: string;
    CardNumber: string;
    Subject: string;
    Variety: string;
    IsPSADNA: boolean;
    IsDualCert: boolean;
    GradeDescription: string;
    CardGrade: string;
    PrimarySigners: string[];
    OtherSigners: string[];
    AutographGrade: string;
    TotalPopulation: number;
    TotalPopulationWithQualifier: number;
    PopulationHigher: number;
    T206PopulationAllBacks: number;
    T206PopulationHigherAllBacks: number;
    ItemStatus: string;
  };
}

interface PSAPopulationResponse {
  PSASpecPopulationModel: {
    SpecID: number;
    SpecNumber: string;
    Year: string;
    Brand: string;
    Category: string;
    Subject: string;
    CardNumber: string;
    Variety: string;
    TotalGraded: number;
    GradeCounts: {
      Grade: string;
      Count: number;
    }[];
  };
}

interface PSAImagesResponse {
  Images: {
    FrontImageURL: string;
    BackImageURL: string;
  };
}

export interface PSACardData {
  source: 'psa';
  available: boolean;
  certNumber: string;
  card: {
    year: string;
    brand: string;
    category: string;
    cardNumber: string;
    subject: string;
    variety: string;
    fullName: string;
  };
  grade: {
    grade: string;
    gradeDescription: string;
    labelType: string;
    autographGrade?: string;
  };
  population: {
    totalAtGrade: number;
    totalWithQualifier: number;
    populationHigher: number;
    scarcityRating: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'ultra_rare';
    scarcityNote: string;
  };
  authentication: {
    isPSADNA: boolean;
    isDualCert: boolean;
    primarySigners: string[];
    otherSigners: string[];
    isAuthentic: boolean;
    itemStatus: string;
  };
  images?: {
    front?: string;
    back?: string;
  };
  specId?: number;
  metadata: {
    certVerified: boolean;
    lookupTimestamp: string;
    apiSource: string;
  };
  error?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate scarcity rating based on population data
 */
function calculateScarcity(
  totalAtGrade: number, 
  populationHigher: number,
  grade: string
): { rating: PSACardData['population']['scarcityRating']; note: string } {
  const gradeNum = parseFloat(grade) || 0;
  
  // PSA 10s are always special
  if (gradeNum === 10) {
    if (totalAtGrade <= 10) {
      return { rating: 'ultra_rare', note: `Only ${totalAtGrade} PSA 10 exists - extremely rare` };
    } else if (totalAtGrade <= 50) {
      return { rating: 'very_rare', note: `Only ${totalAtGrade} PSA 10s exist - very scarce` };
    } else if (totalAtGrade <= 200) {
      return { rating: 'rare', note: `${totalAtGrade} PSA 10s exist - relatively scarce` };
    } else if (totalAtGrade <= 1000) {
      return { rating: 'uncommon', note: `${totalAtGrade} PSA 10s exist - moderate population` };
    } else {
      return { rating: 'common', note: `${totalAtGrade} PSA 10s exist - high population` };
    }
  }
  
  // PSA 9s
  if (gradeNum === 9) {
    if (totalAtGrade <= 25) {
      return { rating: 'very_rare', note: `Only ${totalAtGrade} PSA 9s exist` };
    } else if (totalAtGrade <= 100) {
      return { rating: 'rare', note: `${totalAtGrade} PSA 9s exist` };
    } else if (totalAtGrade <= 500) {
      return { rating: 'uncommon', note: `${totalAtGrade} PSA 9s, ${populationHigher} graded higher` };
    } else {
      return { rating: 'common', note: `${totalAtGrade} PSA 9s exist` };
    }
  }
  
  // Lower grades
  if (totalAtGrade <= 50) {
    return { rating: 'rare', note: `Only ${totalAtGrade} at PSA ${grade}` };
  } else if (totalAtGrade <= 200) {
    return { rating: 'uncommon', note: `${totalAtGrade} at PSA ${grade}` };
  } else {
    return { rating: 'common', note: `${totalAtGrade} at PSA ${grade}` };
  }
}

/**
 * Build full card name from PSA data
 */
function buildFullCardName(cert: PSACertResponse['PSACert']): string {
  const parts: string[] = [];
  
  if (cert.Year) parts.push(cert.Year);
  if (cert.Brand) parts.push(cert.Brand);
  if (cert.Subject) parts.push(cert.Subject);
  if (cert.CardNumber) parts.push(`#${cert.CardNumber}`);
  if (cert.Variety) parts.push(cert.Variety);
  
  const baseName = parts.join(' ');
  return `${baseName} PSA ${cert.CardGrade}`;
}

/**
 * Extract cert number from various formats
 * Handles: "12345678", "PSA 12345678", "Cert #12345678", etc.
 */
export function extractCertNumber(input: string): string | null {
  // Remove common prefixes and clean up
  const cleaned = input
    .toUpperCase()
    .replace(/PSA\s*/gi, '')
    .replace(/CERT\.?\s*#?\s*/gi, '')
    .replace(/NUMBER\s*/gi, '')
    .replace(/[^0-9]/g, '');
  
  // PSA cert numbers are typically 8 digits
  if (cleaned.length >= 7 && cleaned.length <= 10) {
    return cleaned;
  }
  
  return null;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch card data by PSA cert number
 */
async function fetchByCertNumber(certNumber: string): Promise<PSACertResponse | null> {
  if (!PSA_API_TOKEN) {
    console.error('❌ PSA_API_TOKEN not configured');
    return null;
  }

  try {
    const url = `${PSA_API_BASE}/cert/GetByCertNumber/${certNumber}`;
    console.log(`🔍 PSA API: Fetching cert ${certNumber}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PSA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ PSA API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    // Check for PSA's "valid request but no data" response
    if (data.IsValidRequest === true && data.ServerMessage === 'No data found') {
      console.log(`⚠️ PSA: No data found for cert ${certNumber}`);
      return null;
    }
    
    // Check for invalid request
    if (data.IsValidRequest === false) {
      console.log(`⚠️ PSA: Invalid cert number ${certNumber}`);
      return null;
    }

    console.log(`✅ PSA API: Found cert ${certNumber} - ${data.PSACert?.Subject || 'Unknown'}`);
    return data as PSACertResponse;
    
  } catch (error) {
    console.error('❌ PSA API fetch error:', error);
    return null;
  }
}

/**
 * Fetch card images by cert number
 */
async function fetchImagesByCertNumber(certNumber: string): Promise<PSAImagesResponse | null> {
  if (!PSA_API_TOKEN) return null;

  try {
    const url = `${PSA_API_BASE}/cert/GetImagesByCertNumber/${certNumber}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PSA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    return data as PSAImagesResponse;
    
  } catch (error) {
    console.error('❌ PSA Images API error:', error);
    return null;
  }
}

/**
 * Fetch population data by spec ID
 */
async function fetchPopulationBySpecId(specId: number): Promise<PSAPopulationResponse | null> {
  if (!PSA_API_TOKEN) return null;

  try {
    const url = `${PSA_API_BASE}/pop/GetPSASpecPopulation/${specId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PSA_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;
    
    const data = await response.json();
    return data as PSAPopulationResponse;
    
  } catch (error) {
    console.error('❌ PSA Population API error:', error);
    return null;
  }
}

// ==================== MAIN EXPORT FUNCTION ====================

/**
 * Main function to fetch PSA card data
 * Can be called from analyze.ts
 */
export async function fetchPSAData(
  certNumber: string,
  includeImages: boolean = false
): Promise<PSACardData> {
  const startTime = Date.now();
  
  // Clean and validate cert number
  const cleanCert = extractCertNumber(certNumber);
  
  if (!cleanCert) {
    return {
      source: 'psa',
      available: false,
      certNumber: certNumber,
      card: { year: '', brand: '', category: '', cardNumber: '', subject: '', variety: '', fullName: '' },
      grade: { grade: '', gradeDescription: '', labelType: '' },
      population: { totalAtGrade: 0, totalWithQualifier: 0, populationHigher: 0, scarcityRating: 'common', scarcityNote: '' },
      authentication: { isPSADNA: false, isDualCert: false, primarySigners: [], otherSigners: [], isAuthentic: false, itemStatus: '' },
      metadata: { certVerified: false, lookupTimestamp: new Date().toISOString(), apiSource: 'psa' },
      error: 'Invalid cert number format',
    };
  }

  // Fetch main cert data
  const certData = await fetchByCertNumber(cleanCert);
  
  if (!certData || !certData.PSACert) {
    return {
      source: 'psa',
      available: false,
      certNumber: cleanCert,
      card: { year: '', brand: '', category: '', cardNumber: '', subject: '', variety: '', fullName: '' },
      grade: { grade: '', gradeDescription: '', labelType: '' },
      population: { totalAtGrade: 0, totalWithQualifier: 0, populationHigher: 0, scarcityRating: 'common', scarcityNote: '' },
      authentication: { isPSADNA: false, isDualCert: false, primarySigners: [], otherSigners: [], isAuthentic: false, itemStatus: '' },
      metadata: { certVerified: false, lookupTimestamp: new Date().toISOString(), apiSource: 'psa' },
      error: 'Cert not found in PSA database',
    };
  }

  const cert = certData.PSACert;
  
  // Calculate scarcity
  const scarcity = calculateScarcity(
    cert.TotalPopulation,
    cert.PopulationHigher,
    cert.CardGrade
  );

  // Build result
  const result: PSACardData = {
    source: 'psa',
    available: true,
    certNumber: cleanCert,
    card: {
      year: cert.Year || '',
      brand: cert.Brand || '',
      category: cert.Category || '',
      cardNumber: cert.CardNumber || '',
      subject: cert.Subject || '',
      variety: cert.Variety || '',
      fullName: buildFullCardName(cert),
    },
    grade: {
      grade: cert.CardGrade || '',
      gradeDescription: cert.GradeDescription || '',
      labelType: cert.LabelType || '',
      autographGrade: cert.AutographGrade || undefined,
    },
    population: {
      totalAtGrade: cert.TotalPopulation || 0,
      totalWithQualifier: cert.TotalPopulationWithQualifier || 0,
      populationHigher: cert.PopulationHigher || 0,
      scarcityRating: scarcity.rating,
      scarcityNote: scarcity.note,
    },
    authentication: {
      isPSADNA: cert.IsPSADNA || false,
      isDualCert: cert.IsDualCert || false,
      primarySigners: cert.PrimarySigners || [],
      otherSigners: cert.OtherSigners || [],
      isAuthentic: true, // If cert exists in PSA database, it's authentic
      itemStatus: cert.ItemStatus || 'Active',
    },
    specId: cert.SpecID,
    metadata: {
      certVerified: true,
      lookupTimestamp: new Date().toISOString(),
      apiSource: 'psa',
    },
  };

  // Optionally fetch images
  if (includeImages) {
    const imageData = await fetchImagesByCertNumber(cleanCert);
    if (imageData?.Images) {
      result.images = {
        front: imageData.Images.FrontImageURL,
        back: imageData.Images.BackImageURL,
      };
    }
  }

  console.log(`✅ PSA lookup complete in ${Date.now() - startTime}ms: ${result.card.fullName}`);
  return result;
}

/**
 * Search for PSA card by name (builds eBay search query)
 * Since PSA doesn't have name search, we return a formatted query for eBay
 */
export function buildPSASearchQuery(
  subject: string,
  year?: string,
  brand?: string,
  grade?: string
): string {
  const parts: string[] = [];
  
  if (year) parts.push(year);
  if (brand) parts.push(brand);
  if (subject) parts.push(subject);
  parts.push('PSA');
  if (grade) parts.push(grade);
  
  return parts.join(' ');
}

// ==================== API HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { certNumber, includeImages } = req.method === 'GET' 
      ? req.query 
      : req.body;

    if (!certNumber || typeof certNumber !== 'string') {
      return res.status(400).json({ 
        error: 'Missing required parameter: certNumber',
        example: '/api/psa?certNumber=12345678'
      });
    }

    const result = await fetchPSAData(certNumber, includeImages === 'true' || includeImages === true);
    
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('PSA API handler error:', error);
    return res.status(500).json({ 
      error: 'PSA lookup failed',
      details: error.message 
    });
  }
}