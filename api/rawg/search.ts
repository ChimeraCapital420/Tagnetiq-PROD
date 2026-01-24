// FILE: api/rawg/search.ts
// RAWG Video Games Search

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const RAWG_BASE_URL = 'https://api.rawg.io/api';

interface RAWGPlatform {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
}

interface RAWGGenre {
  id: number;
  name: string;
  slug: string;
}

interface RAWGStore {
  store: {
    id: number;
    name: string;
    slug: string;
  };
}

interface RAWGTag {
  name: string;
}

interface RAWGGame {
  id: number;
  slug: string;
  name: string;
  released: string;
  metacritic: number | null;
  rating: number;
  rating_top: number;
  ratings_count: number;
  background_image: string;
  platforms: RAWGPlatform[];
  parent_platforms: RAWGPlatform[];
  genres: RAWGGenre[];
  stores: RAWGStore[];
  tags: RAWGTag[];
  esrb_rating: {
    id: number;
    name: string;
    slug: string;
  } | null;
}

function formatGameResult(game: RAWGGame) {
  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    released: game.released,
    
    // Ratings
    metacritic: game.metacritic,
    rating: game.rating,
    ratingTop: game.rating_top,
    ratingsCount: game.ratings_count,
    
    // Media
    backgroundImage: game.background_image,
    
    // Platforms
    platforms: Array.isArray(game.platforms) ? game.platforms.map((p) => ({
      id: p.platform.id,
      name: p.platform.name,
      slug: p.platform.slug
    })) : [],
    
    // Parent platforms (simplified)
    parentPlatforms: Array.isArray(game.parent_platforms) 
      ? game.parent_platforms.map((p) => p.platform.name) 
      : [],
    
    // Genres
    genres: Array.isArray(game.genres) ? game.genres.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug
    })) : [],
    
    // Stores
    stores: Array.isArray(game.stores) ? game.stores.map((s) => ({
      id: s.store.id,
      name: s.store.name,
      slug: s.store.slug
    })) : [],
    
    // Tags (top 5)
    tags: Array.isArray(game.tags) ? game.tags.slice(0, 5).map((t) => t.name) : [],
    
    // ESRB Rating
    esrbRating: game.esrb_rating ? {
      id: game.esrb_rating.id,
      name: game.esrb_rating.name,
      slug: game.esrb_rating.slug
    } : null,
    
    // For Hydra integration
    valuationContext: {
      category: 'video-games',
      identifiers: {
        rawgId: game.id,
        rawgSlug: game.slug,
        name: game.name,
        releaseDate: game.released
      },
      platforms: Array.isArray(game.platforms) ? game.platforms.map((p) => p.platform.name) : [],
      metacritic: game.metacritic,
      description: `${game.name}${game.released ? ` (${game.released.split('-')[0]})` : ''}${game.metacritic ? ` - Metacritic: ${game.metacritic}` : ''}`
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RAWG_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'RAWG API not configured',
      message: 'RAWG_API_KEY environment variable not set'
    });
  }

  const {
    q,                    // Search query
    search,               // Alias for q
    platforms,            // Filter by platform IDs (comma-separated)
    genres,               // Filter by genre IDs or slugs
    stores,               // Filter by store IDs
    dates,                // Release date range (YYYY-MM-DD,YYYY-MM-DD)
    metacritic,           // Metacritic score range (e.g., "80,100")
    ordering,             // Sort: name, released, added, created, updated, rating, metacritic
    page = '1',
    page_size = '20'
  } = req.query;

  const searchQuery = q || search;

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Missing search query',
      message: 'Provide a search query using q or search parameter',
      examples: [
        '/api/rawg/search?q=zelda',
        '/api/rawg/search?q=mario&platforms=7',
        '/api/rawg/search?q=final+fantasy&ordering=-metacritic',
        '/api/rawg/search?q=cyberpunk&metacritic=80,100'
      ],
      platformIds: {
        pc: 4,
        playstation5: 187,
        playstation4: 18,
        xboxSeriesX: 186,
        xboxOne: 1,
        nintendo_switch: 7,
        ios: 3,
        android: 21
      }
    });
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      search: String(searchQuery),
      page: String(page),
      page_size: String(Math.min(Number(page_size), 40)),
      search_precise: 'true'
    });

    // Add optional filters
    if (platforms) params.set('platforms', String(platforms));
    if (genres) params.set('genres', String(genres));
    if (stores) params.set('stores', String(stores));
    if (dates) params.set('dates', String(dates));
    if (metacritic) params.set('metacritic', String(metacritic));
    if (ordering) params.set('ordering', String(ordering));

    const response = await fetch(
      `${RAWG_BASE_URL}/games?${params}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('RAWG API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'RAWG API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();
    
    const results = Array.isArray(data.results) ? data.results.map(formatGameResult) : [];

    return res.status(200).json({
      success: true,
      query: searchQuery,
      totalResults: data.count || 0,
      page: Number(page),
      pageSize: Number(page_size),
      totalPages: Math.ceil((data.count || 0) / Number(page_size)),
      results,
      filters: {
        platforms: platforms || null,
        genres: genres || null,
        stores: stores || null,
        dates: dates || null,
        metacritic: metacritic || null,
        ordering: ordering || null
      }
    });

  } catch (error) {
    console.error('RAWG search failed:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}