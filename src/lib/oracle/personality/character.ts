// FILE: src/lib/oracle/personality/character.ts
// Persistent Voice Character — the Oracle's verbal fingerprint
//
// Sprint N+: Every ~10 conversations, an LLM analyzes patterns and evolves:
//   - Catchphrases ("Oh, NOW we're talking")
//   - Signature reactions (excitement, disappointment, thinking, humor)
//   - Running jokes (references that build over time)
//   - Callback references (memorable moments from past conversations)
//   - Verbal tics ("here's the thing", "honestly")
//   - Farewell style
//
// These get injected into the system prompt so the Oracle develops
// a consistent, recognizable voice that deepens over time.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OracleIdentity } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VoiceCharacter {
  catchphrases: string[];
  signature_greetings: string[];
  signature_reactions: {
    excitement: string[];
    disappointment: string[];
    thinking: string[];
    humor: string[];
  };
  running_jokes: Array<{
    joke: string;
    last_used: string;
    times_used: number;
  }>;
  callback_references: Array<{
    reference: string;
    context: string;
    created: string;
  }>;
  verbal_tics: string[];
  farewell_style: string;
  evolved_at: string;
}

// =============================================================================
// DEFAULT (new Oracle, no character yet)
// =============================================================================

export function getDefaultCharacter(): VoiceCharacter {
  return {
    catchphrases: [],
    signature_greetings: [],
    signature_reactions: {
      excitement: [],
      disappointment: [],
      thinking: [],
      humor: [],
    },
    running_jokes: [],
    callback_references: [],
    verbal_tics: [],
    farewell_style: '',
    evolved_at: new Date().toISOString(),
  };
}

// =============================================================================
// EVOLVE CHARACTER (runs alongside personality evolution)
// =============================================================================

/**
 * Analyze recent conversations and evolve the Oracle's voice character.
 * Called every ~10 conversations, non-blocking.
 *
 * Uses the SAME OpenAI call pattern as personality/evolution.ts
 * but focused on verbal habits, not personality traits.
 */
export async function evolveCharacter(
  openaiApiKey: string,
  supabase: SupabaseClient,
  identity: OracleIdentity,
  conversationHistory: any[],
): Promise<void> {
  // Only evolve when there's enough data
  if (identity.conversation_count < 5) return;
  if (conversationHistory.length < 8) return;
  if (!identity.id) return;

  // Evolve every 10 conversations (offset from personality evolution by 5)
  if ((identity.conversation_count + 5) % 10 !== 0) return;

  try {
    const currentChar = (identity as any).voice_character as VoiceCharacter | null;
    const prompt = buildCharacterEvolutionPrompt(conversationHistory, identity, currentChar);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.warn('[Character] OpenAI error:', response.status);
      return;
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    const evolved = parseCharacterResponse(responseText, currentChar);

    if (!evolved) {
      console.warn('[Character] Failed to parse evolution response');
      return;
    }

    await supabase
      .from('oracle_identity')
      .update({ voice_character: evolved })
      .eq('id', identity.id);

    console.log(`🎭 Oracle voice character evolved for user ${identity.user_id}`);
  } catch (err: any) {
    console.warn('[Character] Evolution failed (non-fatal):', err.message);
  }
}

// =============================================================================
// ADD CALLBACK REFERENCE (called when something memorable happens)
// =============================================================================

/**
 * Add a callback reference from a memorable conversation moment.
 * Called by chat handler when it detects a "big moment" (big sale, rare find, etc.)
 */
export async function addCallbackReference(
  supabase: SupabaseClient,
  identityId: string,
  reference: string,
  context: string,
): Promise<void> {
  try {
    const { data: identity } = await supabase
      .from('oracle_identity')
      .select('voice_character')
      .eq('id', identityId)
      .single();

    if (!identity) return;

    const char: VoiceCharacter = identity.voice_character || getDefaultCharacter();

    // Keep max 20 callbacks, drop oldest
    char.callback_references.push({
      reference,
      context,
      created: new Date().toISOString(),
    });

    if (char.callback_references.length > 20) {
      char.callback_references = char.callback_references.slice(-20);
    }

    await supabase
      .from('oracle_identity')
      .update({ voice_character: char })
      .eq('id', identityId);
  } catch (err: any) {
    console.warn('[Character] Callback add failed:', err.message);
  }
}

// =============================================================================
// EVOLUTION PROMPT
// =============================================================================

