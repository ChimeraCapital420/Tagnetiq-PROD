// FILE: src/lib/oracle/eyes/recall.ts
// Oracle Eyes — Visual Memory Recall
//
// Sprint M: Oracle Eyes — "Where did I leave my keys?"
//
// This is the query engine that finds relevant memories when the user
// asks spatial/temporal questions in Oracle chat.
//
// Search strategy (multi-pass, returns best results):
//   1. Full-text search on description, extracted_text, tags
//   2. Object name matching (JSONB contains)
//   3. Time-range filtering (for "what did I see yesterday?" queries)
//   4. Location matching (for "what's in my garage?" queries)
//
// Mobile-first: All recall runs server-side. Client sends the question,
// server returns structured memories with relevance scores.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VisualMemory, VisualObject } from './capture.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RecallQuery {
  /** The user's natural language question */
  question: string;
  /** Extracted search terms (from Oracle chat context) */
  searchTerms?: string[];
  /** Time range filter */
  timeRange?: {
    after?: string;   // ISO date
    before?: string;  // ISO date
  };
  /** Location filter */
  location?: string;
  /** Max results to return */
  limit?: number;
}

export interface RecallResult {
  /** Matched memories, sorted by relevance */
  memories: RecalledMemory[];
  /** Total matches found */
  totalMatches: number;
  /** Search strategy that found results */
  strategy: 'fulltext' | 'object' | 'time' | 'location' | 'combined';
  /** Processing time in ms */
  processingTime: number;
}

export interface RecalledMemory {
  id: string;
  mode: string;
  description: string;
  objects: VisualObject[];
  extracted_text: string | null;
  tags: string[];
  location_hint: string | null;
  observed_at: string;
  source: string;
  analysis_id: string | null;
  image_url: string | null;
  /** Relevance score 0-1 */
  relevance: number;
  /** Why this memory matched */
  match_reason: string;
}

// =============================================================================
// MAIN RECALL — Multi-strategy search
// =============================================================================

/**
 * Search Oracle's visual memories for relevant matches.
 * Uses multiple strategies and merges results by relevance.
 *
 * @param supabase - Admin client
 * @param userId   - Whose memories to search
 * @param query    - What to look for
 */
export async function recallMemories(
  supabase: SupabaseClient,
  userId: string,
  query: RecallQuery
): Promise<RecallResult> {
  const startTime = Date.now();
  const limit = query.limit || 10;

  // Parse the question into search components
  const parsed = parseRecallQuestion(query.question);
  const searchTerms = query.searchTerms || parsed.terms;

  // Run search strategies in parallel
  const [fulltextResults, objectResults, timeResults] = await Promise.all([
    // Strategy 1: Full-text search
    searchTerms.length > 0
      ? searchFullText(supabase, userId, searchTerms.join(' & '), limit)
      : Promise.resolve([]),

    // Strategy 2: Object name matching
    parsed.objectNames.length > 0
      ? searchByObjectName(supabase, userId, parsed.objectNames, limit)
      : Promise.resolve([]),

    // Strategy 3: Time-range search
    parsed.timeRange || query.timeRange
      ? searchByTime(supabase, userId, parsed.timeRange || query.timeRange!, limit)
      : Promise.resolve([]),
  ]);

  // Strategy 4: Location search (if location mentioned)
  let locationResults: RecalledMemory[] = [];
  if (parsed.location || query.location) {
    locationResults = await searchByLocation(
      supabase, userId, parsed.location || query.location!, limit
    );
  }

  // Merge and deduplicate, keeping highest relevance per memory
  const merged = mergeResults([
    ...fulltextResults,
    ...objectResults,
    ...timeResults,
    ...locationResults,
  ]);

  // Sort by relevance, then by recency
  merged.sort((a, b) => {
    if (Math.abs(a.relevance - b.relevance) > 0.1) {
      return b.relevance - a.relevance;
    }
    return new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime();
  });

  const topResults = merged.slice(0, limit);

  // Determine which strategy was most effective
  const strategy = fulltextResults.length > 0 ? 'fulltext'
    : objectResults.length > 0 ? 'object'
    : timeResults.length > 0 ? 'time'
    : locationResults.length > 0 ? 'location'
    : 'combined';

  return {
    memories: topResults,
    totalMatches: merged.length,
    strategy,
    processingTime: Date.now() - startTime,
  };
}

// =============================================================================
// SEARCH STRATEGIES
// =============================================================================

/**
 * Full-text search across description, extracted_text, and tags.
 * Uses Postgres tsvector for fast, ranked search.
 */
