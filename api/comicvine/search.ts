// FILE: api/comicvine/search.ts
// Comic Vine Search - Issues, Volumes, Characters

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';

type ResourceType = 'issue' | 'volume' | 'character' | 'publisher' | 'story_arc' | 'person';

interface ComicVineIssue {
  id: number;
  name: string | null;
  issue_number: string;
  cover_date: string;
  store_date: string;
  image: {
    icon_url: string;
    medium_url: string;
    screen_url: string;
    small_url: string;
    super_url: string;
    thumb_url: string;
    tiny_url: string;
    original_url: string;
  };
  volume: {
    id: number;
    name: string;
    api_detail_url: string;
  };
  api_detail_url: string;
  site_detail_url: string;
  description: string | null;
}

interface ComicVineVolume {
  id: number;
  name: string;
  start_year: string;
  count_of_issues: number;
  publisher: {
    id: number;
    name: string;
  } | null;
  image: {
    original_url: string;
    thumb_url: string;
  };
  api_detail_url: string;
  site_detail_url: string;
  description: string | null;
}

interface ComicVineCharacter {
  id: number;
  name: string;
  real_name: string | null;
  aliases: string | null;
  publisher: {
    id: number;
    name: string;
  } | null;
  image: {
    original_url: string;
    thumb_url: string;
  };
  first_appeared_in_issue: {
    id: number;
    name: string;
    issue_number: string;
  } | null;
  api_detail_url: string;
  site_detail_url: string;
  description: string | null;
  count_of_issue_appearances: number;
}

function formatIssueResult(issue: ComicVineIssue) {
  const issueName = issue.name 
    ? `${issue.volume?.name} #${issue.issue_number} - ${issue.name}`
    : `${issue.volume?.name} #${issue.issue_number}`;

  return {
    id: issue.id,
    type: 'issue',
    name: issueName,
    issueNumber: issue.issue_number,
    volumeName: issue.volume?.name,
    volumeId: issue.volume?.id,
    coverDate: issue.cover_date,
    storeDate: issue.store_date,
    image: issue.image?.medium_url || issue.image?.thumb_url,
    imageOriginal: issue.image?.original_url,
    url: issue.site_detail_url,
    apiUrl: issue.api_detail_url,
    valuationContext: {
      category: 'comics',
      subcategory: 'comic-issues',
      identifiers: {
        comicVineId: issue.id,
        volumeId: issue.volume?.id,
        volumeName: issue.volume?.name,
        issueNumber: issue.issue_number,
        coverDate: issue.cover_date
      },
      description: issueName
    }
  };
}

function formatVolumeResult(volume: ComicVineVolume) {
  return {
    id: volume.id,
    type: 'volume',
    name: volume.name,
    startYear: volume.start_year,
    issueCount: volume.count_of_issues,
    publisher: volume.publisher?.name || null,
    publisherId: volume.publisher?.id || null,
    image: volume.image?.thumb_url,
    imageOriginal: volume.image?.original_url,
    url: volume.site_detail_url,
    apiUrl: volume.api_detail_url,
    valuationContext: {
      category: 'comics',
      subcategory: 'comic-volumes',
      identifiers: {
        comicVineId: volume.id,
        name: volume.name,
        startYear: volume.start_year,
        publisher: volume.publisher?.name
      },
      description: `${volume.name} (${volume.start_year}) - ${volume.count_of_issues} issues`
    }
  };
}

function formatCharacterResult(character: ComicVineCharacter) {
  return {
    id: character.id,
    type: 'character',
    name: character.name,
    realName: character.real_name,
    aliases: character.aliases?.split('\n').filter(Boolean) || [],
    publisher: character.publisher?.name || null,
    publisherId: character.publisher?.id || null,
    issueAppearances: character.count_of_issue_appearances,
    firstAppearance: character.first_appeared_in_issue ? {
      issueId: character.first_appeared_in_issue.id,
      issueName: character.first_appeared_in_issue.name,
      issueNumber: character.first_appeared_in_issue.issue_number
    } : null,
    image: character.image?.thumb_url,
    imageOriginal: character.image?.original_url,
    url: character.site_detail_url,
    apiUrl: character.api_detail_url
  };
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

  const {
    q,
    query,
    type = 'issue',  // issue, volume, character, publisher, story_arc, person
    limit = '20',
    page = '1'
  } = req.query;

  const searchQuery = q || query;

  if (!searchQuery) {
    return res.status(400).json({
      error: 'Missing search query',
      message: 'Provide a search query using q or query parameter',
      examples: [
        '/api/comicvine/search?q=batman',
        '/api/comicvine/search?q=spider-man&type=issue',
        '/api/comicvine/search?q=x-men&type=volume',
        '/api/comicvine/search?q=wolverine&type=character'
      ],
      resourceTypes: ['issue', 'volume', 'character', 'publisher', 'story_arc', 'person']
    });
  }

  const resourceType = String(type) as ResourceType;
  const validTypes: ResourceType[] = ['issue', 'volume', 'character', 'publisher', 'story_arc', 'person'];
  
  if (!validTypes.includes(resourceType)) {
    return res.status(400).json({
      error: 'Invalid resource type',
      message: `Type must be one of: ${validTypes.join(', ')}`,
      provided: type
    });
  }

  try {
    const offset = (Number(page) - 1) * Number(limit);
    
    const params = new URLSearchParams({
      api_key: apiKey,
      format: 'json',
      query: String(searchQuery),
      resources: resourceType,
      limit: String(Math.min(Number(limit), 100)),
      offset: String(offset)
    });

    const response = await fetch(
      `${COMIC_VINE_BASE_URL}/search/?${params}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Collectibles Identification Platform)'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Comic Vine API error:', response.status, errorText);
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

    // Format results based on type
    let results: unknown[] = [];
    
    if (Array.isArray(data.results)) {
      switch (resourceType) {
        case 'issue':
          results = data.results.map((item: ComicVineIssue) => formatIssueResult(item));
          break;
        case 'volume':
          results = data.results.map((item: ComicVineVolume) => formatVolumeResult(item));
          break;
        case 'character':
          results = data.results.map((item: ComicVineCharacter) => formatCharacterResult(item));
          break;
        default:
          // Generic formatting for other types
          results = data.results.map((item: { id: number; name: string; image?: { thumb_url: string }; site_detail_url: string }) => ({
            id: item.id,
            type: resourceType,
            name: item.name,
            image: item.image?.thumb_url,
            url: item.site_detail_url
          }));
      }
    }

    return res.status(200).json({
      success: true,
      query: searchQuery,
      resourceType,
      totalResults: data.number_of_total_results || 0,
      page: Number(page),
      pageSize: Number(limit),
      offset,
      results
    });

  } catch (error) {
    console.error('Comic Vine search failed:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}