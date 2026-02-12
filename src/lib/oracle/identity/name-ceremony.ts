// FILE: src/lib/oracle/identity/name-ceremony.ts
// Name Ceremony — the Oracle names itself
//
// After ~5 conversations, the Oracle picks a name that fits the relationship.
// Names are globally unique — no two users share an Oracle name.
// If a name is taken, the Oracle tries again next conversation.
//
// Detection: Parse Oracle's response for patterns like "I'm [Name]" or "Call me [Name]"
// Claiming: claimOracleName() from manager.ts handles DB uniqueness

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OracleIdentity } from '../types.js';
import { claimOracleName } from './manager.js';

// =============================================================================
// NAME PATTERNS
// =============================================================================

const NAME_PATTERNS = [
  /(?:I'm|I am|call me|my name is|they call me|name's|name is)\s+([A-Z][a-z]{2,12})/i,
  /^([A-Z][a-z]{2,12})\.\s+That's me/i,
  /— ([A-Z][a-z]{2,12})$/,
];

// Words that could false-positive match the patterns above
const COMMON_WORDS = [
  'this', 'that', 'what', 'when', 'where', 'here', 'there', 'your',
  'well', 'sure', 'nice', 'good', 'just', 'yeah', 'like', 'some',
  'the', 'and', 'for', 'not', 'you', 'all', 'can', 'but', 'her',
  'was', 'one', 'our', 'out', 'hey', 'how', 'its', 'let', 'say',
  'think', 'know', 'have', 'been', 'with', 'from', 'about', 'into',
  'much', 'very', 'real', 'look', 'find', 'keep', 'make', 'take',
  'still', 'also', 'back', 'only', 'even', 'most', 'them', 'than',
];

// =============================================================================
// CHECK FOR NAME CEREMONY
// =============================================================================

/**
 * Parse Oracle's response for self-naming attempts.
 * If found, try to claim the name in the database.
 *
 * Returns the claimed name if successful, null otherwise.
 * Non-blocking — caller should .catch() this.
 */
export async function checkForNameCeremony(
  supabase: SupabaseClient,
  identity: OracleIdentity,
  oracleResponse: string
): Promise<string | null> {
  // Already named — nothing to do
  if (identity.oracle_name) return null;

  for (const pattern of NAME_PATTERNS) {
    const match = oracleResponse.match(pattern);
    if (!match) continue;

    const candidateName = match[1].trim();

    // Skip common words that aren't names
    if (COMMON_WORDS.includes(candidateName.toLowerCase())) continue;

    // Skip very short or very long names
    if (candidateName.length < 3 || candidateName.length > 12) continue;

    // Attempt to claim
    const claimed = await claimOracleName(supabase, identity.id, candidateName);

    if (claimed) {
      console.log(`🎉 Oracle named itself: ${candidateName} (user: ${identity.user_id})`);
      return candidateName;
    } else {
      console.log(`⚠️ Name "${candidateName}" already taken, Oracle will try again`);
      // Don't return — let the Oracle try a different name next conversation
    }
  }

  return null;
}