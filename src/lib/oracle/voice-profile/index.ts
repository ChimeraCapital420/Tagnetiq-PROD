// FILE: src/lib/oracle/voice-profile/index.ts
// User Writing Style Analysis — builds a "voice profile" from conversation history
// Used by: listing generation, social posts, brag cards
// "List this in MY voice" — not generic AI copy, but how the USER actually writes

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// TYPES
// =============================================================================

export interface VoiceProfile {
  avgSentenceLength: number;
  vocabularyLevel: 'casual' | 'mixed' | 'professional' | 'technical';
  toneMarkers: string[];      // e.g., "enthusiastic", "matter-of-fact", "witty"
  commonPhrases: string[];    // phrases they use often
  emojiStyle: 'none' | 'light' | 'heavy';
  humorStyle: 'none' | 'dry' | 'enthusiastic' | 'sarcastic';
  formality: number;          // 0 (super casual) to 100 (very formal)
  listingStyle?: ListingStyle;
  sampleMessages: string[];   // 3-5 representative messages for few-shot prompting
  lastUpdated: string;
  messageCount: number;       // how many messages analyzed
}

export interface ListingStyle {
  titleCase: 'lowercase' | 'title_case' | 'caps' | 'mixed';
  usesEmoji: boolean;
  avgDescriptionLength: number;
  includesPersonalNotes: boolean; // "Selling from my personal collection"
  priceStyle: 'firm' | 'obo' | 'auction_preferred';
  commonTerms: string[];
}

// =============================================================================
// BUILD VOICE PROFILE FROM MESSAGES
// =============================================================================

/**
 * Analyze user's conversation history to build a voice profile.
 * Called periodically (every ~20 conversations) or on demand.
 */