async function searchFullText(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  limit: number
): Promise<RecalledMemory[]> {
  try {
    // Clean query for websearch syntax
    const cleanQuery = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' | '); // OR search for broader results

    if (!cleanQuery) return [];

    const { data, error } = await supabase
      .from('oracle_visual_memory')
      .select('*')
      .eq('user_id', userId)
      .is('forgotten_at', null)
      .textSearch('search_vector', cleanQuery, { type: 'websearch' })
      .order('observed_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map(row => ({
      ...mapRowToMemory(row),
      relevance: 0.9, // Full-text matches are high relevance
      match_reason: `Text match: "${query}"`,
    }));
  } catch {
    return [];
  }
}

/**
 * Search by object names within the JSONB objects array.
 * For queries like "where are my keys?" → search objects for "keys"
 */
async function searchByObjectName(
  supabase: SupabaseClient,
  userId: string,
  objectNames: string[],
  limit: number
): Promise<RecalledMemory[]> {
  const results: RecalledMemory[] = [];

  for (const name of objectNames) {
    try {
      // Search objects JSONB for matching names
      // Using ilike on cast to text for broad matching
      const { data, error } = await supabase
        .from('oracle_visual_memory')
        .select('*')
        .eq('user_id', userId)
        .is('forgotten_at', null)
        .or(`description.ilike.%${name}%,tags.cs.{${name.toLowerCase()}}`)
        .order('observed_at', { ascending: false })
        .limit(limit);

      if (error || !data) continue;

      for (const row of data) {
        // Check if any object in the array matches
        const objects = (row.objects || []) as VisualObject[];
        const matchedObj = objects.find(o =>
          o.name.toLowerCase().includes(name.toLowerCase())
        );

        results.push({
          ...mapRowToMemory(row),
          relevance: matchedObj ? 0.95 : 0.7, // Direct object match is highest
          match_reason: matchedObj
            ? `Object found: "${matchedObj.name}"${matchedObj.position_hint ? ` (${matchedObj.position_hint})` : ''}`
            : `Mentioned in description: "${name}"`,
        });
      }
    } catch {
      continue;
    }
  }

  return results;
}

/**
 * Search by time range.
 * For "what did I see yesterday?" or "what did I scan last week?"
 */
async function searchByTime(
  supabase: SupabaseClient,
  userId: string,
  timeRange: { after?: string; before?: string },
  limit: number
): Promise<RecalledMemory[]> {
  try {
    let query = supabase
      .from('oracle_visual_memory')
      .select('*')
      .eq('user_id', userId)
      .is('forgotten_at', null);

    if (timeRange.after) {
      query = query.gte('observed_at', timeRange.after);
    }
    if (timeRange.before) {
      query = query.lte('observed_at', timeRange.before);
    }

    const { data, error } = await query
      .order('observed_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map(row => ({
      ...mapRowToMemory(row),
      relevance: 0.7,
      match_reason: 'Time range match',
    }));
  } catch {
    return [];
  }
}

/**
 * Search by location hint.
 * For "what's in my garage?" or "what did I see at the flea market?"
 */
async function searchByLocation(
  supabase: SupabaseClient,
  userId: string,
  location: string,
  limit: number
): Promise<RecalledMemory[]> {
  try {
    const { data, error } = await supabase
      .from('oracle_visual_memory')
      .select('*')
      .eq('user_id', userId)
      .is('forgotten_at', null)
      .ilike('location_hint', `%${location}%`)
      .order('observed_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map(row => ({
      ...mapRowToMemory(row),
      relevance: 0.85,
      match_reason: `Location: "${location}"`,
    }));
  } catch {
    return [];
  }
}

// =============================================================================
// QUESTION PARSER — Extract search intent from natural language
// =============================================================================

interface ParsedQuestion {
  terms: string[];
  objectNames: string[];
  timeRange?: { after?: string; before?: string };
  location?: string;
}

/**
 * Parse a natural language recall question into structured search components.
 * "Where did I put my keys yesterday in the kitchen?"
 *  → terms: ['keys'], objects: ['keys'], time: yesterday, location: 'kitchen'
 */
