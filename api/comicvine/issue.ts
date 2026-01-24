// FILE: api/comicvine/issue.ts
// Comic Vine Issue Details

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';

interface ComicVineCredit {
  id: number;
  name: string;
  role: string;
  api_detail_url: string;
  site_detail_url: string;
}

interface ComicVineCharacterAppearance {
  id: number;
  name: string;
  api_detail_url: string;
  site_detail_url: string;
}

interface ComicVineTeamAppearance {
  id: number;
  name: string;
  api_detail_url: string;
  site_detail_url: string;
}

interface ComicVineStoryArc {
  id: number;
  name: string;
  api_detail_url: string;
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
      error: 'Missing issue ID',
      message: 'Provide a Comic Vine issue ID',
      examples: [
        '/api/comicvine/issue?id=111265',
        '/api/comicvine/issue?id=4000-111265'
      ],
      note: 'Issue IDs can be found via /api/comicvine/search'
    });
  }

  // Comic Vine IDs can be prefixed with resource type (4000- for issues)
  const issueId = String(id).includes('-') ? id : `4000-${id}`;

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      format: 'json',
      field_list: [
        'id', 'name', 'issue_number', 'volume', 'cover_date', 'store_date',
        'image', 'description', 'person_credits', 'character_credits',
        'team_credits', 'story_arc_credits', 'first_appearance_characters',
        'first_appearance_concepts', 'first_appearance_locations',
        'first_appearance_objects', 'first_appearance_storyarcs',
        'first_appearance_teams', 'has_staff_review', 'site_detail_url',
        'api_detail_url', 'deck'
      ].join(',')
    });

    const response = await fetch(
      `${COMIC_VINE_BASE_URL}/issue/${issueId}/?${params}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'TagnetIQ/1.0 (Collectibles Identification Platform)'
        }
      }
    );

    if (response.status === 404) {
      return res.status(404).json({
        error: 'Issue not found',
        message: `No issue found with ID: ${id}`,
        suggestion: 'Use /api/comicvine/search to find valid issue IDs'
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

    const issue = data.results;

    if (!issue) {
      return res.status(404).json({
        error: 'Issue not found',
        message: `No issue found with ID: ${id}`
      });
    }

    // Build comprehensive response
    const issueName = issue.name 
      ? `${issue.volume?.name} #${issue.issue_number} - ${issue.name}`
      : `${issue.volume?.name} #${issue.issue_number}`;

    // Organize credits by role
    const creditsByRole: Record<string, string[]> = {};
    if (Array.isArray(issue.person_credits)) {
      issue.person_credits.forEach((credit: ComicVineCredit) => {
        const role = credit.role || 'Other';
        if (!creditsByRole[role]) {
          creditsByRole[role] = [];
        }
        creditsByRole[role].push(credit.name);
      });
    }

    const result = {
      success: true,
      issue: {
        id: issue.id,
        name: issueName,
        issueName: issue.name,
        issueNumber: issue.issue_number,
        
        // Volume info
        volume: issue.volume ? {
          id: issue.volume.id,
          name: issue.volume.name,
          apiUrl: issue.volume.api_detail_url
        } : null,
        
        // Dates
        coverDate: issue.cover_date,
        storeDate: issue.store_date,
        
        // Description
        deck: issue.deck, // Short description
        description: issue.description, // Full HTML description
        
        // Images
        images: issue.image ? {
          icon: issue.image.icon_url,
          thumb: issue.image.thumb_url,
          small: issue.image.small_url,
          medium: issue.image.medium_url,
          screen: issue.image.screen_url,
          large: issue.image.super_url,
          original: issue.image.original_url
        } : null,
        
        // Credits
        credits: creditsByRole,
        allCredits: Array.isArray(issue.person_credits) 
          ? issue.person_credits.map((c: ComicVineCredit) => ({
              id: c.id,
              name: c.name,
              role: c.role
            }))
          : [],
        
        // Character appearances
        characters: Array.isArray(issue.character_credits)
          ? issue.character_credits.map((c: ComicVineCharacterAppearance) => ({
              id: c.id,
              name: c.name,
              url: c.site_detail_url
            }))
          : [],
        
        // Team appearances
        teams: Array.isArray(issue.team_credits)
          ? issue.team_credits.map((t: ComicVineTeamAppearance) => ({
              id: t.id,
              name: t.name,
              url: t.site_detail_url
            }))
          : [],
        
        // Story arcs
        storyArcs: Array.isArray(issue.story_arc_credits)
          ? issue.story_arc_credits.map((s: ComicVineStoryArc) => ({
              id: s.id,
              name: s.name,
              url: s.site_detail_url
            }))
          : [],
        
        // First appearances (key for value!)
        firstAppearances: {
          characters: issue.first_appearance_characters || [],
          teams: issue.first_appearance_teams || [],
          concepts: issue.first_appearance_concepts || [],
          locations: issue.first_appearance_locations || [],
          objects: issue.first_appearance_objects || [],
          storyArcs: issue.first_appearance_storyarcs || []
        },
        
        hasFirstAppearances: !!(
          issue.first_appearance_characters?.length ||
          issue.first_appearance_teams?.length
        ),
        
        // Links
        url: issue.site_detail_url,
        apiUrl: issue.api_detail_url,
        
        hasStaffReview: issue.has_staff_review
      },
      
      // For Hydra integration
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
        description: issueName,
        keyFactors: {
          hasFirstAppearances: !!(
            issue.first_appearance_characters?.length ||
            issue.first_appearance_teams?.length
          ),
          firstAppearanceCount: (
            (issue.first_appearance_characters?.length || 0) +
            (issue.first_appearance_teams?.length || 0)
          ),
          characterAppearanceCount: issue.character_credits?.length || 0,
          isKeyIssue: !!(
            issue.first_appearance_characters?.length ||
            issue.first_appearance_teams?.length
          )
        },
        // Notable creators can affect value
        notableCreators: Object.entries(creditsByRole)
          .filter(([role]) => ['writer', 'artist', 'cover'].some(r => role.toLowerCase().includes(r)))
          .flatMap(([, names]) => names)
      }
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Comic Vine issue fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch issue',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}