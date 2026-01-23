import type { VercelRequest, VercelResponse } from '@vercel/node';

// Brickset LEGO Price Check API
// Searches for LEGO sets and retrieves pricing data

const BRICKSET_API_URL = 'https://brickset.com/api/v3.asmx';

interface BricksetSet {
  setID: number;
  number: string;
  numberVariant: number;
  name: string;
  year: number;
  theme: string;
  themeGroup: string;
  subtheme?: string;
  category: string;
  pieces?: number;
  minifigs?: number;
  image?: {
    thumbnailURL?: string;
    imageURL?: string;
  };
  bricksetURL: string;
  LEGOCom?: {
    US?: {
      retailPrice?: number;
      dateFirstAvailable?: string;
      dateLastAvailable?: string;
    };
    UK?: {
      retailPrice?: number;
    };
    CA?: {
      retailPrice?: number;
    };
  };
  rating?: number;
  reviewCount?: number;
  packagingType?: string;
  availability?: string;
  instructionsCount?: number;
  additionalImageCount?: number;
  ageRange?: {
    min?: number;
    max?: number;
  };
}

interface PriceResult {
  setNumber: string;
  name: string;
  year: number;
  theme: string;
  pieces?: number;
  minifigs?: number;
  retailPrice?: number;
  currency: string;
  availability: string;
  estimatedValue?: number;
  images: {
    thumbnail?: string;
    full?: string;
  };
  bricksetUrl: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BRICKSET_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brickset API key not configured' });
  }

  // Parse query parameters
  const { 
    q,              // Search query (required unless setNumber provided)
    setNumber,      // Direct set number lookup like "75192" (optional)
    limit = '10'    // Results to analyze
  } = req.query;

  if (!q && !setNumber) {
    return res.status(400).json({ 
      error: 'Missing required parameter: q (search query) or setNumber',
      examples: [
        '/api/brickset/price-check?q=millennium+falcon',
        '/api/brickset/price-check?setNumber=75192'
      ]
    });
  }

  try {
    // Build search parameters
    const searchParams: Record<string, any> = {
      pageSize: Math.min(parseInt(limit as string) || 10, 50),
      orderBy: 'YearFromDESC', // Newest first
    };

    if (q && typeof q === 'string') {
      searchParams.query = q;
    }

    if (setNumber && typeof setNumber === 'string') {
      searchParams.setNumber = setNumber;
    }

    const searchUrl = `${BRICKSET_API_URL}/getSets?apiKey=${encodeURIComponent(apiKey)}&params=${encodeURIComponent(JSON.stringify(searchParams))}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Brickset API error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: 'Brickset API error',
        status: response.status,
        message: errorText.substring(0, 200),
      });
    }

    const data = await response.json();

    if (data.status !== 'success') {
      return res.status(400).json({
        error: 'Brickset search failed',
        message: data.message || 'Unknown error',
      });
    }

    const sets: BricksetSet[] = data.sets || [];

    if (sets.length === 0) {
      return res.status(200).json({
        success: true,
        query: q || setNumber,
        found: false,
        message: 'No matching LEGO sets found',
        priceData: [],
        timestamp: new Date().toISOString(),
      });
    }

    // Process sets and calculate estimated values
    const priceResults: PriceResult[] = [];
    const allPrices: number[] = [];

    for (const set of sets) {
      const retailPrice = set.LEGOCom?.US?.retailPrice;
      
      // Estimate secondary market value based on various factors
      let estimatedValue: number | undefined;
      
      if (retailPrice) {
        const currentYear = new Date().getFullYear();
        const age = currentYear - set.year;
        
        // Retired sets typically appreciate
        // New sets trade near retail
        // Popular themes (Star Wars, Harry Potter) have higher multipliers
        let multiplier = 1.0;
        
        if (age > 2) {
          // Set is likely retired, estimate appreciation
          multiplier = 1.0 + (age * 0.1); // 10% per year base
          
          // Theme-based adjustments
          const premiumThemes = ['Star Wars', 'Harry Potter', 'Marvel', 'Disney', 'Technic'];
          if (premiumThemes.some(t => set.theme.includes(t))) {
            multiplier *= 1.2;
          }
          
          // Size premium for large sets
          if (set.pieces && set.pieces > 2000) {
            multiplier *= 1.15;
          }
          
          // Minifig premium
          if (set.minifigs && set.minifigs > 5) {
            multiplier *= 1.1;
          }
        }
        
        estimatedValue = Math.round(retailPrice * multiplier * 100) / 100;
        allPrices.push(estimatedValue);
      }

      priceResults.push({
        setNumber: `${set.number}${set.numberVariant > 1 ? `-${set.numberVariant}` : ''}`,
        name: set.name,
        year: set.year,
        theme: set.theme,
        pieces: set.pieces,
        minifigs: set.minifigs,
        retailPrice,
        currency: 'USD',
        availability: set.availability || (set.year < new Date().getFullYear() - 1 ? 'Retired' : 'Available'),
        estimatedValue,
        images: {
          thumbnail: set.image?.thumbnailURL,
          full: set.image?.imageURL,
        },
        bricksetUrl: set.bricksetURL,
      });
    }

    // Calculate aggregate price analysis
    let priceAnalysis = null;
    if (allPrices.length > 0) {
      const sortedPrices = [...allPrices].sort((a, b) => a - b);
      const median = sortedPrices.length % 2 === 0
        ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
        : sortedPrices[Math.floor(sortedPrices.length / 2)];

      priceAnalysis = {
        lowestPrice: Math.min(...allPrices),
        highestPrice: Math.max(...allPrices),
        averagePrice: Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 100) / 100,
        medianPrice: Math.round(median * 100) / 100,
        sampleSize: allPrices.length,
        currency: 'USD',
        note: 'Estimated secondary market values based on retail + age/theme factors',
      };
    }

    // Generate suggested prices
    let suggestedPrices = null;
    if (priceAnalysis) {
      suggestedPrices = {
        goodDeal: Math.round(priceAnalysis.medianPrice * 0.75 * 100) / 100,
        fairMarket: priceAnalysis.medianPrice,
        sellPrice: Math.round(priceAnalysis.medianPrice * 1.1 * 100) / 100,
      };
    }

    return res.status(200).json({
      success: true,
      query: q || setNumber,
      dataSource: 'brickset_catalogue',
      note: 'Retail prices from LEGO, estimated values calculated based on age, theme, and rarity factors',
      found: priceResults.length > 0,
      totalSets: data.matches || priceResults.length,
      priceAnalysis,
      suggestedPrices,
      sampleListings: priceResults.slice(0, 5).map(p => ({
        title: `LEGO ${p.setNumber} ${p.name}`,
        price: p.estimatedValue || p.retailPrice || 0,
        condition: p.availability === 'Retired' ? 'Retired Set' : 'Current',
        url: p.bricksetUrl,
        pieces: p.pieces,
        year: p.year,
      })),
      priceData: priceResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Brickset price check error:', error);
    return res.status(500).json({
      error: 'Failed to get pricing from Brickset',
      message: error.message,
    });
  }
}