function parseRecallQuestion(question: string): ParsedQuestion {
  const lower = question.toLowerCase();
  const result: ParsedQuestion = {
    terms: [],
    objectNames: [],
  };

  // ── Extract time references ─────────────────────────────
  const now = new Date();

  if (lower.includes('today')) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    result.timeRange = { after: startOfDay.toISOString() };
  } else if (lower.includes('yesterday')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    result.timeRange = {
      after: yesterday.toISOString(),
      before: endOfYesterday.toISOString(),
    };
  } else if (lower.includes('last week') || lower.includes('this week')) {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    result.timeRange = { after: weekAgo.toISOString() };
  } else if (lower.includes('last month') || lower.includes('this month')) {
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    result.timeRange = { after: monthAgo.toISOString() };
  }

  // ── Extract location references ─────────────────────────
  const locationPatterns = [
    /(?:in|at|on|near)\s+(?:the\s+|my\s+)?(\w+(?:\s+\w+)?)\s*(?:\?|$|,)/i,
    /(?:garage|kitchen|bedroom|office|living room|bathroom|basement|attic|shelf|desk|table|counter|drawer)/i,
  ];

  for (const pattern of locationPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const loc = match[1] || match[0];
      // Verify it's a location, not a random word
      if (KNOWN_LOCATIONS.has(loc.trim().toLowerCase())) {
        result.location = loc.trim();
        break;
      }
    }
  }

  // ── Extract object names ────────────────────────────────
  // Remove time/location words, then extract nouns
  const cleaned = lower
    .replace(/\b(where|what|when|did|do|have|has|was|were|is|are|put|leave|left|see|saw|find|my|the|that|this|those|these|in|at|on|near|last|yesterday|today|week|month|ago|did|you|i)\b/g, '')
    .replace(/[?!.,]/g, '')
    .trim();

  const words = cleaned.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS_RECALL.has(w));

  if (words.length > 0) {
    result.objectNames = words;
    result.terms = words;
  }

  return result;
}

// =============================================================================
// HELPERS
// =============================================================================

function mapRowToMemory(row: any): Omit<RecalledMemory, 'relevance' | 'match_reason'> {
  return {
    id: row.id,
    mode: row.mode,
    description: row.description || '',
    objects: row.objects || [],
    extracted_text: row.extracted_text || null,
    tags: row.tags || [],
    location_hint: row.location_hint || null,
    observed_at: row.observed_at,
    source: row.source || 'phone_camera',
    analysis_id: row.analysis_id || null,
    image_url: row.image_url || null,
  };
}

function mergeResults(results: RecalledMemory[]): RecalledMemory[] {
  const byId = new Map<string, RecalledMemory>();

  for (const result of results) {
    const existing = byId.get(result.id);
    if (!existing || result.relevance > existing.relevance) {
      byId.set(result.id, result);
    }
  }

  return [...byId.values()];
}

const KNOWN_LOCATIONS = new Set([
  'garage', 'kitchen', 'bedroom', 'office', 'living room', 'bathroom',
  'basement', 'attic', 'closet', 'shelf', 'desk', 'table', 'counter',
  'drawer', 'cabinet', 'bookshelf', 'nightstand', 'dresser', 'workbench',
  'car', 'trunk', 'backpack', 'bag', 'pocket', 'wallet',
  'flea market', 'estate sale', 'garage sale', 'pawn shop', 'thrift store',
  'antique shop', 'store', 'shop', 'market', 'fair', 'convention',
]);

const STOP_WORDS_RECALL = new Set([
  'about', 'also', 'been', 'could', 'from', 'have', 'into',
  'just', 'might', 'more', 'other', 'should', 'some', 'that',
  'their', 'them', 'then', 'there', 'they', 'very', 'what',
  'when', 'where', 'which', 'with', 'would', 'remember', 'recall',
  'show', 'tell', 'know',
]);

// =============================================================================
// CONTEXT BUILDER — For injecting recall results into Oracle chat prompt
// =============================================================================

/**
 * Build a system prompt section from recall results.
 * Used when Oracle detects a recall-type question in chat.
 */
export function buildRecallPromptBlock(results: RecallResult): string {
  if (results.memories.length === 0) {
    return '\n\n## VISUAL MEMORY SEARCH\nNo matching visual memories found for this query. Let the user know you searched but couldn\'t find it. If appropriate, suggest they scan or capture the area in question.\n';
  }

  let block = '\n\n## VISUAL MEMORY SEARCH RESULTS\n';
  block += 'You searched your visual memory and found these matches. ';
  block += 'Reference specific details — timestamps, positions, descriptions. ';
  block += 'Be natural: "I remember seeing your keys on the kitchen counter last Tuesday."\n\n';

  for (const mem of results.memories) {
    const when = new Date(mem.observed_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });

    block += `---\n`;
    block += `WHEN: ${when}\n`;
    block += `WHAT: ${mem.description}\n`;
    block += `MATCH: ${mem.match_reason}\n`;

    if (mem.location_hint) {
      block += `WHERE: ${mem.location_hint}\n`;
    }

    if (mem.objects.length > 0) {
      block += `OBJECTS: ${mem.objects.map(o =>
        `${o.name}${o.position_hint ? ` [${o.position_hint}]` : ''}`
      ).join(', ')}\n`;
    }

    if (mem.extracted_text) {
      const preview = mem.extracted_text.length > 200
        ? mem.extracted_text.substring(0, 200) + '...'
        : mem.extracted_text;
      block += `TEXT: ${preview}\n`;
    }

    block += '\n';
  }

  return block;
}