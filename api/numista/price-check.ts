import type { VercelRequest, VercelResponse } from '@vercel/node';

// Numista Coin Price Check API
// Searches for coins and retrieves pricing data

const NUMISTA_API_URL = 'https://api.numista.com/v3';

interface NumistaType {
  id: number;
  title: string;
  category?: string;
  issuer?: {
    code: string;
    name: string;
  };
  min_year?: number;
  max_year?: number;
  obverse_thumbnail?: string;
  reverse_thumbnail?: string;
}

interface NumistaIssue {
  id: number;
  is_dated: boolean;
  year?: number;
  gregorian_year?: number;
  mint_letter?: string;
  mintage?: number;
  comment?: string;
}

interface NumistaPrice {
  grade: string;
  price: number;
}

interface PriceData {
  typeId: number;
  issueId: number;
  title: string;
  year: number | string;
  mintLetter?: string;
  mintage?: number;
  prices: {
    grade: string;
    gradeName: string;
    price: number;
  }[];
}

// Grade name mapping
const GRADE_NAMES: Record<string, string> = {
  'g': 'Good',
  'vg': 'Very Good',
  'f': 'Fine',
  'vf': 'Very Fine',
  'xf': 'Extremely Fine',
  'au': 'About Uncirculated',
  'unc': 'Uncirculated',
};

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

  const apiKey = process.env.NUMISTA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Numista API key not configured' });
  }

  // Parse query parameters
  const { 
    q,              // Search query (required)
    type_id,        // Direct type ID lookup (optional, skips search)
    currency = 'USD', // Price currency
    limit = '5'     // Max results to check pricing for
  } = req.query;

  if (!q && !type_id) {
    return res.status(400).json({ 
      error: 'Missing required parameter: q (search query) or type_id',
      examples: [
        '/api/numista/price-check?q=morgan+dollar+1921',
        '/api/numista/price-check?type_id=420'
      ]
    });
  }

  try {
    let typesToCheck: NumistaType[] = [];

    // If type_id provided, fetch that specific type
    if (type_id) {
      const typeResponse = await fetch(
        `${NUMISTA_API_URL}/types/${type_id}?lang=en`,
        {
          method: 'GET',
          headers: { 'Numista-API-Key': apiKey },
        }
      );

      if (typeResponse.ok) {
        const typeData = await typeResponse.json();
        typesToCheck = [{
          id: typeData.id,
          title: typeData.title,
          category: typeData.category,
          issuer: typeData.issuer,
          min_year: typeData.min_year,
          max_year: typeData.max_year,
        }];
      }
    } else {
      // Search for matching coins
      const searchParams = new URLSearchParams({
        q: q as string,
        count: Math.min(parseInt(limit as string) || 5, 10).toString(),
        lang: 'en',
        category: 'coin', // Focus on coins for pricing
      });

      const searchResponse = await fetch(
        `${NUMISTA_API_URL}/types?${searchParams.toString()}`,
        {
          method: 'GET',
          headers: { 'Numista-API-Key': apiKey },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        typesToCheck = searchData.types || [];
      }
    }

    if (typesToCheck.length === 0) {
      return res.status(200).json({
        success: true,
        query: q || type_id,
        found: false,
        message: 'No matching coins found',
        priceData: [],
        timestamp: new Date().toISOString(),
      });
    }

    // For each type, get issues and pricing
    const priceResults: PriceData[] = [];
    const allPrices: number[] = [];

    for (const type of typesToCheck.slice(0, 5)) {
      // Get issues for this type
      const issuesResponse = await fetch(
        `${NUMISTA_API_URL}/types/${type.id}/issues?lang=en`,
        {
          method: 'GET',
          headers: { 'Numista-API-Key': apiKey },
        }
      );

      if (!issuesResponse.ok) continue;

      const issues: NumistaIssue[] = await issuesResponse.json();
      
      // Get pricing for first few issues
      for (const issue of issues.slice(0, 3)) {
        const priceResponse = await fetch(
          `${NUMISTA_API_URL}/types/${type.id}/issues/${issue.id}/prices?currency=${currency}&lang=en`,
          {
            method: 'GET',
            headers: { 'Numista-API-Key': apiKey },
          }
        );

        if (!priceResponse.ok) continue;

        const priceData = await priceResponse.json();
        
        if (priceData.prices && priceData.prices.length > 0) {
          const formattedPrices = priceData.prices.map((p: NumistaPrice) => ({
            grade: p.grade,
            gradeName: GRADE_NAMES[p.grade] || p.grade.toUpperCase(),
            price: p.price,
          }));

          // Collect all prices for aggregate stats
          formattedPrices.forEach((p: { price: number }) => allPrices.push(p.price));

          priceResults.push({
            typeId: type.id,
            issueId: issue.id,
            title: type.title,
            year: issue.year || issue.gregorian_year || 'ND',
            mintLetter: issue.mint_letter,
            mintage: issue.mintage,
            prices: formattedPrices,
          });
        }
      }
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
        currency: currency,
      };
    }

    // Generate suggested prices
    let suggestedPrices = null;
    if (priceAnalysis) {
      suggestedPrices = {
        goodDeal: Math.round(priceAnalysis.medianPrice * 0.8 * 100) / 100,
        fairMarket: priceAnalysis.medianPrice,
        sellPrice: Math.round(priceAnalysis.medianPrice * 1.05 * 100) / 100,
      };
    }

    return res.status(200).json({
      success: true,
      query: q || `type_id:${type_id}`,
      dataSource: 'numista_catalogue',
      note: 'Prices from Numista coin catalogue estimates',
      found: priceResults.length > 0,
      totalTypes: typesToCheck.length,
      priceAnalysis,
      suggestedPrices,
      priceData: priceResults,
      sampleListings: priceResults.slice(0, 5).map(p => ({
        title: `${p.title} (${p.year}${p.mintLetter ? ` ${p.mintLetter}` : ''})`,
        price: p.prices.find(pr => pr.grade === 'vf')?.price || p.prices[0]?.price || 0,
        condition: p.prices.find(pr => pr.grade === 'vf')?.gradeName || p.prices[0]?.gradeName || 'Unknown',
        url: `https://en.numista.com/catalogue/pieces${p.typeId}.html`,
        mintage: p.mintage,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Numista price check error:', error);
    return res.status(500).json({
      error: 'Failed to get pricing from Numista',
      message: error.message,
    });
  }
}