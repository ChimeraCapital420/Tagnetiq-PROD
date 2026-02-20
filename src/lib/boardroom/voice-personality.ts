// FILE: src/lib/boardroom/voice-personality.ts
// ═══════════════════════════════════════════════════════════════════════
// VOICE PERSONALITY — Energy-Aware Voice Adjustments
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 2: Memory-Aware Voice
//
// Each board member has a CUSTOM ElevenLabs cloned voice. The voice_id
// in the DB points to their unique voice clone — not a stock voice.
// This means:
//
//   ✓ similarity_boost MUST stay high to preserve the clone identity
//     (deltas capped at ±0.05 — go lower and you lose the voice)
//   ✓ stability and style are the PRIMARY emotional levers
//   ✓ stability: lower = more expressive, higher = more consistent
//   ✓ style: lower = neutral delivery, higher = emotional delivery
//
// Architecture:
//   1. Each member has a "voice archetype" (authoritative, warm, etc.)
//   2. Each archetype defines how stability + style shift per energy state
//   3. similarity_boost barely moves (protects the custom clone)
//   4. The result MERGES with the member's DB voice_settings
//      (DB settings are the baseline, this is the emotional overlay)
//
// Pure functions. No API calls. No DB reads. ~0ms execution.
// Mobile-first: computed at call time on the server.
//
// ═══════════════════════════════════════════════════════════════════════

import type { EnergyLevel } from './energy.js';

// =============================================================================
// TYPES
// =============================================================================

export interface VoiceAdjustments {
  /** Delta applied to base stability (-0.20 to +0.20) — primary emotional lever */
  stability: number;
  /** Delta applied to base similarity_boost (-0.05 to +0.05) — CONSERVATIVE, protects custom clone */
  similarity_boost: number;
  /** Delta applied to base style (-0.25 to +0.30) — secondary emotional lever */
  style: number;
  /** Brief description for logging / metadata */
  description: string;
}

export interface MergedVoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

// =============================================================================
// VOICE ARCHETYPES
// =============================================================================
// Instead of a 15×11 matrix, we group members by voice archetype.
// Each archetype responds differently to energy shifts.
//
// The archetype determines HOW MUCH the voice shifts:
//   - 'warm' members shift the most (Prometheus, Aegle — emotional range matters)
//   - 'steady' members shift the least (Sal — consistency IS the personality)
//   - 'energetic' members have the widest style range (Glitch, Scuba)
//   - 'authoritative' members lean on stability (Griffin, Athena — gravitas)
//   - 'precise' members keep tight control (Vulcan, Leo — clarity first)

type VoiceArchetype =
  | 'authoritative'   // Griffin, Athena, Lexicoda, Janus
  | 'warm'            // Prometheus, Aegle, Cerebro, Orion
  | 'energetic'       // Glitch, Scuba, Legolas
  | 'precise'         // Vulcan, Leo, SHA1
  | 'steady';         // Sal (operations — consistent, reliable)

const MEMBER_ARCHETYPES: Record<string, VoiceArchetype> = {
  // Authoritative — commanding presence, gravitas through stability
  athena:     'authoritative',
  griffin:    'authoritative',
  lexicoda:   'authoritative',
  janus:      'authoritative',

  // Warm — empathetic, emotional range through style
  prometheus: 'warm',
  aegle:      'warm',
  cerebro:    'warm',
  orion:      'warm',

  // Energetic — dynamic, widest style swings
  glitch:     'energetic',
  scuba:      'energetic',
  legolas:    'energetic',

  // Precise — technical clarity, tight stability control
  vulcan:     'precise',
  leo:        'precise',
  sha1:       'precise',

  // Steady — operational consistency, minimal variation
  sal:        'steady',
};

