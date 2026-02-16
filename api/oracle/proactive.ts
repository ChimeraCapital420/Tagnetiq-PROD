// FILE: api/oracle/proactive.ts
// The Argos Engine - Oracle's proactive intelligence system
// FIXED: Uses verifyUser + supabaseAdmin (matches all other Oracle routes)
// FIXED: gpt-4-vision-preview → gpt-4o-mini
// Enhanced: Timing intelligence, seasonal awareness

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY!,
});

// =============================================================================
// AUTH — matches all other Oracle routes
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// =============================================================================
// SCHEMA VALIDATION
// =============================================================================

const sweepSchema = z.object({
  image: z.string(),
});

const triageSchema = z.object({
  image: z.string(),
  category: z.string(),
});

// =============================================================================
// SWEEP — Lightweight object detection
// =============================================================================

async function performSweep(image: string) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a rapid object detector. Identify the main objects in the image and return ONLY a comma-separated list of general categories (e.g., "book,watch,toy"). Be concise.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const categories = response.choices[0]?.message?.content?.split(',').map(c => c.trim()) || [];
    return categories;
  } catch (error) {
    console.error('[Argos] Sweep error:', error);
    return [];
  }
}

// =============================================================================
// TRIAGE — Deep analysis with three-tiered cascade
// =============================================================================

async function performTriage(image: string, category: string, userId: string) {
  try {
    // Tier 1: HYDRA Analysis (identification + valuation)
    const hydraPromise = openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert appraiser specializing in ${category}. Analyze this item and provide:
1. Specific identification (brand, model, edition, etc.)
2. Estimated value range
3. Key features that affect value
4. Condition assessment if visible

Format your response as JSON with fields: identification, estimated_value, key_features, condition`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    // Tier 2: Personal Relevance Check
    const interestsPromise = supabaseAdmin
      .from('user_interests')
      .select('*')
      .eq('user_id', userId);

    // Tier 3: Market Relevance Check
    const watchlistPromise = supabaseAdmin
      .from('watchlist')
      .select('*')
      .eq('is_active', true)
      .limit(100);

    const bountiesPromise = supabaseAdmin
      .from('bounties')
      .select('*')
      .eq('status', 'active')
      .limit(50);

    // Execute all tiers concurrently
    const [hydraResponse, interestsResult, watchlistResult, bountiesResult] = await Promise.all([
      hydraPromise,
      interestsPromise,
      watchlistPromise,
      bountiesPromise,
    ]);

    // Parse HYDRA analysis
    let analysis;
    try {
      const content = hydraResponse.choices[0]?.message?.content || '{}';
      analysis = JSON.parse(content);
    } catch {
      analysis = {
        identification: hydraResponse.choices[0]?.message?.content || 'Unknown',
        estimated_value: 'Unable to determine',
      };
    }

    // Check personal relevance
    const interests = interestsResult.data || [];
    const personalMatches = interests.filter((interest: any) => {
      const value = interest.interest_value.toLowerCase();
      const identification = analysis.identification?.toLowerCase() || '';

      switch (interest.interest_type) {
        case 'category':
          return category.toLowerCase().includes(value);
        case 'keyword':
          return identification.includes(value);
        case 'brand':
          return identification.includes(value);
        default:
          return false;
      }
    });

    // Check market relevance
    const watchlist = watchlistResult.data || [];
    const bounties = bountiesResult.data || [];

    const watchlistMatches = watchlist.filter((item: any) => {
      const searchTerms = item.search_terms?.toLowerCase() || '';
      const identification = analysis.identification?.toLowerCase() || '';
      return searchTerms.split(',').some((term: string) => identification.includes(term.trim()));
    });

    const bountyMatches = bounties.filter((bounty: any) => {
      const description = bounty.description?.toLowerCase() || '';
      const identification = analysis.identification?.toLowerCase() || '';
      return description.includes(identification) || identification.includes(description);
    });

    // Synthesize nudge
    const nudgeReasons: string[] = [];
    let priority = 'low';

    if (analysis.estimated_value && analysis.estimated_value !== 'Unable to determine') {
      const valueStr = analysis.estimated_value.toString();
      if (valueStr.includes('k') || valueStr.includes('K') || parseInt(valueStr) > 1000) {
        nudgeReasons.push('High value detected');
        priority = 'high';
      }
    }

    if (personalMatches.length > 0) {
      nudgeReasons.push(`Matches your ${personalMatches.map((m: any) => `'${m.interest_value}'`).join(', ')} interest${personalMatches.length > 1 ? 's' : ''}`);
      priority = priority === 'low' ? 'medium' : priority;
    }

    if (watchlistMatches.length > 0) {
      nudgeReasons.push('Item is on the Arena Watchlist!');
      priority = 'high';
    }

    if (bountyMatches.length > 0) {
      nudgeReasons.push(`Active bounty: ${bountyMatches[0].reward_amount} points!`);
      priority = 'high';
    }

    // Seasonal context awareness
    const seasonalNote = getSeasonalNote(category);
    if (seasonalNote) {
      nudgeReasons.push(seasonalNote);
    }

    return {
      analysis,
      nudge: {
        should_alert: nudgeReasons.length > 0,
        reasons: nudgeReasons,
        priority,
        personal_matches: personalMatches.length,
        market_matches: watchlistMatches.length + bountyMatches.length,
      },
    };
  } catch (error) {
    console.error('[Argos] Triage error:', error);
    throw error;
  }
}

// =============================================================================
// SEASONAL AWARENESS (lightweight, no external deps)
// =============================================================================

function getSeasonalNote(category: string): string | null {
  const month = new Date().getMonth();
  const lower = category.toLowerCase();

  // Q4 holiday season (Oct-Dec)
  if (month >= 9 && month <= 11) {
    if (['toy', 'game', 'lego', 'collectible', 'electronics'].some(c => lower.includes(c))) {
      return '🎄 Holiday season — demand is HIGH for this category right now';
    }
  }

  // Back to school (Jul-Aug)
  if (month >= 6 && month <= 7) {
    if (['electronics', 'laptop', 'backpack', 'book'].some(c => lower.includes(c))) {
      return '🎒 Back-to-school demand building for this category';
    }
  }

  // Spring cleaning supply surge (Mar-May)
  if (month >= 2 && month <= 4) {
    return null; // Great sourcing time but not a demand signal
  }

  // Football season (Sep-Jan)
  if ((month >= 8 || month <= 0) && lower.includes('football')) {
    return '🏈 Football season — sports memorabilia demand is elevated';
  }

  return null;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const endpoint = req.url?.split('/').pop();

  try {
    switch (endpoint) {
      case 'sweep': {
        const { image } = sweepSchema.parse(req.body);
        const categories = await performSweep(image);
        return res.status(200).json({ categories });
      }

      case 'triage': {
        const triageData = triageSchema.parse(req.body);
        const result = await performTriage(triageData.image, triageData.category, user.id);
        return res.status(200).json(result);
      }

      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    console.error('[Argos] Engine error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
