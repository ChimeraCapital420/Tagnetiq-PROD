// FILE: src/lib/oracle/memory/index.ts
// Oracle Long-Term Memory — retrieval, semantic matching, expertise derivation
// Searches compressed conversation summaries to give Dash persistent recall
// "You were really into vintage Pyrex back in March — still collecting those?"

export { compressConversation, shouldCompress, getUserMemories } from './compressor.js';
export type { MemorySummary } from './compressor.js';

import { createClient } from '@supabase/supabase-js';
import type { MemorySummary } from './compressor.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// RELEVANT MEMORY RETRIEVAL
// =============================================================================

/**
 * Find memories relevant to the current message.
 * Uses keyword matching on topics + interests (fast, cheap, no embeddings needed).
 * Returns max 5 most relevant summaries.
 */
export async function getRelevantMemories(
  userId: string,
  currentMessage: string,
  maxResults = 5,
): Promise<MemorySummary[]> {
  // Extract keywords from current message (lowercase, deduped, no stop words)
  const keywords = extractKeywords(currentMessage);
  if (keywords.length === 0) {
    // No strong keywords — return most recent memories instead
    return getRecentMemories(userId, maxResults);
  }

  // Fetch all user memories (they're small — ~500 tokens each)
  const { data: allMemories, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50); // Max 50 memories to score

  if (error || !allMemories?.length) return [];

  // Score each memory by keyword overlap
  const scored = allMemories.map(memory => {
    let score = 0;
    const memoryText = [
      memory.summary,
      ...(memory.topics || []),
      ...(memory.interests_revealed || []).map((i: any) => `${i.category} ${i.specifics}`),
      ...(memory.items_discussed || []).map((i: any) => `${i.name} ${i.category || ''}`),
      ...(memory.promises_made || []).map((p: any) => p.promise),
    ].join(' ').toLowerCase();

    for (const keyword of keywords) {
      if (memoryText.includes(keyword)) {
        score += 1;
        // Bonus for topic match (most important)
        if ((memory.topics || []).some((t: string) => t.toLowerCase().includes(keyword))) {
          score += 2;
        }
      }
    }

    return { memory, score };
  });

  // Return top N by score, filtering out zero-scores
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.memory);
}

/**
 * Get most recent memories (fallback when no keyword match).
 */
export async function getRecentMemories(
  userId: string,
  limit = 3,
): Promise<MemorySummary[]> {
  const { data, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

// =============================================================================
// EXPERTISE LEVEL DERIVATION
// =============================================================================

/**
 * Derive user's overall expertise level from all memory summaries.
 * Aggregates expertise_signals across all conversations.
 */
export async function getExpertiseLevel(userId: string): Promise<{
  level: string;
  indicators: string[];
  conversationsAnalyzed: number;
}> {
  const { data: memories, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('expertise_signals')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !memories?.length) {
    return { level: 'newcomer', indicators: [], conversationsAnalyzed: 0 };
  }

  // Count expertise level occurrences
  const levelCounts: Record<string, number> = {};
  const allIndicators: string[] = [];

  for (const m of memories) {
    const sig = m.expertise_signals;
    if (sig?.level) {
      levelCounts[sig.level] = (levelCounts[sig.level] || 0) + 1;
    }
    if (sig?.indicators) {
      allIndicators.push(...sig.indicators);
    }
  }

  // Dominant level = most frequent
  const dominantLevel = Object.entries(levelCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'newcomer';

  // Deduplicate indicators
  const uniqueIndicators = [...new Set(allIndicators)].slice(0, 10);

  return {
    level: dominantLevel,
    indicators: uniqueIndicators,
    conversationsAnalyzed: memories.length,
  };
}

// =============================================================================
// UNFULFILLED PROMISES
// =============================================================================

/**
 * Get promises Oracle made that haven't been fulfilled yet.
 * Used for proactive follow-up: "Remember when I said I'd watch for X?"
 */
export async function getUnfulfilledPromises(userId: string): Promise<Array<{
  promise: string;
  context: string;
  conversationDate: string;
}>> {
  const { data, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('promises_made, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const unfulfilled: Array<{ promise: string; context: string; conversationDate: string }> = [];

  for (const memory of data) {
    const promises = memory.promises_made || [];
    for (const p of promises) {
      if (!p.fulfilled) {
        unfulfilled.push({
          promise: p.promise,
          context: p.context,
          conversationDate: memory.created_at,
        });
      }
    }
  }

  return unfulfilled.slice(0, 10); // Max 10 active promises
}

// =============================================================================
// USER INTERESTS AGGREGATION
// =============================================================================

/**
 * Aggregate all revealed interests across conversations.
 * Returns ranked list by intensity and frequency.
 */
export async function getAggregatedInterests(userId: string): Promise<Array<{
  category: string;
  intensity: string;
  mentionCount: number;
  lastMentioned: string;
}>> {
  const { data, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('interests_revealed, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const interestMap = new Map<string, {
    intensity: string;
    mentionCount: number;
    lastMentioned: string;
  }>();

  const intensityRank: Record<string, number> = {
    casual: 1, interested: 2, passionate: 3, obsessed: 4,
  };

  for (const memory of data) {
    for (const interest of (memory.interests_revealed || [])) {
      const key = interest.category.toLowerCase();
      const existing = interestMap.get(key);

      if (!existing) {
        interestMap.set(key, {
          intensity: interest.intensity,
          mentionCount: 1,
          lastMentioned: memory.created_at,
        });
      } else {
        existing.mentionCount++;
        // Keep highest intensity
        if ((intensityRank[interest.intensity] || 0) > (intensityRank[existing.intensity] || 0)) {
          existing.intensity = interest.intensity;
        }
      }
    }
  }

  return Array.from(interestMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 15);
}

// =============================================================================
// KEYWORD EXTRACTION (lightweight, no external deps)
// =============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
  'or', 'but', 'not', 'this', 'that', 'with', 'from', 'by', 'as', 'be', 'was',
  'are', 'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'i', 'me',
  'my', 'you', 'your', 'we', 'our', 'he', 'she', 'they', 'them', 'what', 'how',
  'when', 'where', 'why', 'which', 'who', 'whom', 'if', 'then', 'than', 'so',
  'just', 'about', 'up', 'out', 'its', 'any', 'all', 'very', 'much', 'more',
  'some', 'also', 'no', 'yes', 'hey', 'hi', 'hello', 'thanks', 'thank', 'please',
  'know', 'think', 'want', 'need', 'like', 'got', 'get', 'tell', 'show', 'help',
  'look', 'find', 'see', 'make', 'take', 'go', 'come', 'give', 'let', 'say',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 10); // Max 10 keywords
}
