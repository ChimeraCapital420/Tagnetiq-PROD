// FILE: src/lib/boardroom/memory-bridge.ts
// Sprint 8: Memory Bridge — Oracle ↔ Board
//
// The Oracle accumulates deep knowledge about each user:
//   - Compressed conversation memories
//   - Emotional moments (Liberation 3)
//   - Trust metrics
//   - Expertise level
//   - Personal details (Liberation 4)
//   - Energy patterns
//
// Board members need RELEVANT slices of this knowledge when
// interacting with the user — but not the full dump.
// This bridge extracts role-relevant context from Oracle memory.
//
// Privacy: Only shares what's relevant to the board member's domain.
// Efficiency: Pre-filters before injecting into prompts.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getRelevantMemories,
  getExpertiseLevel,
  getAggregatedInterests,
} from '../oracle/memory/index.js';
import { getTrustMetrics } from '../oracle/trust/tracker.js';
import type { MemorySummary } from '../oracle/memory/compressor.js';
import type { TrustMetrics } from '../oracle/trust/tracker.js';

// =============================================================================
// TYPES
// =============================================================================

/** Filtered context package for a board member */
export interface BoardMemberContext {
  /** User's expertise level in this member's domain */
  userExpertise: {
    level: string;
    indicators: string[];
  };
  /** Relevant memories (filtered to member's domain) */
  relevantMemories: MemorySummary[];
  /** User's interests that overlap with member's domain */
  relevantInterests: Array<{ category: string; intensity: string }>;
  /** User's overall trust with the Oracle (general relationship quality) */
  userOracleTrust: number;
  /** Emotional moments relevant to this domain (if any) */
  relevantMoments: string[];
  /** User profile basics (name, tier) */
  userBasics: {
    name: string | null;
    tier: string;
    conversationCount: number;
    joinedAt: string | null;
  };
}

/** Options for fetching board context */
export interface FetchContextOptions {
  userId: string;
  memberSlug: string;
  memberRole: string;
  memberExpertise: string[];
  /** The current message topic (for relevance filtering) */
  currentTopic?: string;
  /** Max memories to include */
  maxMemories?: number;
}

// =============================================================================
// MAIN BRIDGE FUNCTION
// =============================================================================

/**
 * Fetch Oracle's knowledge about a user, filtered for a specific board member.
 * This is the main entry point called from the boardroom chat endpoint.
 */
export async function fetchBoardMemberContext(
  supabase: SupabaseClient,
  options: FetchContextOptions,
): Promise<BoardMemberContext> {
  const {
    userId,
    memberSlug,
    memberRole,
    memberExpertise,
    currentTopic,
    maxMemories = 5,
  } = options;

  // Parallel fetch — all lightweight queries
  const [
    memories,
    expertise,
    interests,
    trustMetrics,
    userProfile,
    emotionalMoments,
  ] = await Promise.allSettled([
    fetchRelevantMemories(supabase, userId, memberExpertise, currentTopic, maxMemories),
    fetchUserExpertise(supabase, userId),
    fetchRelevantInterests(supabase, userId, memberExpertise),
    fetchUserTrust(supabase, userId),
    fetchUserBasics(supabase, userId),
    fetchEmotionalMoments(supabase, userId, memberExpertise),
  ]);

  return {
    userExpertise: extractResult(expertise, { level: 'unknown', indicators: [] }),
    relevantMemories: extractResult(memories, []),
    relevantInterests: extractResult(interests, []),
    userOracleTrust: extractResult(trustMetrics, 50),
    relevantMoments: extractResult(emotionalMoments, []),
    userBasics: extractResult(userProfile, {
      name: null,
      tier: 'free',
      conversationCount: 0,
      joinedAt: null,
    }),
  };
}

// =============================================================================
// MEMORY FETCHERS (filtered by relevance)
// =============================================================================

async function fetchRelevantMemories(
  supabase: SupabaseClient,
  userId: string,
  memberExpertise: string[],
  currentTopic: string | undefined,
  maxMemories: number,
): Promise<MemorySummary[]> {
  try {
    // Build search query from member expertise + current topic
    const searchTerms = [
      ...memberExpertise.map((e) => e.toLowerCase().split(' ')[0]),
      currentTopic,
    ]
      .filter(Boolean)
      .join(' ');

    if (!searchTerms) {
      // Fallback: get most recent memories
      const { data } = await supabase
        .from('oracle_memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(maxMemories);
      return (data || []) as MemorySummary[];
    }

    // Use Oracle's relevance search
    const memories = await getRelevantMemories(supabase, userId, searchTerms);
    return memories.slice(0, maxMemories);
  } catch {
    return [];
  }
}

async function fetchUserExpertise(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ level: string; indicators: string[] }> {
  try {
    const result = await getExpertiseLevel(supabase, userId);
    return result || { level: 'unknown', indicators: [] };
  } catch {
    return { level: 'unknown', indicators: [] };
  }
}

async function fetchRelevantInterests(
  supabase: SupabaseClient,
  userId: string,
  memberExpertise: string[],
): Promise<Array<{ category: string; intensity: string }>> {
  try {
    const allInterests = await getAggregatedInterests(supabase, userId);

    if (!allInterests || allInterests.length === 0) return [];

    // Filter to interests that overlap with member's expertise
    const expertiseKeywords = memberExpertise
      .flatMap((e) => e.toLowerCase().split(/\s+/));

    return allInterests
      .filter((interest: any) =>
        expertiseKeywords.some((kw) =>
          interest.category.toLowerCase().includes(kw)
        )
      )
      .slice(0, 5)
      .map((i: any) => ({
        category: i.category,
        intensity: i.intensity,
      }));
  } catch {
    return [];
  }
}

async function fetchUserTrust(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    const metrics = await getTrustMetrics(supabase, userId);
    return metrics?.overall_trust ?? 50;
  } catch {
    return 50;
  }
}

