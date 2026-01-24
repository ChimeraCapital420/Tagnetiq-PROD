// FILE: api/rawg/platforms.ts
// RAWG Platforms Listing

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const RAWG_BASE_URL = 'https://api.rawg.io/api';

interface RAWGPlatformResponse {
  id: number;
  name: string;
  slug: string;
  games_count: number;
  image_background: string;
  year_start: number | null;
  year_end: number | null;
}

interface FormattedPlatform {
  id: number;
  name: string;
  slug: string;
  gamesCount: number;
  image: string;
  yearStart: number | null;
  yearEnd: number | null;
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

  const { page = '1', page_size = '50' } = req.query;

  try {
    const response = await fetch(
      `${RAWG_BASE_URL}/platforms?key=${apiKey}&page=${page}&page_size=${Math.min(Number(page_size), 50)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'RAWG API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();

    const platforms: FormattedPlatform[] = Array.isArray(data.results) 
      ? data.results.map((p: RAWGPlatformResponse) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          gamesCount: p.games_count,
          image: p.image_background,
          yearStart: p.year_start,
          yearEnd: p.year_end
        }))
      : [];

    // Group by common categories for convenience
    const grouped = {
      playstation: platforms.filter((p) => p.name.toLowerCase().includes('playstation') || p.slug.includes('ps')),
      xbox: platforms.filter((p) => p.name.toLowerCase().includes('xbox')),
      nintendo: platforms.filter((p) => 
        p.name.toLowerCase().includes('nintendo') || 
        p.name.toLowerCase().includes('wii') || 
        p.name.toLowerCase().includes('switch') ||
        p.name.toLowerCase().includes('game boy') ||
        p.slug.includes('nes') ||
        p.slug.includes('snes')
      ),
      pc: platforms.filter((p) => p.slug === 'pc' || p.name.toLowerCase().includes('pc')),
      mobile: platforms.filter((p) => p.slug === 'ios' || p.slug === 'android'),
      retro: platforms.filter((p) => {
        const endYear = p.yearEnd;
        return endYear !== null && endYear < 2000;
      })
    };

    // Quick reference for common platform IDs
    const quickReference = {
      pc: 4,
      playstation5: 187,
      playstation4: 18,
      playstation3: 16,
      playstation2: 15,
      playstation: 27,
      xboxSeriesX: 186,
      xboxOne: 1,
      xbox360: 14,
      xbox: 80,
      nintendoSwitch: 7,
      wiiU: 10,
      wii: 11,
      gamecube: 105,
      nintendo64: 83,
      snes: 79,
      nes: 49,
      gameboy: 26,
      gameboyAdvance: 24,
      nintendoDS: 9,
      nintendo3DS: 8,
      ios: 3,
      android: 21,
      macos: 5,
      linux: 6
    };

    return res.status(200).json({
      success: true,
      totalPlatforms: data.count || platforms.length,
      page: Number(page),
      pageSize: Number(page_size),
      platforms,
      grouped,
      quickReference,
      usage: 'Use platform IDs in /api/rawg/search?platforms=7,18 (comma-separated)'
    });

  } catch (error) {
    console.error('RAWG platforms fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch platforms',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}