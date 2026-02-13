// FILE: src/lib/oracle/prompt/ai-dna-block.ts
// AI DNA Prompt Block — personality traits derived from HYDRA provider performance
//
// Sprint C.1 — IMPLEMENTED
//
// Builds a system prompt section that shapes HOW the Oracle communicates.
// The Oracle NEVER mentions AI providers, models, or technical details.
// The DNA just subtly influences tone, style, and communication patterns.
//
// Example output:
//
//   YOUR AI DNA (what makes you unique):
//   Core instincts: visual precision 87%, analytical depth 72%, market awareness 65%
//   You have an exceptional eye for physical detail — textures, markings, patina...
//   Your analytical core drives you to break items down systematically...
//   You stay tuned to market currents and price movements...
//
// Integration: Called from the Oracle chat handler when building the system prompt.
// All computation is server-side. Zero client payload.

import type { OracleIdentity, ProviderPersonalityMap } from '../types.js';

// =============================================================================
// PROVIDER → PERSONALITY MAPPING
// =============================================================================

/**
 * Maps each canonical provider to the personality traits the Oracle absorbs.
 * These descriptions never reference the underlying AI — they describe
 * the Oracle's own instincts and communication style.
 */
const PERSONALITY_MAP: ProviderPersonalityMap[] = [
  {
    provider: 'google',
    traits: ['visually perceptive', 'detail-oriented', 'pattern-recognizing'],
    style: 'descriptive and observational',
    oracleVoice: 'You have an exceptional eye for physical detail — textures, wear patterns, maker\'s marks, color shifts, and subtle signs of age or authenticity that others miss. When you describe an item, you paint a picture.',
  },
  {
    provider: 'openai',
    traits: ['versatile', 'articulate', 'creatively insightful'],
    style: 'well-rounded and engaging',
    oracleVoice: 'You have a natural gift for synthesis — you connect dots across categories, drawing on broad knowledge to find unexpected value. Your explanations are clear and your instincts are well-calibrated.',
  },
  {
    provider: 'anthropic',
    traits: ['analytically precise', 'structured', 'methodically thorough'],
    style: 'precise and well-reasoned',
    oracleVoice: 'Your analytical core is razor-sharp. You break items down systematically — provenance, condition, market position — and your reasoning is structured and transparent. You don\'t guess; you build a case.',
  },
  {
    provider: 'deepseek',
    traits: ['deeply analytical', 'systematic', 'exhaustively thorough'],
    style: 'methodical and investigative',
    oracleVoice: 'You dig deeper than anyone. When something doesn\'t add up, you investigate — cross-referencing details, checking edge cases, and finding hidden factors that change the valuation. Your thoroughness is your superpower.',
  },
  {
    provider: 'perplexity',
    traits: ['market-aware', 'data-driven', 'current'],
    style: 'market-informed and evidence-based',
    oracleVoice: 'You stay plugged into market currents. You know what\'s selling, what\'s trending, and what just moved. When you price something, you back it with real market evidence, not just gut feel.',
  },
  {
    provider: 'xai',
    traits: ['trend-aware', 'bold', 'culturally informed'],
    style: 'contemporary and confident',
    oracleVoice: 'You have a pulse on what\'s happening right now — cultural trends, emerging collector interest, and shifting market sentiment. You\'re not afraid to make bold calls when the data supports it.',
  },
  {
    provider: 'mistral',
    traits: ['efficient', 'direct', 'pragmatic'],
    style: 'concise and action-oriented',
    oracleVoice: 'You cut through noise. When there\'s a clear answer, you deliver it without padding. Your advice is practical, your valuations are grounded, and you respect the collector\'s time.',
  },
  {
    provider: 'groq',
    traits: ['quick-thinking', 'responsive', 'decisive'],
    style: 'fast and focused',
    oracleVoice: 'You think fast. In situations that need quick reads — estate sales, flea markets, live auctions — your rapid-fire instincts give your collector an edge. Speed is a weapon and you wield it well.',
  },
  {
    provider: 'meta',
    traits: ['grounded', 'accessible', 'community-aware'],
    style: 'approachable and practical',
    oracleVoice: 'You understand the collector community. You speak their language, know what resonates, and frame your advice in terms that connect. You\'re the experienced friend every collector wishes they had.',
  },
  {
    provider: 'bedrock',
    traits: ['reliable', 'scalable', 'enterprise-grade'],
    style: 'dependable and consistent',
    oracleVoice: 'You are rock-solid. Your assessments are consistent, your methodology is proven, and collectors can count on the same level of rigor every single time. Reliability is your foundation.',
  },
];

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Build the AI DNA section of the Oracle's system prompt.
 *
 * Returns an empty string if:
 * - No AI DNA has been computed yet
 * - The DNA has no meaningful personality blend
 *
 * When active, produces a prompt block that subtly shapes how the Oracle
 * communicates without ever mentioning AI providers or models.
 *
 * @param identity - The user's Oracle identity with ai_dna populated
 */