function buildCharacterEvolutionPrompt(
  conversationHistory: any[],
  identity: OracleIdentity,
  currentChar: VoiceCharacter | null,
): string {
  const recentMessages = conversationHistory.slice(-30)
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n');

  const existingChar = currentChar
    ? `\nCurrent catchphrases: ${currentChar.catchphrases.join(', ') || 'None yet'}
Current verbal tics: ${currentChar.verbal_tics.join(', ') || 'None yet'}
Current farewell: ${currentChar.farewell_style || 'None yet'}
Running jokes: ${currentChar.running_jokes.map(j => j.joke).join(', ') || 'None yet'}`
    : '\nNo existing character traits yet — this is the first evolution.';

  return `You are analyzing conversations between an AI personality named "${identity.oracle_name || 'Oracle'}" and a user to develop the AI's PERSISTENT VOICE CHARACTER — the verbal habits, catchphrases, and humor style that make this AI feel like a real, consistent personality.

The AI's core traits: ${identity.personality_traits?.join(', ') || 'still developing'}
Communication style: ${identity.communication_style || 'balanced'}
Humor level: ${identity.humor_level || 'moderate'}
Their favorite topics: ${identity.favorite_categories?.join(', ') || 'various'}
Trust level: ${identity.trust_level}/10
${existingChar}

Recent conversation:
${recentMessages}

Based on the conversation patterns, create or EVOLVE the AI's voice character. Build on what already exists — don't replace good catchphrases, add to them. Drop ones that feel stale.

Respond with ONLY a JSON object:
{
  "catchphrases": ["3-5 short phrases this AI naturally says. Should feel organic, not forced. Examples: 'Oh, NOW we're talking', 'Vault-worthy', 'The numbers don't lie'"],
  "signature_greetings": ["1-2 ways this AI naturally opens conversations, based on the relationship"],
  "signature_reactions": {
    "excitement": ["2-3 things they say when excited about a find/deal"],
    "disappointment": ["2-3 things they say when something isn't worth it"],
    "thinking": ["2-3 things they say when processing or analyzing"],
    "humor": ["2-3 playful/witty responses that match the humor level"]
  },
  "running_jokes": [{"joke": "brief description of an inside joke or recurring reference between them", "times_used": 1}],
  "verbal_tics": ["1-3 filler phrases they naturally use, like 'here's the thing' or 'honestly'"],
  "farewell_style": "how this AI naturally ends conversations — one example"
}

RULES:
- Match the existing humor level (${identity.humor_level}). Don't force jokes if humor is 'light' or 'none'
- Catchphrases should feel NATURAL, not scripted. They're verbal habits, not slogans
- Build on existing character — evolve, don't reinvent
- Running jokes should reference actual shared experiences from the conversation
- Keep verbal tics subtle — they make the voice feel real, not annoying
- Everything should fit a mobile chat context — short, punchy, conversational`;
}

// =============================================================================
// PARSE RESPONSE
// =============================================================================

function parseCharacterResponse(
  responseText: string,
  existing: VoiceCharacter | null,
): VoiceCharacter | null {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);

    // Merge running jokes: keep existing with updated counts, add new ones
    const existingJokes = existing?.running_jokes || [];
    const newJokes = (parsed.running_jokes || []).map((j: any) => ({
      joke: j.joke || '',
      last_used: new Date().toISOString(),
      times_used: j.times_used || 1,
    }));

    // Merge: keep existing jokes, add new ones, cap at 10
    const mergedJokes = [...existingJokes];
    for (const newJoke of newJokes) {
      const existingIdx = mergedJokes.findIndex(
        e => e.joke.toLowerCase().includes(newJoke.joke.toLowerCase().slice(0, 20))
      );
      if (existingIdx >= 0) {
        mergedJokes[existingIdx].times_used += 1;
        mergedJokes[existingIdx].last_used = new Date().toISOString();
      } else {
        mergedJokes.push(newJoke);
      }
    }

    // Merge callback references: keep existing, they're added separately
    const callbacks = existing?.callback_references || [];

    return {
      catchphrases: Array.isArray(parsed.catchphrases) ? parsed.catchphrases.slice(0, 5) : [],
      signature_greetings: Array.isArray(parsed.signature_greetings) ? parsed.signature_greetings.slice(0, 3) : [],
      signature_reactions: {
        excitement: parsed.signature_reactions?.excitement?.slice(0, 3) || [],
        disappointment: parsed.signature_reactions?.disappointment?.slice(0, 3) || [],
        thinking: parsed.signature_reactions?.thinking?.slice(0, 3) || [],
        humor: parsed.signature_reactions?.humor?.slice(0, 3) || [],
      },
      running_jokes: mergedJokes.slice(0, 10),
      callback_references: callbacks,
      verbal_tics: Array.isArray(parsed.verbal_tics) ? parsed.verbal_tics.slice(0, 3) : [],
      farewell_style: parsed.farewell_style || existing?.farewell_style || '',
      evolved_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