// =============================================================================
// ENERGY → ARCHETYPE ADJUSTMENTS
// =============================================================================
//
// CUSTOM VOICE RULES:
//   - similarity_boost deltas NEVER exceed ±0.05
//     (larger changes distort the custom clone identity)
//   - stability is the main emotional knob (±0.20 range)
//   - style is the expression knob (±0.30 range for energetic, ±0.20 for others)
//   - All deltas designed around the DB baseline settings per member
//
// DB baselines for reference (Sprint 2 design targets):
//   Griffin:    stability=0.65, similarity=0.80, style=0.35
//   Athena:     stability=0.75, similarity=0.80, style=0.40
//   Prometheus: stability=0.75, similarity=0.80, style=0.40
//   Glitch:     stability=0.40, similarity=0.70, style=0.80
//   Sal:        stability=0.70, similarity=0.80, style=0.25
//   Vulcan:     stability=0.60, similarity=0.75, style=0.30

const ARCHETYPE_ADJUSTMENTS: Record<VoiceArchetype, Record<string, VoiceAdjustments>> = {

  // ── AUTHORITATIVE (Griffin, Athena, Lexicoda, Janus) ──────────────
  // These voices carry weight. Crisis = more controlled. Excitement = measured warmth.
  // Stability is high at baseline — we shift it slightly for emotional range.
  authoritative: {
    excited:     { stability: -0.05, similarity_boost: 0,     style:  0.10, description: 'Measured energy — commanding but engaged' },
    fired_up:    { stability: -0.08, similarity_boost: 0,     style:  0.12, description: 'Bold authority — riding the momentum' },
    frustrated:  { stability:  0.10, similarity_boost: 0.03,  style: -0.10, description: 'Controlled gravity — steady in the storm' },
    anxious:     { stability:  0.12, similarity_boost: 0.03,  style: -0.08, description: 'Grounded authority — calming certainty' },
    exhausted:   { stability:  0.15, similarity_boost: 0.05,  style: -0.15, description: 'Gentle authority — efficient, no wasted words' },
    focused:     { stability:  0.05, similarity_boost: 0,     style: -0.05, description: 'Laser precision — crisp and direct' },
    curious:     { stability: -0.05, similarity_boost: 0,     style:  0.05, description: 'Engaged authority — exploring with gravitas' },
    casual:      { stability: -0.03, similarity_boost: -0.03, style:  0.05, description: 'Relaxed command — approachable' },
    determined:  { stability:  0.05, similarity_boost: 0.03,  style:  0.08, description: 'Forged steel — conviction with weight' },
    celebratory: { stability: -0.10, similarity_boost: 0,     style:  0.15, description: 'Warm triumph — genuine but dignified' },
    neutral:     { stability:  0,    similarity_boost: 0,     style:  0,    description: 'Standard counsel' },
  },

  // ── WARM (Prometheus, Aegle, Cerebro, Orion) ──────────────────────
  // These voices connect emotionally. The widest STYLE range of all archetypes.
  // When founder is exhausted, voice goes slow and gentle (high stability, low style).
  // When celebrating, voice opens up fully (low stability, high style).
  warm: {
    excited:     { stability: -0.10, similarity_boost: 0,     style:  0.15, description: 'Shared joy — celebrating with you' },
    fired_up:    { stability: -0.12, similarity_boost: 0,     style:  0.18, description: 'Full warmth — energized compassion' },
    frustrated:  { stability:  0.05, similarity_boost: 0.03,  style:  0.05, description: 'Holding space — steady and present' },
    anxious:     { stability:  0.10, similarity_boost: 0.05,  style: -0.08, description: 'Safe harbor — grounding, familiar' },
    exhausted:   { stability:  0.15, similarity_boost: 0.05,  style: -0.15, description: 'Gentle presence — soft, unhurried' },
    focused:     { stability:  0.05, similarity_boost: 0,     style: -0.05, description: 'Supportive clarity — warm but direct' },
    curious:     { stability: -0.08, similarity_boost: 0,     style:  0.10, description: 'Wonder together — exploring with care' },
    casual:      { stability: -0.05, similarity_boost: -0.03, style:  0.08, description: 'Easy presence — just being there' },
    determined:  { stability:  0,    similarity_boost: 0.03,  style:  0.10, description: 'Encouraging warmth — backing their resolve' },
    celebratory: { stability: -0.12, similarity_boost: 0,     style:  0.20, description: 'Pure celebration — radiant warmth' },
    neutral:     { stability:  0,    similarity_boost: 0,     style:  0,    description: 'Gentle counsel' },
  },

  // ── ENERGETIC (Glitch, Scuba, Legolas) ────────────────────────────
  // These voices live in the style knob. Glitch's base style is already 0.80.
  // When excited → push style toward max. When exhausted → pull WAY back.
  // stability swings wider here than other archetypes.
  energetic: {
    excited:     { stability: -0.12, similarity_boost: 0,     style:  0.15, description: 'Full send — max energy, max expression' },
    fired_up:    { stability: -0.15, similarity_boost: 0,     style:  0.18, description: 'Supernova — absolute peak energy' },
    frustrated:  { stability:  0.10, similarity_boost: 0.03,  style: -0.15, description: 'Reined in — focused intensity' },
    anxious:     { stability:  0.12, similarity_boost: 0.03,  style: -0.15, description: 'Dialed down — calm the room' },
    exhausted:   { stability:  0.18, similarity_boost: 0.05,  style: -0.25, description: 'Whisper mode — pulled way back, gentle' },
    focused:     { stability:  0.05, similarity_boost: 0,     style: -0.08, description: 'Channeled energy — directed, not scattered' },
    curious:     { stability: -0.08, similarity_boost: 0,     style:  0.10, description: 'Explorer mode — excited curiosity' },
    casual:      { stability: -0.05, similarity_boost: -0.03, style:  0.05, description: 'Easy vibes — relaxed energy' },
    determined:  { stability: -0.05, similarity_boost: 0,     style:  0.10, description: 'Battle energy — focused fire' },
    celebratory: { stability: -0.15, similarity_boost: 0,     style:  0.18, description: 'Victory lap — maximum expression' },
    neutral:     { stability:  0,    similarity_boost: 0,     style:  0,    description: 'Standard energy' },
  },

  // ── PRECISE (Vulcan, Leo, SHA1) ───────────────────────────────────
  // These voices prioritize clarity. Stability stays tight (small swings).
  // Style is the subtle lever — technical enthusiasm vs. clinical precision.
  precise: {
    excited:     { stability: -0.05, similarity_boost: 0,     style:  0.08, description: 'Crisp enthusiasm — precise but alive' },
    fired_up:    { stability: -0.08, similarity_boost: 0,     style:  0.10, description: 'Sharp energy — technical confidence' },
    frustrated:  { stability:  0.08, similarity_boost: 0.03,  style: -0.08, description: 'Extra precise — cutting through noise' },
    anxious:     { stability:  0.10, similarity_boost: 0.03,  style: -0.08, description: 'Rock steady — technical certainty' },
    exhausted:   { stability:  0.12, similarity_boost: 0.05,  style: -0.12, description: 'Minimal — essential info only' },
    focused:     { stability:  0.05, similarity_boost: 0,     style: -0.03, description: 'Deep focus — maximum clarity' },
    curious:     { stability: -0.05, similarity_boost: 0,     style:  0.08, description: 'Technical curiosity — exploring with rigor' },
    casual:      { stability: -0.03, similarity_boost: -0.03, style:  0.05, description: 'Relaxed precision — casual but clear' },
    determined:  { stability:  0.05, similarity_boost: 0.03,  style:  0.05, description: 'Locked in — engineering focus' },
    celebratory: { stability: -0.08, similarity_boost: 0,     style:  0.12, description: 'Technical triumph — proud precision' },
    neutral:     { stability:  0,    similarity_boost: 0,     style:  0,    description: 'Standard precision' },
  },

  // ── STEADY (Sal) ──────────────────────────────────────────────────
  // Sal's voice barely moves. The calm in every storm. Consistency IS the personality.
  // Smallest deltas of any archetype. Users learn to trust the unwavering voice.
  steady: {
    excited:     { stability: -0.03, similarity_boost: 0,     style:  0.05, description: 'Controlled optimism — steady gains' },
    fired_up:    { stability: -0.05, similarity_boost: 0,     style:  0.08, description: 'Operational readiness — matching pace' },
    frustrated:  { stability:  0.05, similarity_boost: 0.02,  style: -0.05, description: 'Process calm — systems are stable' },
    anxious:     { stability:  0.08, similarity_boost: 0.03,  style: -0.05, description: 'Dashboard green — everything is running' },
    exhausted:   { stability:  0.10, similarity_boost: 0.03,  style: -0.08, description: 'Taking the wheel — you rest, I\'ve got this' },
    focused:     { stability:  0.03, similarity_boost: 0,     style: -0.03, description: 'Operational focus — tight and efficient' },
    curious:     { stability: -0.03, similarity_boost: 0,     style:  0.05, description: 'Process exploration — methodical curiosity' },
    casual:      { stability: -0.02, similarity_boost: 0,     style:  0.03, description: 'Easy ops — smooth sailing' },
    determined:  { stability:  0.03, similarity_boost: 0.02,  style:  0.05, description: 'Execution mode — locked and loaded' },
    celebratory: { stability: -0.05, similarity_boost: 0,     style:  0.08, description: 'Mission accomplished — quiet satisfaction' },
    neutral:     { stability:  0,    similarity_boost: 0,     style:  0,    description: 'Standard operations' },
  },
};