async function fetchUserBasics(
  supabase: SupabaseClient,
  userId: string,
): Promise<BoardMemberContext['userBasics']> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username, tier, created_at')
      .eq('id', userId)
      .single();

    const { data: identity } = await supabase
      .from('oracle_identity')
      .select('conversation_count')
      .eq('user_id', userId)
      .single();

    return {
      name: profile?.display_name || profile?.username || null,
      tier: profile?.tier || 'free',
      conversationCount: identity?.conversation_count || 0,
      joinedAt: profile?.created_at || null,
    };
  } catch {
    return { name: null, tier: 'free', conversationCount: 0, joinedAt: null };
  }
}

async function fetchEmotionalMoments(
  supabase: SupabaseClient,
  userId: string,
  memberExpertise: string[],
): Promise<string[]> {
  try {
    // Emotional moments are stored in memory summaries with emotion field
    const { data: memories } = await supabase
      .from('oracle_memories')
      .select('key_topics, emotional_moments')
      .eq('user_id', userId)
      .not('emotional_moments', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!memories) return [];

    // Extract moments and filter by domain relevance
    const expertiseKeywords = memberExpertise
      .flatMap((e) => e.toLowerCase().split(/\s+/));

    const allMoments: string[] = [];

    for (const mem of memories) {
      const moments = mem.emotional_moments;
      if (!Array.isArray(moments)) continue;

      for (const moment of moments) {
        const momentText = typeof moment === 'string'
          ? moment
          : moment?.moment || '';

        // Check domain relevance (loose match)
        const isRelevant = expertiseKeywords.some((kw) =>
          momentText.toLowerCase().includes(kw)
        );

        if (isRelevant) {
          allMoments.push(momentText);
        }
      }
    }

    return allMoments.slice(0, 3);
  } catch {
    return [];
  }
}

// =============================================================================
// CONTEXT → PROMPT INJECTION
// =============================================================================

/**
 * Build a prompt block from the board member context.
 * Injected into the member's system prompt so they "know" the user.
 */
export function buildContextPromptBlock(
  context: BoardMemberContext,
  memberName: string,
): string {
  const lines: string[] = [];

  // User basics
  const name = context.userBasics.name;
  if (name) {
    lines.push(`\nUSER CONTEXT: You are speaking with ${name}.`);
  }

  // Expertise level
  if (context.userExpertise.level !== 'unknown') {
    lines.push(
      `Their expertise level: ${context.userExpertise.level}. ` +
      `Adjust your language accordingly — ${
        context.userExpertise.level === 'expert'
          ? 'use technical language, skip basics'
          : context.userExpertise.level === 'intermediate'
          ? 'balance clarity with depth'
          : 'explain concepts clearly, avoid jargon'
      }.`
    );
  }

  // Relevant interests
  if (context.relevantInterests.length > 0) {
    const interestList = context.relevantInterests
      .map((i) => `${i.category} (${i.intensity})`)
      .join(', ');
    lines.push(`Their interests relevant to your domain: ${interestList}.`);
  }

  // Oracle trust (relationship quality)
  if (context.userOracleTrust > 70) {
    lines.push(
      `They have a strong relationship with the Oracle (trust: ${context.userOracleTrust}/100). ` +
      `They're comfortable with direct, opinionated responses.`
    );
  } else if (context.userOracleTrust < 30) {
    lines.push(
      `They're relatively new (trust: ${context.userOracleTrust}/100). ` +
      `Be welcoming and explain your role and how you can help.`
    );
  }

  // Relevant memories (brief summaries only)
  if (context.relevantMemories.length > 0) {
    lines.push(`\nRELEVANT HISTORY (from Oracle memory):`);
    for (const mem of context.relevantMemories.slice(0, 3)) {
      const summary = typeof mem === 'string'
        ? mem
        : (mem as any).summary || (mem as any).content || '';
      if (summary) {
        lines.push(`- ${truncate(summary, 150)}`);
      }
    }
  }

  // Emotional moments
  if (context.relevantMoments.length > 0) {
    lines.push(`\nSHARED MOMENTS (reference naturally, like a colleague who remembers):`);
    for (const moment of context.relevantMoments) {
      lines.push(`- ${truncate(moment, 200)}`);
    }
  }

  // Conversation depth guidance
  if (context.userBasics.conversationCount > 100) {
    lines.push(
      `\nThis is a power user (${context.userBasics.conversationCount}+ conversations). ` +
      `Skip introductions. Be direct and assume shared context.`
    );
  } else if (context.userBasics.conversationCount < 5) {
    lines.push(
      `\nThis is a newer user. Introduce your capabilities and how ${memberName} can help them specifically.`
    );
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

// =============================================================================
// HELPERS
// =============================================================================

function extractResult<T>(settled: PromiseSettledResult<T>, fallback: T): T {
  return settled.status === 'fulfilled' ? settled.value : fallback;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}