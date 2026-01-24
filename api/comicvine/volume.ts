// FILE: api/comicvine/volume.ts
// Comic Vine Volume Details (Comic Series)

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';

interface ComicVineIssueInVolume {
  id: number;
  name: string | null;
  issue_number: string;
  cover_date: string;
  api_detail_url: string;
  site_detail_url: string;
}

interface ComicVineCharacterInVolume {
  id: number;
  name: string;
  count: string;
  site_detail_url: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.COMIC_VINE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Comic Vine API not configured',
      message: 'COMIC_VINE_API_KEY environment variable not set'
    });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Missing volume ID',
      message: 'Provide a Comic Vine volume ID',
      examples: [
        '/api/comicvine/volume?id=796',
        '/api/comicvine/volume?id=4050-796'
      ],
      note: 'Volume IDs can be found via /api/comicvine/search?type=volume'
    });
  }

  // Comic Vine IDs can be prefixed with resource type (4050- for volumes)
  const volumeId = String(id).includes('-') ? id : `4050-${id}`;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      format: 'json'
    });

    const response = await fetch(
      `${COMIC_VINE_BASE_URL}/volume/${volumeId}/?${params}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Collectibles Identification Platform)'
        }
      }
    );

    if (response.status === 404) {
      return res.status(404).json({
        error: 'Volume not found',
        message: `No volume found with ID: ${id}`,
        suggestion: 'Use /api/comicvine/search?type=volume to find valid volume IDs'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Comic Vine API error',
        status: response.status,
        message: errorText
      });
    }

    const data = await response.json();

    if (data.error !== 'OK') {
      return res.status(400).json({
        error: 'Comic Vine API error',
        message: data.error
      });
    }

    const volume = data.results;

    if (!volume) {
      return res.status(404).json({
        error: 'Volume not found',
        message: `No volume found with ID: ${id}`
      });
    }

    const result = {
      success: true,
      volume: {
        id: volume.id,
        name: volume.name,
        
        // Publisher
        publisher: volume.publisher ? {
          id: volume.publisher.id,
          name: volume.publisher.name
        } : null,
        
        // Date range
        startYear: volume.start_year,
        
        // Issue info
        issueCount: volume.count_of_issues,
        firstIssue: volume.first_issue ? {
          id: volume.first_issue.id,
          name: volume.first_issue.name,
          issueNumber: volume.first_issue.issue_number
        } : null,
        lastIssue: volume.last_issue ? {
          id: volume.last_issue.id,
          name: volume.last_issue.name,
          issueNumber: volume.last_issue.issue_number
        } : null,
        
        // All issues (limited)
        issues: Array.isArray(volume.issues) 
          ? volume.issues.slice(0, 50).map((issue: ComicVineIssueInVolume) => ({
              id: issue.id,
              name: issue.name,
              issueNumber: issue.issue_number,
              coverDate: issue.cover_date,
              url: issue.site_detail_url
            }))
          : [],
        
        // Description
        deck: volume.deck,
        description: volume.description,
        
        // Images
        images: volume.image ? {
          icon: volume.image.icon_url,
          thumb: volume.image.thumb_url,
          small: volume.image.small_url,
          medium: volume.image.medium_url,
          screen: volume.image.screen_url,
          large: volume.image.super_url,
          original: volume.image.original_url
        } : null,
        
        // Main characters
        characters: Array.isArray(volume.characters)
          ? volume.characters.slice(0, 20).map((c: ComicVineCharacterInVolume) => ({
              id: c.id,
              name: c.name,
              appearanceCount: c.count,
              url: c.site_detail_url
            }))
          : [],
        
        // Links
        url: volume.site_detail_url,
        apiUrl: volume.api_detail_url
      },
      
      // For Hydra integration
      valuationContext: {
        category: 'comics',
        subcategory: 'comic-volumes',
        identifiers: {
          comicVineId: volume.id,
          name: volume.name,
          startYear: volume.start_year,
          publisher: volume.publisher?.name
        },
        description: `${volume.name} (${volume.start_year || 'Unknown'}) - ${volume.publisher?.name || 'Unknown Publisher'} - ${volume.count_of_issues} issues`
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Comic Vine volume fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch volume',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}