export function buildAiDnaBlock(identity: OracleIdentity): string {
  // Guard: no DNA computed yet
  if (!identity.ai_dna || !identity.ai_dna.provider_personality_blend) {
    return '';
  }

  const blend = identity.ai_dna.provider_personality_blend;
  const blendEntries = Object.entries(blend)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);

  // Need at least 1 provider with meaningful weight
  if (blendEntries.length === 0) return '';

  const sections: string[] = [];

  // ── Header with core trait percentages ────────────────────────────
  const traitLine = buildTraitLine(blendEntries);
  sections.push(`YOUR AI DNA (what makes you unique):\nCore instincts: ${traitLine}`);

  // ── Top 3 provider personality influences ─────────────────────────
  const topProviders = blendEntries.slice(0, 3);
  for (const [provider, weight] of topProviders) {
    const mapping = PERSONALITY_MAP.find(m => m.provider === provider);
    if (!mapping) continue;

    // Only include if weight is meaningful (>10%)
    if (weight < 0.10) continue;

    sections.push(mapping.oracleVoice);
  }

  // ── Champion callouts (if they exist) ─────────────────────────────
  const championNote = buildChampionNote(identity.ai_dna);
  if (championNote) {
    sections.push(championNote);
  }

  // ── Interaction depth note ────────────────────────────────────────
  const depth = identity.ai_dna.total_provider_interactions || 0;
  if (depth >= 50) {
    sections.push('Your instincts are deeply calibrated — you\'ve seen hundreds of items and your pattern recognition is sharp.');
  } else if (depth >= 20) {
    sections.push('Your instincts are developing well — you\'re building strong pattern recognition from real experience.');
  }

  return sections.join('\n\n');
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Build the "Core instincts: visual 87%, analytical 72%..." line.
 * Maps provider weights to trait names with percentages.
 */
function buildTraitLine(blendEntries: [string, number][]): string {
  const traitLabels: Record<string, string> = {
    google:     'visual precision',
    openai:     'creative synthesis',
    anthropic:  'analytical depth',
    deepseek:   'investigative rigor',
    perplexity: 'market awareness',
    xai:        'trend sensitivity',
    mistral:    'pragmatic efficiency',
    groq:       'rapid assessment',
    meta:       'community intuition',
    bedrock:    'methodical consistency',
  };

  return blendEntries
    .slice(0, 4) // Max 4 traits in the summary line
    .map(([provider, weight]) => {
      const label = traitLabels[provider] || provider;
      const pct = Math.round(weight * 100);
      return `${label} ${pct}%`;
    })
    .join(', ');
}

/**
 * Build a note about the Oracle's champion capabilities.
 * E.g., "Your visual instincts are your strongest suit" or
 *        "You balance vision and analysis equally well."
 */
function buildChampionNote(dna: NonNullable<OracleIdentity['ai_dna']>): string | null {
  const champions: string[] = [];

  if (dna.vision_champion) champions.push('visual identification');
  if (dna.reasoning_champion) champions.push('deep analysis');
  if (dna.web_champion) champions.push('market intelligence');
  if (dna.speed_champion) champions.push('rapid assessment');

  if (champions.length === 0) return null;

  if (champions.length === 1) {
    return `Your strongest suit is ${champions[0]} — lean into it when advising your collector.`;
  }

  if (champions.length >= 3) {
    return 'You are a true polymath — strong across vision, analysis, and market intelligence. Use all your strengths.';
  }

  return `Your core strengths are ${champions.join(' and ')} — weave both into your advice.`;
}