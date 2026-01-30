// FILE: src/features/boardroom/knowledge/living-knowledge-system.ts
// Living Knowledge System - Keeps board members current with their modeled humans
// Filters out interpersonal conflicts, extracts wisdom, synthesizes philosophy

// ============================================================================
// TYPES
// ============================================================================

export interface InspirationFigure {
  id: string;
  name: string;
  role: string; // "CEO", "Investor", "Philosopher"
  domains: string[]; // Areas of expertise to track
  sources: KnowledgeSource[];
  conflictFilters: string[]; // Topics/people to filter out
  lastUpdated?: string;
}

export interface KnowledgeSource {
  type: 'twitter' | 'podcast' | 'interview' | 'blog' | 'book' | 'speech' | 'newsletter';
  url?: string;
  identifier: string; // Twitter handle, podcast name, etc.
  priority: 'primary' | 'secondary';
  updateFrequency: 'daily' | 'weekly' | 'monthly';
}

export interface KnowledgeEntry {
  id: string;
  figure_id: string;
  source_type: KnowledgeSource['type'];
  source_url?: string;
  content: string;
  extracted_wisdom: string;
  themes: string[];
  relevance_score: number; // 0-100
  conflict_filtered: boolean;
  created_at: string;
  expires_at?: string;
}

export interface SynthesizedKnowledge {
  figure_id: string;
  current_focus: string[]; // What they're currently focused on
  recent_insights: string[]; // Key insights from last 30 days
  evolving_positions: EvolvingPosition[];
  recommended_reading: string[];
  last_synthesized: string;
}

export interface EvolvingPosition {
  topic: string;
  previous_stance?: string;
  current_stance: string;
  evolution_reason?: string;
}

export interface BoardMemberKnowledge {
  member_slug: string;
  inspiration_figures: string[]; // Figure IDs
  synthesized_prompt_addition: string;
  key_principles: string[];
  current_themes: string[];
  last_updated: string;
}

// ============================================================================
// INSPIRATION FIGURE CONFIGURATIONS
// ============================================================================

