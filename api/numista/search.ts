import type { VercelRequest, VercelResponse } from '@vercel/node';

// Numista Coin Search API
// Searches the Numista catalogue for coins, banknotes, and exonumia

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

interface SearchResult {
  id: number;
  title: string;
  category: string;
  issuer: string;
  issuerCode: string;
  yearRange: string;
  images: {
    obverse?: string;
    reverse?: string;
  };
  numistaUrl: string;
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

  const apiKey = process.env.NUMISTA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Numista API key not configured' });
  }

  // Parse query parameters
  const { 
    q,           // Search query (required)
    category,    // coin, banknote, exonumia (optional)
    issuer,      // Issuer code like 'united-states' (optional)
    year,        // Year or range like '1900-1950' (optional)
    limit = '20' // Results per page (max 50)
  } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ 
      error: 'Missing required parameter: q (search query)',
      example: '/api/numista/search?q=morgan+dollar'
    });
  }

  try {
    // Build search URL with parameters
    const params = new URLSearchParams();
    params.append('q', q);
    params.append('count', Math.min(parseInt(limit as string) || 20, 50).toString());
    params.append('lang', 'en');
    
    if (category && ['coin', 'banknote', 'exonumia'].includes(category as string)) {
      params.append('category', category as string);
    }
    
    if (issuer && typeof issuer === 'string') {
      params.append('issuer', issuer);
    }
    
    if (year && typeof year === 'string') {
      // Support both single year and range
      if (year.includes('-')) {
        params.append('date', year); // Range like 1900-1950
      } else {
        params.append('year', year); // Single year
      }
    }

    const searchUrl = `${NUMISTA_API_URL}/types?${params.toString()}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Numista-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Numista API error: ${response.status}`, errorText);
      return res.status(response.status).json({
        error: 'Numista API error',
        status: response.status,
        message: errorText.substring(0, 200),
      });
    }

    const data = await response.json();

    // Transform results to a cleaner format
    const results: SearchResult[] = (data.types || []).map((type: NumistaType) => ({
      id: type.id,
      title: type.title,
      category: type.category || 'coin',
      issuer: type.issuer?.name || 'Unknown',
      issuerCode: type.issuer?.code || '',
      yearRange: type.min_year && type.max_year 
        ? (type.min_year === type.max_year ? `${type.min_year}` : `${type.min_year}-${type.max_year}`)
        : type.min_year ? `${type.min_year}+` : 'Unknown',
      images: {
        obverse: type.obverse_thumbnail,
        reverse: type.reverse_thumbnail,
      },
      numistaUrl: `https://en.numista.com/catalogue/pieces${type.id}.html`,
    }));

    return res.status(200).json({
      success: true,
      query: q,
      totalResults: data.count || 0,
      resultsReturned: results.length,
      filters: {
        category: category || 'all',
        issuer: issuer || 'all',
        year: year || 'all',
      },
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Numista search error:', error);
    return res.status(500).json({
      error: 'Failed to search Numista',
      message: error.message,
    });
  }
}