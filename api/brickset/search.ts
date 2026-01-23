import type { VercelRequest, VercelResponse } from '@vercel/node';

// Brickset LEGO Set Search API
// Searches the Brickset database for LEGO sets
// Requires login to get userHash first

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
  };
  rating?: number;
  reviewCount?: number;
  ageRange?: {
    min?: number;
    max?: number;
  };
}

interface SearchResult {
  setId: number;
  setNumber: string;
  name: string;
  year: number;
  theme: string;
  subtheme?: string;
  pieces?: number;
  minifigs?: number;
  retailPrice?: number;
  currency: string;
  images: {
    thumbnail?: string;
    full?: string;
  };
  bricksetUrl: string;
  rating?: number;
  reviewCount?: number;
}

// Helper function to get userHash via login
async function getBricksetUserHash(apiKey: string, username: string, password: string): Promise<string | null> {
  try {
    const loginUrl = `${BRICKSET_API_URL}/login?apiKey=${encodeURIComponent(apiKey)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    
    const response = await fetch(loginUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();
    
    if (data.status === 'success' && data.hash) {
      return data.hash;
    }
    
    console.error('Brickset login failed:', data.message);
    return null;
  } catch (error) {
    console.error('Brickset login error:', error);
    return null;
  }
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
  const username = process.env.BRICKSET_USERNAME;
  const password = process.env.BRICKSET_PASSWORD;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brickset API key not configured' });
  }

  if (!username || !password) {
    return res.status(500).json({ 
      error: 'Brickset login credentials not configured',
      setup: 'Add BRICKSET_USERNAME and BRICKSET_PASSWORD to environment variables'
    });
  }

  // Parse query parameters
  const { 
    q,              // Search query (required unless setNumber provided)
    setNumber,      // Direct set number lookup like "75192" (optional)
    theme,          // Theme filter like "Star Wars" (optional)
    year,           // Year filter (optional)
    limit = '20'    // Results per page (max 500)
  } = req.query;

  if (!q && !setNumber) {
    return res.status(400).json({ 
      error: 'Missing required parameter: q (search query) or setNumber',
      examples: [
        '/api/brickset/search?q=millennium+falcon',
        '/api/brickset/search?setNumber=75192',
        '/api/brickset/search?q=star+wars&year=2023'
      ]
    });
  }

  try {
    // Step 1: Login to get userHash
    const userHash = await getBricksetUserHash(apiKey, username, password);
    
    if (!userHash) {
      return res.status(401).json({
        error: 'Failed to authenticate with Brickset',
        message: 'Check BRICKSET_USERNAME and BRICKSET_PASSWORD'
      });
    }

    // Step 2: Build search parameters
    const searchParams: Record<string, any> = {
      pageSize: Math.min(parseInt(limit as string) || 20, 100),
    };

    if (q && typeof q === 'string') {
      searchParams.query = q;
    }

    if (setNumber && typeof setNumber === 'string') {
      searchParams.setNumber = setNumber;
    }

    if (theme && typeof theme === 'string') {
      searchParams.theme = theme;
    }

    if (year && typeof year === 'string') {
      searchParams.year = year;
    }

    // Step 3: Execute search
    const searchUrl = `${BRICKSET_API_URL}/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=${encodeURIComponent(userHash)}&params=${encodeURIComponent(JSON.stringify(searchParams))}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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

    // Transform results to a cleaner format
    const results: SearchResult[] = (data.sets || []).map((set: BricksetSet) => ({
      setId: set.setID,
      setNumber: `${set.number}${set.numberVariant > 1 ? `-${set.numberVariant}` : ''}`,
      name: set.name,
      year: set.year,
      theme: set.theme,
      subtheme: set.subtheme,
      pieces: set.pieces,
      minifigs: set.minifigs,
      retailPrice: set.LEGOCom?.US?.retailPrice,
      currency: 'USD',
      images: {
        thumbnail: set.image?.thumbnailURL,
        full: set.image?.imageURL,
      },
      bricksetUrl: set.bricksetURL,
      rating: set.rating,
      reviewCount: set.reviewCount,
    }));

    return res.status(200).json({
      success: true,
      query: q || setNumber,
      totalResults: data.matches || 0,
      resultsReturned: results.length,
      filters: {
        theme: theme || 'all',
        year: year || 'all',
      },
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Brickset search error:', error);
    return res.status(500).json({
      error: 'Failed to search Brickset',
      message: error.message,
    });
  }
}