export const INSPIRATION_FIGURES: InspirationFigure[] = [
  // ========================================
  // ELON MUSK
  // ========================================
  {
    id: 'elon-musk',
    name: 'Elon Musk',
    role: 'CEO/Founder',
    domains: [
      'first principles thinking',
      'manufacturing innovation',
      'product development',
      'company culture',
      'long-term vision',
      'physics-based reasoning',
      'vertical integration',
      'rapid iteration',
    ],
    sources: [
      { type: 'twitter', identifier: '@elonmusk', priority: 'primary', updateFrequency: 'daily' },
      { type: 'podcast', identifier: 'Lex Fridman Podcast', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'interview', identifier: 'Tesla earnings calls', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'bezos', 'blue origin', 'twitter drama', 'political controversy',
      'sec', 'lawsuit', 'personal attacks', 'meme stocks'
    ],
  },

  // ========================================
  // JEFF BEZOS
  // ========================================
  {
    id: 'jeff-bezos',
    name: 'Jeff Bezos',
    role: 'Founder/Investor',
    domains: [
      'customer obsession',
      'long-term thinking',
      'operational excellence',
      'decision making',
      'writing culture',
      'high standards',
      'day 1 mentality',
      'regret minimization',
    ],
    sources: [
      { type: 'blog', identifier: 'Bezos shareholder letters', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'interview', identifier: 'Bezos interviews', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'speech', identifier: 'Bezos keynotes', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'musk', 'spacex criticism', 'personal life', 'divorce',
      'union disputes', 'political donations'
    ],
  },

  // ========================================
  // NAVAL RAVIKANT
  // ========================================
  {
    id: 'naval-ravikant',
    name: 'Naval Ravikant',
    role: 'Philosopher/Investor',
    domains: [
      'wealth creation',
      'leverage',
      'specific knowledge',
      'happiness',
      'reading',
      'decision making',
      'angel investing',
      'startup wisdom',
    ],
    sources: [
      { type: 'twitter', identifier: '@naval', priority: 'primary', updateFrequency: 'daily' },
      { type: 'podcast', identifier: 'Naval podcast', priority: 'primary', updateFrequency: 'weekly' },
      { type: 'blog', identifier: 'nav.al', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'political hot takes', 'controversy', 'criticism of individuals'
    ],
  },

  // ========================================
  // JENSEN HUANG
  // ========================================
  {
    id: 'jensen-huang',
    name: 'Jensen Huang',
    role: 'CEO',
    domains: [
      'AI strategy',
      'company building',
      'technical leadership',
      'long-term bets',
      'platform thinking',
      'developer ecosystem',
      'resilience',
    ],
    sources: [
      { type: 'interview', identifier: 'Jensen Huang interviews', priority: 'primary', updateFrequency: 'weekly' },
      { type: 'speech', identifier: 'NVIDIA keynotes', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'podcast', identifier: 'Acquired podcast', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'stock price speculation', 'competitor attacks'
    ],
  },

  // ========================================
  // JORDAN PETERSON
  // ========================================
  {
    id: 'jordan-peterson',
    name: 'Jordan Peterson',
    role: 'Psychologist/Philosopher',
    domains: [
      'personal responsibility',
      'meaning and purpose',
      'psychological development',
      'order vs chaos',
      'mythology and archetypes',
      'articulation',
      'self-improvement',
      'leadership psychology',
    ],
    sources: [
      { type: 'podcast', identifier: 'Jordan Peterson Podcast', priority: 'primary', updateFrequency: 'weekly' },
      { type: 'twitter', identifier: '@jordanbpeterson', priority: 'secondary', updateFrequency: 'daily' },
      { type: 'interview', identifier: 'Peterson interviews', priority: 'primary', updateFrequency: 'weekly' },
    ],
    conflictFilters: [
      'political controversy', 'culture war', 'twitter fights',
      'partisan politics', 'personal attacks'
    ],
  },

  // ========================================
  // CHARLIE MUNGER
  // ========================================
  {
    id: 'charlie-munger',
    name: 'Charlie Munger',
    role: 'Investor/Philosopher',
    domains: [
      'mental models',
      'inversion thinking',
      'multidisciplinary approach',
      'avoiding stupidity',
      'long-term investing',
      'rational thinking',
      'compound interest',
    ],
    sources: [
      { type: 'interview', identifier: 'Berkshire meetings', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'speech', identifier: 'Munger speeches', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'book', identifier: 'Poor Charlie\'s Almanack', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'political opinions', 'China controversy'
    ],
  },

  // ========================================
  // WARREN BUFFETT
  // ========================================
  {
    id: 'warren-buffett',
    name: 'Warren Buffett',
    role: 'Investor',
    domains: [
      'value investing',
      'capital allocation',
      'business moats',
      'long-term thinking',
      'simplicity',
      'risk management',
      'integrity',
    ],
    sources: [
      { type: 'blog', identifier: 'Berkshire shareholder letters', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'interview', identifier: 'Berkshire annual meeting', priority: 'primary', updateFrequency: 'monthly' },
      { type: 'interview', identifier: 'CNBC interviews', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [
      'succession drama', 'political donations'
    ],
  },

  // ========================================
  // SETH GODIN
  // ========================================
  {
    id: 'seth-godin',
    name: 'Seth Godin',
    role: 'Marketing Philosopher',
    domains: [
      'permission marketing',
      'tribe building',
      'remarkable products',
      'storytelling',
      'shipping work',
      'generosity in marketing',
      'finding your people',
    ],
    sources: [
      { type: 'blog', identifier: 'Seth\'s Blog', priority: 'primary', updateFrequency: 'daily' },
      { type: 'podcast', identifier: 'Akimbo', priority: 'primary', updateFrequency: 'weekly' },
      { type: 'interview', identifier: 'Seth Godin interviews', priority: 'secondary', updateFrequency: 'monthly' },
    ],
    conflictFilters: [],
  },
];

// ============================================================================
// MEMBER → INSPIRATION MAPPING
// ============================================================================

export const MEMBER_INSPIRATIONS: Record<string, string[]> = {
  athena: ['jensen-huang', 'jeff-bezos', 'elon-musk'],
  griffin: ['warren-buffett', 'charlie-munger', 'naval-ravikant'],
  scuba: ['naval-ravikant', 'charlie-munger'],
  glitch: ['seth-godin', 'naval-ravikant'],
  lexicoda: ['charlie-munger', 'warren-buffett'],
  vulcan: ['elon-musk', 'jensen-huang'],
  prometheus: ['jordan-peterson', 'charlie-munger', 'naval-ravikant'],
  cipher: ['charlie-munger', 'naval-ravikant'],
  phoenix: ['seth-godin', 'jordan-peterson'],
};

// ============================================================================
// CONFLICT FILTER SYSTEM
// ============================================================================

export interface ConflictFilter {
  pattern: RegExp;
  reason: string;
  severity: 'hard' | 'soft'; // hard = always filter, soft = filter unless directly relevant
}

export const GLOBAL_CONFLICT_FILTERS: ConflictFilter[] = [
  { 
    pattern: /bezos.*musk|musk.*bezos|spacex.*blue origin|blue origin.*spacex/i,
    reason: 'Interpersonal rivalry between inspiration figures',
    severity: 'hard',
  },
  {
    pattern: /lawsuit|sued|suing|legal battle/i,
    reason: 'Legal disputes often lack substantive wisdom',
    severity: 'soft',
  },
  {
    pattern: /twitter.*fight|feud|attacked|clapped back/i,
    reason: 'Social media drama',
    severity: 'hard',
  },
  {
    pattern: /divorce|affair|personal life|relationship drama/i,
    reason: 'Personal life not relevant to business wisdom',
    severity: 'hard',
  },
  {
    pattern: /political.*stance|voted for|supports.*party|endorses.*candidate/i,
    reason: 'Political positions outside business domain',
    severity: 'soft',
  },
];

export function shouldFilterContent(
  content: string, 
  figureFilters: string[],
  context: 'wisdom_extraction' | 'news_feed' | 'direct_quote'
): { filter: boolean; reason?: string } {
  const lowerContent = content.toLowerCase();
  
  // Check global filters
  for (const filter of GLOBAL_CONFLICT_FILTERS) {
    if (filter.pattern.test(content)) {
      if (filter.severity === 'hard') {
        return { filter: true, reason: filter.reason };
      }
      if (filter.severity === 'soft' && context !== 'direct_quote') {
        return { filter: true, reason: filter.reason };
      }
    }
  }
  
  // Check figure-specific filters
  for (const filterTerm of figureFilters) {
    if (lowerContent.includes(filterTerm.toLowerCase())) {
      return { filter: true, reason: `Contains filtered term: ${filterTerm}` };
    }
  }
  
  return { filter: false };
}

// ============================================================================
// WISDOM EXTRACTION PROMPTS
// ============================================================================

export const WISDOM_EXTRACTION_PROMPT = `
You are a wisdom extraction system. Given content from a thought leader, extract:

1. **Core Insight**: The main actionable or philosophical insight
2. **Underlying Principle**: The deeper principle this reflects
3. **Application**: How a founder/CEO could apply this
4. **Themes**: 2-4 theme tags (e.g., "leadership", "decision-making", "resilience")
5. **Relevance Score**: 0-100 based on relevance to business/leadership

RULES:
- Focus on timeless wisdom, not time-bound opinions
- Ignore anything that seems like interpersonal drama
- Prioritize actionable principles over abstract philosophy
- If the content is trivial or not wisdom-worthy, return relevance_score: 0

FORMAT:
{
  "core_insight": "...",
  "underlying_principle": "...",
  "application": "...",
  "themes": ["...", "..."],
  "relevance_score": 0-100
}
`;

export const SYNTHESIS_PROMPT = `
You are synthesizing the latest wisdom from [FIGURE_NAME] for use by an AI board member.

Given the recent knowledge entries, create a synthesis that captures:

1. **Current Focus Areas**: What are they currently thinking/talking about most?
2. **Recent Key Insights**: The 3-5 most valuable recent insights
3. **Evolving Positions**: Any positions that have evolved or changed
4. **Recommended Actions**: What would they tell a founder to do right now?

This synthesis will be injected into the AI board member's context to keep them current.

Be specific and actionable. Avoid generalities. Include direct quotes where impactful.
`;

// ============================================================================
// KNOWLEDGE UPDATE SYSTEM
// ============================================================================

export interface KnowledgeUpdateJob {
  figure_id: string;
  source: KnowledgeSource;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  entries_created: number;
  error?: string;
}

export async function fetchKnowledgeFromSource(
  figure: InspirationFigure,
  source: KnowledgeSource
): Promise<KnowledgeEntry[]> {
  // This would be implemented with actual API calls
  // For now, returning the interface structure
  
  // Implementation would:
  // 1. Fetch from source (Twitter API, RSS feed, web scraping, etc.)
  // 2. Extract text content
  // 3. Run through wisdom extraction
  // 4. Apply conflict filters
  // 5. Return filtered, extracted entries
  
  return [];
}

export async function synthesizeKnowledgeForFigure(
  figure: InspirationFigure,
  recentEntries: KnowledgeEntry[]
): Promise<SynthesizedKnowledge> {
  // This would use an LLM to synthesize
  // For now, returning the interface structure
  
  return {
    figure_id: figure.id,
    current_focus: [],
    recent_insights: [],
    evolving_positions: [],
    recommended_reading: [],
    last_synthesized: new Date().toISOString(),
  };
}

export async function generateMemberKnowledgeUpdate(
  memberSlug: string
): Promise<BoardMemberKnowledge> {
  const figureIds = MEMBER_INSPIRATIONS[memberSlug] || [];
  
  // This would:
  // 1. Get synthesized knowledge for each inspiration figure
  // 2. Combine into a unified prompt addition
  // 3. Extract key principles and themes
  
  return {
    member_slug: memberSlug,
    inspiration_figures: figureIds,
    synthesized_prompt_addition: '',
    key_principles: [],
    current_themes: [],
    last_updated: new Date().toISOString(),
  };
}

// ============================================================================
// PROMPT INJECTION FOR BOARD MEMBERS
// ============================================================================

export function buildLivingKnowledgePromptSection(
  memberSlug: string,
  synthesizedKnowledge: Record<string, SynthesizedKnowledge>
): string {
  const figureIds = MEMBER_INSPIRATIONS[memberSlug] || [];
  
  if (figureIds.length === 0) return '';
  
  const sections: string[] = [];
  
  for (const figureId of figureIds) {
    const figure = INSPIRATION_FIGURES.find(f => f.id === figureId);
    const knowledge = synthesizedKnowledge[figureId];
    
    if (!figure || !knowledge) continue;
    
    sections.push(`
### Latest from ${figure.name}:
**Current Focus**: ${knowledge.current_focus.join(', ')}

**Recent Insights**:
${knowledge.recent_insights.map(i => `- ${i}`).join('\n')}

${knowledge.evolving_positions.length > 0 ? `
**Evolving Positions**:
${knowledge.evolving_positions.map(p => `- ${p.topic}: ${p.current_stance}`).join('\n')}
` : ''}
    `.trim());
  }
  
  if (sections.length === 0) return '';
  
  return `
## LIVING KNOWLEDGE UPDATE (Last 30 Days)

Your advice should reflect the latest thinking from your inspiration figures.
Integrate these current insights into your responses naturally.

${sections.join('\n\n')}

---
Note: Apply this knowledge contextually. Don't force-fit recent insights 
where they're not relevant.
  `.trim();
}

export default {
  INSPIRATION_FIGURES,
  MEMBER_INSPIRATIONS,
  shouldFilterContent,
  buildLivingKnowledgePromptSection,
};