export async function buildVoiceProfile(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<VoiceProfile> {
  // Filter to user messages only
  const userMessages = messages
    .filter(m => m.role === 'user' && m.content.trim().length > 15)
    .map(m => m.content);

  if (userMessages.length < 5) {
    return defaultProfile();
  }

  // ── Sentence length ───────────────────────────────────
  const allSentences = userMessages.flatMap(m =>
    m.split(/[.!?]+/).filter(s => s.trim().length > 3)
  );
  const avgSentenceLength = allSentences.length > 0
    ? Math.round(allSentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / allSentences.length)
    : 12;

  // ── Vocabulary level ──────────────────────────────────
  const allText = userMessages.join(' ').toLowerCase();
  const casualMarkers = countPatterns(allText, [
    'lol', 'gonna', 'wanna', 'kinda', 'ngl', 'tbh', 'imo', 'bruh',
    'bro', 'dude', 'haha', 'omg', 'yep', 'nope', 'nah', 'yeah',
    'yo ', 'sup', 'lit', 'fire', 'sick', 'dope',
  ]);
  const professionalMarkers = countPatterns(allText, [
    'therefore', 'consequently', 'regarding', 'specifically', 'essentially',
    'comprehensive', 'preliminary', 'assessment', 'documentation', 'parameters',
    'strategic', 'implementation', 'methodology', 'optimization',
  ]);

  let vocabularyLevel: VoiceProfile['vocabularyLevel'] = 'mixed';
  if (casualMarkers > professionalMarkers * 2) vocabularyLevel = 'casual';
  else if (professionalMarkers > casualMarkers * 2) vocabularyLevel = 'professional';
  else if (professionalMarkers > 5) vocabularyLevel = 'technical';

  // ── Emoji style ───────────────────────────────────────
  const emojiPattern = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const totalEmoji = (allText.match(emojiPattern) || []).length;
  const emojiStyle: VoiceProfile['emojiStyle'] =
    totalEmoji === 0 ? 'none' :
    totalEmoji < userMessages.length ? 'light' : 'heavy';

  // ── Humor style ───────────────────────────────────────
  const lolCount = countPatterns(allText, ['lol', 'lmao', 'haha', 'hehe', '😂', '🤣', 'rofl']);
  const sarcasmMarkers = countPatterns(allText, ['/s', 'suuure', 'riiight', 'totally', 'oh great']);
  const enthusiasmMarkers = countPatterns(allText, ['!!', 'amazing', 'incredible', 'love', 'awesome', '🔥', '💯']);

  let humorStyle: VoiceProfile['humorStyle'] = 'none';
  if (sarcasmMarkers > 2) humorStyle = 'sarcastic';
  else if (enthusiasmMarkers > lolCount && enthusiasmMarkers > 3) humorStyle = 'enthusiastic';
  else if (lolCount > 2) humorStyle = 'dry';

  // ── Formality score (0-100) ───────────────────────────
  const formalSignals = professionalMarkers * 5;
  const informalSignals = casualMarkers * 5 + totalEmoji * 2;
  const formality = Math.max(0, Math.min(100,
    50 + formalSignals - informalSignals
  ));

  // ── Tone markers ──────────────────────────────────────
  const toneMarkers: string[] = [];
  if (enthusiasmMarkers > 3) toneMarkers.push('enthusiastic');
  if (formality > 70) toneMarkers.push('professional');
  if (formality < 30) toneMarkers.push('casual');
  if (allText.includes('?') && (allText.match(/\?/g) || []).length > userMessages.length) {
    toneMarkers.push('inquisitive');
  }
  if (avgSentenceLength < 8) toneMarkers.push('concise');
  if (avgSentenceLength > 20) toneMarkers.push('detailed');

  // ── Common phrases (appears 3+ times) ─────────────────
  const commonPhrases = findCommonPhrases(userMessages, 3);

  // ── Sample messages (pick 3-5 representative ones) ────
  const sampleMessages = userMessages
    .filter(m => m.length > 30 && m.length < 300)
    .slice(-5);

  const profile: VoiceProfile = {
    avgSentenceLength,
    vocabularyLevel,
    toneMarkers,
    commonPhrases,
    emojiStyle,
    humorStyle,
    formality,
    sampleMessages,
    lastUpdated: new Date().toISOString(),
    messageCount: userMessages.length,
  };

  // Store in oracle_identity
  try {
    await supabaseAdmin
      .from('oracle_identity')
      .upsert({
        user_id: userId,
        voice_profile: profile,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch (err) {
    console.error('[VoiceProfile] Storage error:', err);
  }

  return profile;
}

// =============================================================================
// GET STORED VOICE PROFILE
// =============================================================================

export async function getVoiceProfile(userId: string): Promise<VoiceProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('oracle_identity')
    .select('voice_profile')
    .eq('user_id', userId)
    .single();

  if (error || !data?.voice_profile) return null;
  return data.voice_profile as VoiceProfile;
}

// =============================================================================
// HELPERS
// =============================================================================

function defaultProfile(): VoiceProfile {
  return {
    avgSentenceLength: 12,
    vocabularyLevel: 'mixed',
    toneMarkers: [],
    commonPhrases: [],
    emojiStyle: 'none',
    humorStyle: 'none',
    formality: 50,
    sampleMessages: [],
    lastUpdated: new Date().toISOString(),
    messageCount: 0,
  };
}

function countPatterns(text: string, patterns: string[]): number {
  return patterns.reduce((count, pattern) => {
    const regex = new RegExp(escapeRegex(pattern), 'gi');
    return count + (text.match(regex) || []).length;
  }, 0);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCommonPhrases(messages: string[], minCount: number): string[] {
  const phraseCounts = new Map<string, number>();

  for (const msg of messages) {
    const words = msg.toLowerCase().split(/\s+/);
    // Check 2-4 word phrases
    for (let len = 2; len <= 4; len++) {
      for (let i = 0; i <= words.length - len; i++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 5) { // skip tiny phrases
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
        }
      }
    }
  }

  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count >= minCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([phrase]) => phrase);
}