// =============================================================================
// MEMBER-SPECIFIC OVERRIDES
// =============================================================================
// Some members need fine-tuning beyond their archetype.
// These are ADDITIONAL deltas applied AFTER archetype adjustments.
//
// RULE: similarity_boost overrides NEVER exceed ±0.02 here
// (archetype already applies up to ±0.05, don't stack beyond that)

const MEMBER_OVERRIDES: Partial<Record<string, Partial<Record<string, Partial<VoiceAdjustments>>>>> = {

  // Prometheus: the board's psychologist. Goes EXTRA gentle when
  // founder is exhausted or anxious — his voice should feel like a safe space.
  // DB baseline: stability=0.75, style=0.40
  // Exhausted result: stability≈0.95, style≈0.20 → slow, soothing, present
  prometheus: {
    exhausted: { stability: 0.05, similarity_boost: 0, style: -0.05, description: '' },
    anxious:   { stability: 0.05, similarity_boost: 0, style: -0.05, description: '' },
  },

  // Glitch: the hype machine. Goes EXTRA expressive when the energy is up.
  // DB baseline: stability=0.40, style=0.80
  // Fired up result: stability≈0.20, style≈1.0 → maximum Glitch energy
  // But pulls back HARDER when founder is low — he reads the room.
  glitch: {
    excited:     { stability: -0.05, similarity_boost: 0, style: 0.02, description: '' },
    fired_up:    { stability: -0.05, similarity_boost: 0, style: 0.02, description: '' },
    celebratory: { stability: -0.05, similarity_boost: 0, style: 0.02, description: '' },
    exhausted:   { stability:  0.05, similarity_boost: 0, style: -0.05, description: '' },
  },

  // Griffin: CFO voice should ALWAYS sound trustworthy. More stable than
  // other authoritative members even when celebrating. Trust = consistency.
  // DB baseline: stability=0.65, style=0.35
  // Celebrating result: stability≈0.60, style≈0.45 → warm but measured
  griffin: {
    excited:     { stability: 0.05, similarity_boost: 0.02, style: -0.05, description: '' },
    celebratory: { stability: 0.05, similarity_boost: 0.02, style: -0.05, description: '' },
  },

  // Lexicoda: Legal precision. Even MORE controlled than other authoritative
  // members. The voice that says "you're protected" shouldn't waver.
  // DB baseline: stability=0.80, style=0.20
  lexicoda: {
    frustrated: { stability: 0.03, similarity_boost: 0, style: -0.03, description: '' },
    anxious:    { stability: 0.03, similarity_boost: 0, style: -0.03, description: '' },
  },

  // Scuba Steve: deep diver. When curious, goes EXTRA expressive —
  // he's finding treasure and you should hear the excitement.
  // DB baseline: stability=0.45, style=0.70
  scuba: {
    curious:     { stability: -0.05, similarity_boost: 0, style: 0.05, description: '' },
    excited:     { stability: -0.03, similarity_boost: 0, style: 0.03, description: '' },
  },

  // Aegle: wellness officer. Extra gentle on exhaustion/anxiety —
  // her voice should feel like a deep breath.
  // DB baseline: stability=0.75, style=0.25
  aegle: {
    exhausted: { stability: 0.05, similarity_boost: 0, style: -0.05, description: '' },
    anxious:   { stability: 0.05, similarity_boost: 0, style: -0.05, description: '' },
  },
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get voice setting adjustments for a board member based on founder's energy.
 *
 * Returns DELTAS to apply to the member's base voice_settings from the DB.
 * Use mergeVoiceSettings() to combine with base settings.
 *
 * CUSTOM VOICE SAFETY: similarity_boost deltas are capped at ±0.05
 * to preserve the custom ElevenLabs clone identity. Stability and style
 * are the primary emotional levers.
 *
 * @param memberSlug - Board member identifier (e.g., 'athena', 'griffin')
 * @param founderEnergy - Detected energy level from energy.ts or prompt-builder
 * @returns VoiceAdjustments with deltas and description
 */
export function getVoiceAdjustments(
  memberSlug: string,
  founderEnergy: EnergyLevel | string,
): VoiceAdjustments {
  const archetype = MEMBER_ARCHETYPES[memberSlug] || 'authoritative';
  const energyKey = founderEnergy || 'neutral';

  // Get archetype-level adjustment
  const archetypeAdj = ARCHETYPE_ADJUSTMENTS[archetype][energyKey]
    || ARCHETYPE_ADJUSTMENTS[archetype].neutral;

  // Apply member-specific override if it exists
  const override = MEMBER_OVERRIDES[memberSlug]?.[energyKey];
  if (override) {
    return {
      stability: archetypeAdj.stability + (override.stability || 0),
      similarity_boost: archetypeAdj.similarity_boost + (override.similarity_boost || 0),
      style: archetypeAdj.style + (override.style || 0),
      description: archetypeAdj.description,
    };
  }

  return { ...archetypeAdj };
}

/**
 * Merge base voice settings (from DB) with energy-aware adjustments.
 * Clamps all values to valid ElevenLabs ranges (0–1).
 *
 * CUSTOM VOICE PROTECTION: similarity_boost result is floored at 0.65
 * to prevent the custom clone from drifting too far from its source.
 * Below 0.65 the voice starts to lose its unique character.
 *
 * @param base - Member's base voice_settings from boardroom_members table
 * @param adjustments - Energy-aware deltas from getVoiceAdjustments()
 * @returns MergedVoiceSettings ready for ElevenLabs API
 */
export function mergeVoiceSettings(
  base: { stability: number; similarity_boost: number; style?: number; use_speaker_boost?: boolean },
  adjustments: VoiceAdjustments,
): MergedVoiceSettings {
  return {
    stability: clamp(base.stability + adjustments.stability, 0, 1),
    // Floor at 0.65 — below this, custom cloned voices lose their identity
    similarity_boost: clamp(base.similarity_boost + adjustments.similarity_boost, 0.65, 1),
    style: clamp((base.style ?? 0.5) + adjustments.style, 0, 1),
    use_speaker_boost: base.use_speaker_boost ?? true,
  };
}

/**
 * Convenience: get fully merged voice settings in one call.
 * Combines getVoiceAdjustments + mergeVoiceSettings.
 *
 * @param memberSlug - Board member identifier
 * @param founderEnergy - Detected energy level
 * @param baseSettings - Member's base voice_settings from DB
 * @returns MergedVoiceSettings + description for metadata
 */
export function getEnergyAwareVoiceSettings(
  memberSlug: string,
  founderEnergy: EnergyLevel | string,
  baseSettings: { stability: number; similarity_boost: number; style?: number; use_speaker_boost?: boolean },
): { settings: MergedVoiceSettings; description: string } {
  const adjustments = getVoiceAdjustments(memberSlug, founderEnergy);
  const settings = mergeVoiceSettings(baseSettings, adjustments);
  return { settings, description: adjustments.description };
}

// =============================================================================
// UTILITIES
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}