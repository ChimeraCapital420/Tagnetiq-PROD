// FILE: api/rawg/game.ts
// RAWG Video Game Details

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const RAWG_BASE_URL = 'https://api.rawg.io/api';

interface RAWGScreenshot {
  id: number;
  image: string;
}

interface RAWGStore {
  id: number;
  store?: {
    name: string;
    slug: string;
  };
  url: string;
}

interface RAWGResponse<T> {
  results: T[];
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

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Missing game ID',
      message: 'Provide a game ID or slug',
      examples: [
        '/api/rawg/game?id=3498',
        '/api/rawg/game?id=grand-theft-auto-v'
      ]
    });
  }

  try {
    // Fetch main game details
    const gameResponse = await fetch(
      `${RAWG_BASE_URL}/games/${id}?key=${apiKey}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (gameResponse.status === 404) {
      return res.status(404).json({
        error: 'Game not found',
        message: `No game found with ID: ${id}`,
        suggestion: 'Use /api/rawg/search to find valid game IDs'
      });
    }

    if (!gameResponse.ok) {
      const errorText = await gameResponse.text();
      return res.status(gameResponse.status).json({
        error: 'RAWG API error',
        status: gameResponse.status,
        message: errorText
      });
    }

    const game = await gameResponse.json();

    // Fetch screenshots in parallel
    const screenshotsPromise = fetch(
      `${RAWG_BASE_URL}/games/${id}/screenshots?key=${apiKey}&page_size=6`,
      { headers: { 'Content-Type': 'application/json' } }
    ).then(r => r.ok ? r.json() as Promise<RAWGResponse<RAWGScreenshot>> : { results: [] as RAWGScreenshot[] })
     .catch(() => ({ results: [] as RAWGScreenshot[] }));

    // Fetch store links in parallel
    const storesPromise = fetch(
      `${RAWG_BASE_URL}/games/${id}/stores?key=${apiKey}`,
      { headers: { 'Content-Type': 'application/json' } }
    ).then(r => r.ok ? r.json() as Promise<RAWGResponse<RAWGStore>> : { results: [] as RAWGStore[] })
     .catch(() => ({ results: [] as RAWGStore[] }));

    const [screenshotsData, storesData] = await Promise.all([screenshotsPromise, storesPromise]);

    const screenshots = screenshotsData.results || [];
    const stores = storesData.results || [];

    // Build comprehensive response
    const result = {
      success: true,
      game: {
        // Identity
        id: game.id,
        slug: game.slug,
        name: game.name,
        nameOriginal: game.name_original,
        
        // Description
        description: game.description_raw || game.description,
        
        // Release info
        released: game.released,
        tba: game.tba,
        
        // Ratings
        metacritic: game.metacritic,
        metacriticUrl: game.metacritic_url,
        rating: game.rating,
        ratingTop: game.rating_top,
        ratingsCount: game.ratings_count,
        ratingsBreakdown: Array.isArray(game.ratings) ? game.ratings.map((r: { title: string; count: number; percent: number }) => ({
          title: r.title,
          count: r.count,
          percent: r.percent
        })) : [],
        
        // Playtime
        playtime: game.playtime,
        
        // Media
        backgroundImage: game.background_image,
        backgroundImageAdditional: game.background_image_additional,
        screenshots: screenshots.map((s) => ({
          id: s.id,
          image: s.image
        })),
        
        // Website
        website: game.website,
        
        // Platforms with requirements
        platforms: Array.isArray(game.platforms) ? game.platforms.map((p: { platform: { id: number; name: string; slug: string }; released_at: string; requirements: unknown }) => ({
          platform: {
            id: p.platform.id,
            name: p.platform.name,
            slug: p.platform.slug
          },
          releasedAt: p.released_at,
          requirements: p.requirements || null
        })) : [],
        
        // Parent platforms (simplified)
        parentPlatforms: Array.isArray(game.parent_platforms) 
          ? game.parent_platforms.map((p: { platform: { name: string } }) => p.platform.name) 
          : [],
        
        // Genres
        genres: Array.isArray(game.genres) ? game.genres.map((g: { id: number; name: string; slug: string }) => ({
          id: g.id,
          name: g.name,
          slug: g.slug
        })) : [],
        
        // Developers
        developers: Array.isArray(game.developers) ? game.developers.map((d: { id: number; name: string; slug: string }) => ({
          id: d.id,
          name: d.name,
          slug: d.slug
        })) : [],
        
        // Publishers
        publishers: Array.isArray(game.publishers) ? game.publishers.map((p: { id: number; name: string; slug: string }) => ({
          id: p.id,
          name: p.name,
          slug: p.slug
        })) : [],
        
        // Tags
        tags: Array.isArray(game.tags) ? game.tags.slice(0, 10).map((t: { id: number; name: string; slug: string; language: string }) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          language: t.language
        })) : [],
        
        // ESRB
        esrbRating: game.esrb_rating ? {
          id: game.esrb_rating.id,
          name: game.esrb_rating.name,
          slug: game.esrb_rating.slug
        } : null,
        
        // Store links
        stores: stores.map((s) => ({
          id: s.id,
          storeName: s.store?.name,
          storeSlug: s.store?.slug,
          url: s.url
        })),
        
        // Additional info
        achievementsCount: game.achievements_count,
        redditUrl: game.reddit_url,
        redditCount: game.reddit_count,
        twitchCount: game.twitch_count,
        youtubeCount: game.youtube_count,
        
        // Clip/trailer
        clip: game.clip ? {
          video: game.clip.video,
          preview: game.clip.preview
        } : null
      },
      
      // For Hydra integration
      valuationContext: {
        category: 'video-games',
        identifiers: {
          rawgId: game.id,
          rawgSlug: game.slug,
          name: game.name,
          releaseDate: game.released
        },
        platforms: Array.isArray(game.platforms) 
          ? game.platforms.map((p: { platform: { name: string } }) => p.platform.name) 
          : [],
        developers: Array.isArray(game.developers) 
          ? game.developers.map((d: { name: string }) => d.name) 
          : [],
        publishers: Array.isArray(game.publishers) 
          ? game.publishers.map((p: { name: string }) => p.name) 
          : [],
        metacritic: game.metacritic,
        genres: Array.isArray(game.genres) 
          ? game.genres.map((g: { name: string }) => g.name) 
          : [],
        description: `${game.name}${game.released ? ` (${game.released.split('-')[0]})` : ''} - ${Array.isArray(game.genres) ? game.genres.map((g: { name: string }) => g.name).join(', ') : 'Video Game'}`,
        collectibilityFactors: {
          metacriticScore: game.metacritic,
          communityRating: game.rating,
          platformCount: Array.isArray(game.platforms) ? game.platforms.length : 0,
          isRetro: game.released ? new Date(game.released).getFullYear() < 2000 : false,
          averagePlaytime: game.playtime
        }
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('RAWG game fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch game',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}