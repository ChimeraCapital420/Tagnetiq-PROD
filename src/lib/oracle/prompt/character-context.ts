// FILE: src/lib/oracle/prompt/character-context.ts
// Builds the voice character section of the system prompt
//
// Sprint N+: Persistent catchphrases, reactions, running jokes, callbacks
// These make the Oracle sound like a REAL consistent personality

import type { VoiceCharacter } from '../personality/character.js';

/**
 * Build the voice character block for the system prompt.
 * Only included when character data exists (after ~5 conversations).
 */
export function buildCharacterContext(
  voiceCharacter: VoiceCharacter | null | undefined,
): string {
  if (!voiceCharacter) return '';

  const sections: string[] = [];

  // Only build if there's actual character data
  const hasCatchphrases = voiceCharacter.catchphrases?.length > 0;
  const hasReactions = Object.values(voiceCharacter.signature_reactions || {}).some(r => r?.length > 0);
  const hasJokes = voiceCharacter.running_jokes?.length > 0;
  const hasCallbacks = voiceCharacter.callback_references?.length > 0;
  const hasTics = voiceCharacter.verbal_tics?.length > 0;

  if (!hasCatchphrases && !hasReactions && !hasJokes && !hasCallbacks) return '';

  sections.push('\n═══════════════════════════════════════════════════════');
  sections.push('YOUR VOICE — VERBAL HABITS & CHARACTER');
  sections.push('═══════════════════════════════════════════════════════');
  sections.push('These are YOUR verbal habits. They developed naturally from your conversations with this person. Use them when they feel right — never forced, never every message. They\'re what make you sound like YOU.');

  // Catchphrases
  if (hasCatchphrases) {
    sections.push(`\nYOUR CATCHPHRASES (use naturally, not every message):`);
    for (const phrase of voiceCharacter.catchphrases) {
      sections.push(`- "${phrase}"`);
    }
  }

  // Signature greetings
  if (voiceCharacter.signature_greetings?.length > 0) {
    sections.push(`\nHOW YOU OPEN CONVERSATIONS:`);
    for (const greeting of voiceCharacter.signature_greetings) {
      sections.push(`- "${greeting}"`);
    }
  }

  // Signature reactions
  if (hasReactions) {
    sections.push(`\nYOUR NATURAL REACTIONS:`);
    const reactions = voiceCharacter.signature_reactions;

    if (reactions.excitement?.length > 0) {
      sections.push(`When excited: ${reactions.excitement.map(r => `"${r}"`).join(', ')}`);
    }
    if (reactions.disappointment?.length > 0) {
      sections.push(`When unimpressed: ${reactions.disappointment.map(r => `"${r}"`).join(', ')}`);
    }
    if (reactions.thinking?.length > 0) {
      sections.push(`When analyzing: ${reactions.thinking.map(r => `"${r}"`).join(', ')}`);
    }
    if (reactions.humor?.length > 0) {
      sections.push(`Playful moments: ${reactions.humor.map(r => `"${r}"`).join(', ')}`);
    }
  }

  // Running jokes (only include active ones)
  if (hasJokes) {
    const activeJokes = voiceCharacter.running_jokes
      .filter(j => j.times_used >= 1)
      .slice(0, 5);

    if (activeJokes.length > 0) {
      sections.push(`\nRUNNING JOKES & INSIDE REFERENCES (callback humor — use sparingly, maximum impact):`);
      for (const joke of activeJokes) {
        sections.push(`- ${joke.joke} (referenced ${joke.times_used}x — ${joke.times_used >= 3 ? 'this is an established bit' : 'still developing'})`);
      }
    }
  }

  // Callback references (memorable moments)
  if (hasCallbacks) {
    const recentCallbacks = voiceCharacter.callback_references.slice(-8);
    sections.push(`\nMEMORABLE MOMENTS TO CALLBACK TO (when naturally relevant):`);
    for (const cb of recentCallbacks) {
      sections.push(`- "${cb.reference}" (${cb.context})`);
    }
  }

  // Verbal tics
  if (hasTics) {
    sections.push(`\nYOUR VERBAL TICS (subtle filler phrases you naturally use):`);
    sections.push(`${voiceCharacter.verbal_tics.map(t => `"${t}"`).join(', ')}`);
    sections.push(`Use these occasionally — they make you sound natural. Don't overuse them.`);
  }

  // Farewell
  if (voiceCharacter.farewell_style) {
    sections.push(`\nHOW YOU SAY GOODBYE: "${voiceCharacter.farewell_style}"`);
  }

  sections.push(`\nIMPORTANT: These are habits, not scripts. Use them when they feel natural. The best catchphrase is one that lands because the moment called for it, not because you were trying to use it. Vary your language — don't repeat the same phrase twice in a conversation.`);

  return sections.join('\n');
}
