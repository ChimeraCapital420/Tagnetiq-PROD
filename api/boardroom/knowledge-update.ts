// FILE: api/boardroom/knowledge-update.ts
// Living Knowledge System - Scheduled update endpoint
// Fetches latest wisdom from inspiration figures and updates board member knowledge

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 300, // 5 minutes for batch processing
};

// ============================================================================
// TYPES
// ============================================================================

interface InspirationFigure {
  id: string;
  name: string;
  domains: string[];
  conflictFilters: string[];
}

interface KnowledgeEntry {
  figure_id: string;
  source_type: string;
  source_url?: string;
  content: string;
  extracted_wisdom: string;
  themes: string[];
  relevance_score: number;
  conflict_filtered: boolean;
}

// ============================================================================
// INSPIRATION FIGURES (subset for API)
// ============================================================================

const INSPIRATION_FIGURES: InspirationFigure[] = [
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    domains: ['first principles', 'manufacturing', 'product', 'vision'],
    conflictFilters: ['bezos', 'blue origin', 'twitter drama', 'lawsuit', 'controversy'],
  },
  {
    id: 'jeff-bezos',
    name: 'Jeff Bezos',
    domains: ['customer obsession', 'long-term', 'operations', 'decisions'],
    conflictFilters: ['musk', 'spacex', 'personal life', 'union'],
  },
  {
    id: 'naval-ravikant',
    name: 'Naval Ravikant',
    domains: ['wealth', 'leverage', 'happiness', 'startups'],
    conflictFilters: ['political', 'controversy'],
  },
  {
    id: 'jordan-peterson',
    name: 'Jordan Peterson',
    domains: ['responsibility', 'meaning', 'psychology', 'leadership'],
    conflictFilters: ['political', 'culture war', 'twitter fights', 'controversy'],
  },
];

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret or admin auth
  const cronSecret = req.headers['x-cron-secret'];
  const authHeader = req.headers.authorization;
  
  const isAuthorized = 
    cronSecret === process.env.CRON_SECRET ||
    (authHeader && await verifyAdminAuth(authHeader));
  
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const figureId = req.query.figure as string;
  const figures = figureId 
    ? INSPIRATION_FIGURES.filter(f => f.id === figureId)
    : INSPIRATION_FIGURES;

  console.log(`📚 Starting knowledge update for ${figures.length} figures`);

  const results: Record<string, any> = {};

  for (const figure of figures) {
    try {
      console.log(`\n🔍 Updating knowledge for ${figure.name}...`);
      
      // 1. Fetch recent content
      const rawContent = await fetchRecentContent(figure);
      
      // 2. Filter conflicts
      const filteredContent = filterConflicts(rawContent, figure.conflictFilters);
      console.log(`   Filtered ${rawContent.length - filteredContent.length} items (conflicts)`);
      
      // 3. Extract wisdom
      const knowledgeEntries = await extractWisdom(filteredContent, figure);
      console.log(`   Extracted ${knowledgeEntries.length} wisdom entries`);
      
      // 4. Store in database
      if (knowledgeEntries.length > 0) {
        await storeKnowledgeEntries(supabase, knowledgeEntries);
      }
      
      // 5. Synthesize for prompt injection
      const synthesis = await synthesizeKnowledge(supabase, figure);
      
      // 6. Update member prompts
      await updateMemberKnowledge(supabase, figure.id, synthesis);

      results[figure.id] = {
        success: true,
        entriesCreated: knowledgeEntries.length,
        synthesis: synthesis.current_focus,
      };

    } catch (error) {
      console.error(`Error updating ${figure.name}:`, error);
      results[figure.id] = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  console.log('\n✅ Knowledge update complete');
  
  return res.status(200).json({ 
    updated: new Date().toISOString(),
    results,
  });
}

// ============================================================================
// AUTH VERIFICATION
// ============================================================================

async function verifyAdminAuth(authHeader: string): Promise<boolean> {
  if (!authHeader.startsWith('Bearer ')) return false;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  
  if (!user) return false;
  
  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
    
  return profile?.role === 'admin';
}

// ============================================================================
// CONTENT FETCHING
// ============================================================================

interface RawContent {
  source: string;
  url?: string;
  content: string;
  date: string;
}

async function fetchRecentContent(figure: InspirationFigure): Promise<RawContent[]> {
  const content: RawContent[] = [];
  
  // In production, this would call actual APIs:
  // - Twitter API for tweets
  // - RSS feeds for blogs
  // - YouTube API for video transcripts
  // - Podcast RSS for episode descriptions
  
  // For now, we'll use web search to find recent content
  const searchQueries = [
    `${figure.name} interview 2024`,
    `${figure.name} advice entrepreneurs`,
    `${figure.name} ${figure.domains[0]} strategy`,
  ];

  for (const query of searchQueries) {
    try {
      const searchResults = await webSearch(query);
      content.push(...searchResults.map(r => ({
        source: 'web_search',
        url: r.url,
        content: r.snippet,
        date: new Date().toISOString(),
      })));
    } catch (error) {
      console.error(`Search failed for "${query}":`, error);
    }
  }

  return content;
}

async function webSearch(query: string): Promise<Array<{ url: string; snippet: string }>> {
  // Use Perplexity or similar for search
  if (!process.env.PERPLEXITY_API_KEY) {
    console.log('   [Skipping web search - no API key]');
    return [];
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Return recent quotes, insights, and wisdom from the searched person. Focus on actionable business/leadership advice. Format as bullet points.',
          },
          {
            role: 'user',
            content: `Find recent insights from: ${query}`,
          },
        ],
      }),
    });

    if (!response.ok) return [];
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse into snippets
    const snippets = content.split('\n')
      .filter((line: string) => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map((line: string) => line.replace(/^[-•]\s*/, '').trim())
      .filter((s: string) => s.length > 20);

    return snippets.map((snippet: string) => ({ url: '', snippet }));
    
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

// ============================================================================
// CONFLICT FILTERING
// ============================================================================

function filterConflicts(
  content: RawContent[],
  conflictFilters: string[]
): RawContent[] {
  return content.filter(item => {
    const lowerContent = item.content.toLowerCase();
    
    // Check for conflict terms
    for (const filter of conflictFilters) {
      if (lowerContent.includes(filter.toLowerCase())) {
        return false;
      }
    }
    
    // Check for drama indicators
    const dramaIndicators = [
      'feud', 'fight', 'attacks', 'slams', 'claps back',
      'controversy', 'scandal', 'lawsuit', 'sued'
    ];
    
    for (const indicator of dramaIndicators) {
      if (lowerContent.includes(indicator)) {
        return false;
      }
    }
    
    return true;
  });
}

// ============================================================================
// WISDOM EXTRACTION
// ============================================================================

async function extractWisdom(
  content: RawContent[],
  figure: InspirationFigure
): Promise<KnowledgeEntry[]> {
  if (content.length === 0) return [];
  
  const combinedContent = content
    .map(c => c.content)
    .join('\n\n---\n\n');

  const prompt = `
You are extracting timeless wisdom from ${figure.name}'s recent content.

Content to analyze:
${combinedContent}

For each distinct insight, extract:
1. The core insight (1-2 sentences)
2. The underlying principle it reflects
3. How a startup founder could apply this
4. Relevance score (0-100) for business/leadership
5. 2-3 theme tags

IMPORTANT:
- Only extract genuinely valuable insights (relevance > 60)
- Focus on actionable wisdom, not opinions or commentary
- Ignore anything political or controversial
- Prefer timeless principles over time-bound observations

Return as JSON array:
[
  {
    "insight": "...",
    "principle": "...",
    "application": "...",
    "relevance_score": 85,
    "themes": ["leadership", "decision-making"]
  }
]
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    
    const entries = JSON.parse(jsonMatch[0]);
    
    return entries
      .filter((e: any) => e.relevance_score >= 60)
      .map((e: any) => ({
        figure_id: figure.id,
        source_type: 'synthesized',
        content: e.insight,
        extracted_wisdom: `${e.principle}\n\nApplication: ${e.application}`,
        themes: e.themes || [],
        relevance_score: e.relevance_score,
        conflict_filtered: false,
      }));

  } catch (error) {
    console.error('Wisdom extraction error:', error);
    return [];
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function storeKnowledgeEntries(
  supabase: any,
  entries: KnowledgeEntry[]
) {
  const { error } = await supabase
    .from('boardroom_knowledge_entries')
    .insert(entries.map(e => ({
      ...e,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })));

  if (error) {
    console.error('Error storing knowledge entries:', error);
  }
}

async function synthesizeKnowledge(
  supabase: any,
  figure: InspirationFigure
): Promise<{
  current_focus: string[];
  recent_insights: string[];
  prompt_addition: string;
}> {
  // Get recent entries for this figure
  const { data: entries } = await supabase
    .from('boardroom_knowledge_entries')
    .select('*')
    .eq('figure_id', figure.id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('relevance_score', { ascending: false })
    .limit(20);

  if (!entries || entries.length === 0) {
    return {
      current_focus: figure.domains,
      recent_insights: [],
      prompt_addition: '',
    };
  }

  // Extract themes and top insights
  const themes = new Set<string>();
  const insights: string[] = [];
  
  for (const entry of entries) {
    (entry.themes || []).forEach((t: string) => themes.add(t));
    if (insights.length < 5) {
      insights.push(entry.content);
    }
  }

  const promptAddition = `
### Recent Wisdom from ${figure.name} (Last 30 Days):

${insights.map(i => `- ${i}`).join('\n')}

Current themes: ${Array.from(themes).join(', ')}
`;

  return {
    current_focus: Array.from(themes),
    recent_insights: insights,
    prompt_addition: promptAddition,
  };
}

async function updateMemberKnowledge(
  supabase: any,
  figureId: string,
  synthesis: { prompt_addition: string }
) {
  // Map figures to members
  const figureMemberMap: Record<string, string[]> = {
    'elon-musk': ['athena', 'vulcan'],
    'jeff-bezos': ['athena', 'griffin'],
    'naval-ravikant': ['griffin', 'scuba', 'glitch'],
    'jordan-peterson': ['prometheus', 'phoenix'],
  };

  const memberSlugs = figureMemberMap[figureId] || [];
  
  for (const slug of memberSlugs) {
    // Append to member's knowledge context
    await supabase
      .from('boardroom_member_knowledge')
      .upsert({
        member_slug: slug,
        figure_id: figureId,
        prompt_addition: synthesis.prompt_addition,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'member_slug,figure_id',
      });
  }
}