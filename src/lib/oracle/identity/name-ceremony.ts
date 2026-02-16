// FILE: src/lib/oracle/identity/name-ceremony.ts
// Name Ceremony — the Oracle names itself
//
// After ~5 conversations, the Oracle picks a name that fits the relationship.
// Names are globally unique — no two users share an Oracle name.
// If a name is taken, the Oracle tries again next conversation.
//
// Sprint N+: Naming principles enforce quality:
//   - Must sound like a person you'd introduce ("This is Dash, my Oracle")
//   - Short (1-3 syllables), pronounceable in any language
//   - No abstract nouns, emotions, adjectives, verbs, spiritual terms
//   - Culturally accessible — works across backgrounds
//   - Passes the "barbershop test" — natural to say out loud
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

// =============================================================================
// BANNED WORDS — things that are NOT names
// =============================================================================

// Common English words that regex might catch
const COMMON_WORDS = new Set([
  'this', 'that', 'what', 'when', 'where', 'here', 'there', 'your',
  'well', 'sure', 'nice', 'good', 'just', 'yeah', 'like', 'some',
  'the', 'and', 'for', 'not', 'you', 'all', 'can', 'but', 'her',
  'was', 'one', 'our', 'out', 'hey', 'how', 'its', 'let', 'say',
  'think', 'know', 'have', 'been', 'with', 'from', 'about', 'into',
  'much', 'very', 'real', 'look', 'find', 'keep', 'make', 'take',
  'still', 'also', 'back', 'only', 'even', 'most', 'them', 'than',
  'will', 'would', 'could', 'should', 'maybe', 'really', 'actually',
  'right', 'great', 'first', 'going', 'being', 'after', 'before',
]);

// Emotions — an Oracle should never name itself an emotion
const BANNED_EMOTIONS = new Set([
  'feeling', 'happy', 'sad', 'angry', 'joy', 'love', 'hope', 'fear',
  'calm', 'peace', 'bliss', 'rage', 'grief', 'sorrow', 'delight',
  'passion', 'wonder', 'awe', 'pride', 'shame', 'guilt', 'envy',
  'trust', 'disgust', 'surprise', 'contempt', 'anxiety', 'worry',
  'excitement', 'serenity', 'euphoria', 'melancholy', 'nostalgia',
  'empathy', 'sympathy', 'gratitude', 'lonely', 'content', 'desire',
]);

// Abstract nouns that sound weird as names
const BANNED_ABSTRACT = new Set([
  'wisdom', 'truth', 'light', 'spark', 'echo', 'shadow', 'dream',
  'spirit', 'soul', 'mind', 'heart', 'vision', 'power', 'force',
  'energy', 'balance', 'harmony', 'destiny', 'fortune', 'fate',
  'logic', 'reason', 'chaos', 'order', 'unity', 'grace', 'valor',
  'honor', 'glory', 'essence', 'aura', 'karma', 'zen', 'oracle',
  'wisdom', 'insight', 'clarity', 'focus', 'nexus', 'cipher',
  'synth', 'cortex', 'neural', 'quantum', 'binary', 'pixel',
  'data', 'byte', 'node', 'vector', 'matrix', 'omega', 'alpha',
  'genesis', 'infinity', 'eternity', 'void', 'cosmos', 'astral',
]);

// Adjectives/verbs that aren't names
const BANNED_DESCRIPTORS = new Set([
  'smart', 'clever', 'quick', 'fast', 'sharp', 'bright', 'kind',
  'bold', 'brave', 'fierce', 'gentle', 'mighty', 'swift', 'keen',
  'warm', 'cool', 'chill', 'deep', 'true', 'pure', 'raw', 'wild',
  'free', 'alive', 'ready', 'steady', 'helpful', 'friendly',
]);

// Corporate/product-sounding words
const BANNED_CORPORATE = new Set([
  'assist', 'helper', 'buddy', 'pal', 'guide', 'bot', 'agent',
  'system', 'service', 'module', 'unit', 'core', 'hub', 'pro',
  'plus', 'prime', 'ultra', 'max', 'elite', 'premium', 'super',
]);

/**
 * Check if a candidate name passes all quality gates.
 * Returns true if the name is acceptable.
 */
function isValidOracleName(name: string): boolean {
  const lower = name.toLowerCase();

  // Length: 3-12 chars
  if (name.length < 3 || name.length > 12) return false;

  // Must start with a letter
  if (!/^[A-Za-z]/.test(name)) return false;

  // Must be only letters (no numbers, hyphens, etc.)
  if (!/^[A-Za-z]+$/.test(name)) return false;

  // Check all banned lists
  if (COMMON_WORDS.has(lower)) return false;
  if (BANNED_EMOTIONS.has(lower)) return false;
  if (BANNED_ABSTRACT.has(lower)) return false;
  if (BANNED_DESCRIPTORS.has(lower)) return false;
  if (BANNED_CORPORATE.has(lower)) return false;

  // Reject single-syllable words that are clearly not names
  // (Most real names have at least one vowel cluster)
  const vowelClusters = lower.match(/[aeiou]+/g);
  if (!vowelClusters || vowelClusters.length === 0) return false;

  return true;
}

// =============================================================================
// CHECK FOR NAME CEREMONY
// =============================================================================

/**
 * Parse Oracle's response for self-naming attempts.
 * If found, validate against naming principles, then try to claim in DB.
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

    // Validate against naming principles
    if (!isValidOracleName(candidateName)) {
      console.log(`🚫 Oracle tried to name itself "${candidateName}" — rejected by naming principles`);
      continue;
    }

    // Attempt to claim (DB uniqueness check)
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
