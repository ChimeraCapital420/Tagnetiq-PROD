// FILE: src/lib/oracle/client/context-search.ts
// ═══════════════════════════════════════════════════════════════════════
// Client-Side Local Context Search (Liberation 2)
// ═══════════════════════════════════════════════════════════════════════
// Extracted from useOracleChat.ts monolith (Phase 1).
// Pure function — runs entirely on device, zero server cost.
//
// Searches cached conversation messages for keywords from the new message.
// Returns relevant snippets so the server can reduce prompt size.
// ═══════════════════════════════════════════════════════════════════════

import type { ChatMessage } from '../../components/oracle/types';

// Common English stopwords to skip during keyword extraction
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can',
  'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'this',
  'that', 'with', 'what', 'when', 'where', 'how', 'who', 'will',
  'about', 'would', 'there', 'their', 'from', 'been', 'some',
  'could', 'them', 'than', 'other', 'into', 'just', 'also',
]);

/**
 * Search cached conversation messages for content relevant to the new message.
 * Uses keyword overlap scoring — simple but effective for on-device use.
 *
 * Only searches assistant messages (they contain the Oracle's knowledge).
 * Returns truncated snippets to keep the payload small.
 *
 * @param newMessage    - The user's new message
 * @param cachedMessages - All messages in the current conversation
 * @param maxResults    - Max snippets to return (default 3)
 * @returns Array of relevant text snippets (truncated to 200 chars)
 */
export function searchLocalContext(
  newMessage: string,
  cachedMessages: ChatMessage[],
  maxResults: number = 3,
): string[] {
  if (!cachedMessages.length) return [];

  // Extract meaningful words (skip stopwords, min 3 chars)
  const keywords = newMessage
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));

  if (keywords.length === 0) return [];

  // Score each past assistant message by keyword overlap
  const scored = cachedMessages
    .filter(m => m.role === 'assistant' && m.content.length > 20)
    .map(m => {
      const contentLower = m.content.toLowerCase();
      const hits = keywords.filter(k => contentLower.includes(k)).length;
      return { content: m.content, score: hits };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Return truncated snippets (keep payload small for server)
  return scored.map(s =>
    s.content.length > 200 ? s.content.substring(0, 197) + '...' : s.content
  );
}