// FILE: src/lib/oracle/prompt/memory-context.ts
// Builds the LONG-TERM MEMORY block for Oracle's system prompt
// Injected between profile context and argos context in builder.ts
// Target: <400 tokens to keep prompt lean

import type { MemorySummary } from '../memory/compressor.js';

interface MemoryContextParams {
  memories: MemorySummary[];
  unfulfilledPromises?: Array<{ promise: string; context: string; conversationDate: string }>;
  aggregatedInterests?: Array<{ category: string; intensity: string; mentionCount: number }>;
  expertiseLevel?: { level: string; indicators: string[]; conversationsAnalyzed: number };
}

export function buildMemoryContext(params: MemoryContextParams): string {
  const { memories, unfulfilledPromises, aggregatedInterests, expertiseLevel } = params;

  if (!memories.length && !unfulfilledPromises?.length && !aggregatedInterests?.length) {
    return '';
  }

  const sections: string[] = [];
  sections.push('## LONG-TERM MEMORY');
  sections.push('You have persistent memory across conversations with this user. Reference these naturally — never say "according to my records" or "in our previous conversation on [date]". Instead, recall like a friend would: "Weren\'t you looking at vintage Pyrex?" or "How did that Mantle card deal work out?"');

  // ── Expertise calibration ───────────────────────────────
  if (expertiseLevel && expertiseLevel.conversationsAnalyzed >= 2) {
    const levelGuide: Record<string, string> = {
      newcomer: 'This user is new to resale. Explain terminology, be encouraging, suggest learning paths. Don\'t overwhelm with market jargon.',
      learning: 'This user understands basics but is still learning. Use proper terms but briefly explain niche concepts. Be supportive of their growth.',
      intermediate: 'This user knows the game. Use industry terminology freely, discuss market dynamics, share pro tips. They can handle nuance.',
      advanced: 'This user is experienced. Cut the fluff — give raw data, discuss margins, market timing, and strategy. They want peer-level conversation.',
      expert: 'This user is a pro. Engage as an equal. Challenge their assumptions when warranted. They value contrarian data over confirmation.',
    };

    sections.push(`\n### EXPERTISE LEVEL: ${expertiseLevel.level.toUpperCase()}`);
    sections.push(levelGuide[expertiseLevel.level] || levelGuide.learning);
  }

  // ── Aggregated interests (top 5) ────────────────────────
  if (aggregatedInterests?.length) {
    const top = aggregatedInterests.slice(0, 5);
    const interestLines = top.map(i => {
      const freq = i.mentionCount > 3 ? ' (frequently discussed)' : '';
      return `- ${i.category} [${i.intensity}]${freq}`;
    });
    sections.push(`\n### KNOWN INTERESTS\n${interestLines.join('\n')}`);
  }

  // ── Recent conversation memories (max 3) ────────────────
  if (memories.length > 0) {
    const recentSummaries = memories.slice(0, 3).map(m => {
      const age = getRelativeTime(m.created_at || '');
      const items = (m.items_discussed || []).slice(0, 2)
        .map((item: any) => item.name).join(', ');
      const itemNote = items ? ` Items: ${items}.` : '';
      return `- ${age}: ${m.summary}${itemNote}`;
    });
    sections.push(`\n### RECENT CONVERSATION MEMORIES\n${recentSummaries.join('\n')}`);
  }

  // ── Unfulfilled promises ────────────────────────────────
  if (unfulfilledPromises?.length) {
    const promises = unfulfilledPromises.slice(0, 3).map(p => {
      const age = getRelativeTime(p.conversationDate);
      return `- ${age}: You promised to "${p.promise}" (context: ${p.context})`;
    });
    sections.push(`\n### OPEN PROMISES (follow up naturally if relevant)\n${promises.join('\n')}`);
  }

  // ── Emotional markers from last few conversations ───────
  const recentEmotions = memories
    .flatMap(m => (m.emotional_markers || []).map((e: any) => ({
      ...e,
      date: m.created_at,
    })))
    .slice(0, 3);

  if (recentEmotions.length > 0) {
    const emotionLines = recentEmotions.map((e: any) => {
      const age = getRelativeTime(e.date);
      return `- ${e.type}: ${e.context} (${age})`;
    });
    sections.push(`\n### EMOTIONAL HISTORY (be sensitive to patterns)\n${emotionLines.join('\n')}`);
  }

  return sections.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function getRelativeTime(isoDate: string): string {
  if (!isoDate) return 'recently';
  try {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    const diffMs = now - then;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'last week';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return 'last month';
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return 'a long time ago';
  } catch {
    return 'recently';
  }
}
