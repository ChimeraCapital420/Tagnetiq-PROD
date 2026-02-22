// FILE: src/lib/boardroom/evolution/history.ts
// ═══════════════════════════════════════════════════════════════════════
// EVOLUTION HISTORY & ROLLBACK
// ═══════════════════════════════════════════════════════════════════════
//
// Audit trail for personality evolution. Every generation is snapshotted
// in boardroom_evolution_history for debugging and rollback.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient, PersonalityEvolutionData, EvolutionHistoryEntry } from './types.js';

// ============================================================================
// GET EVOLUTION HISTORY
// ============================================================================

/**
 * Get the evolution history for a member (newest first).
 * Useful for debugging and rollback UI.
 */
export async function getEvolutionHistory(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  limit: number = 10,
): Promise<EvolutionHistoryEntry[]> {
  const { data } = await supabase
    .from('boardroom_evolution_history')
    .select(
      'id, member_slug, generation, evolved_prompt, voice_signature, catchphrases, ' +
      'cross_member_opinions, inside_references, expertise_evolution, communication_style, ' +
      'trigger_interaction_count, evolved_at'
    )
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .order('generation', { ascending: false })
    .limit(limit);

  return (data || []) as EvolutionHistoryEntry[];
}

// ============================================================================
// ROLLBACK PERSONALITY
// ============================================================================

/**
 * Rollback a member's personality to a specific generation.
 * Reads from boardroom_evolution_history and writes to boardroom_members.
 */
export async function rollbackPersonality(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  targetGeneration: number,
): Promise<boolean> {
  const { data: snapshot } = await supabase
    .from('boardroom_evolution_history')
    .select('*')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .eq('generation', targetGeneration)
    .single();

  if (!snapshot) {
    console.warn(`[Evolution] No snapshot found for ${memberSlug} generation ${targetGeneration}`);
    return false;
  }

  const restoredEvolution: PersonalityEvolutionData = {
    generation: snapshot.generation,
    voice_signature: snapshot.voice_signature,
    catchphrases: snapshot.catchphrases || [],
    cross_member_opinions: snapshot.cross_member_opinions || {},
    inside_references: snapshot.inside_references || [],
    expertise_evolution: snapshot.expertise_evolution,
    communication_style: snapshot.communication_style,
    last_evolved_at: new Date().toISOString(),
  };

  await supabase
    .from('boardroom_members')
    .update({
      personality_evolution: restoredEvolution,
      evolved_prompt: snapshot.evolved_prompt,
    })
    .eq('slug', memberSlug);

  console.log(`[Evolution] ${memberSlug} rolled back to generation ${targetGeneration}`);
  return true;
}