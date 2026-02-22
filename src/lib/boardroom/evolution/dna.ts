// FILE: src/lib/boardroom/evolution/dna.ts
// ═══════════════════════════════════════════════════════════════════════
// AI DNA EVOLUTION
// ═══════════════════════════════════════════════════════════════════════
//
// Tracks which AI providers work best for each board member.
// DNA shifts are weighted by performance quality, not just usage.
// Includes trust evolution and provider affinity stats.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient, InteractionResult, InteractionOutcome } from './types.js';

// ============================================================================
// PERFORMANCE BOOST CALCULATION
// ============================================================================

function calculatePerformanceBoost(interaction: InteractionResult): number {
  let boost = 0.02;

  if (interaction.responseTime < 1000) boost += 0.02;
  else if (interaction.responseTime < 3000) boost += 0.01;
  else if (interaction.responseTime > 10000) boost -= 0.01;

  if (!interaction.wasFallback) boost += 0.01;
  if (interaction.wasCrossDomain) boost += 0.015;
  if (interaction.memoryHit) boost += 0.01;

  return Math.max(0.005, boost);
}

// ============================================================================
// AI DNA EVOLUTION
// ============================================================================

/**
 * Update a board member's AI DNA after an interaction.
 * Tracks which providers work best for this member's role.
 *
 * ADAPTIVE: DNA shifts are weighted by performance quality,
 * not just usage. A great Anthropic response shifts DNA more
 * than a mediocre OpenAI response.
 */
export async function evolveBoarDna(
  supabase: SupabaseClient,
  interaction: InteractionResult,
): Promise<void> {
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('ai_dna, provider_affinity, total_interactions, cross_domain_assists, trust_level')
    .eq('slug', interaction.memberSlug)
    .single();

  if (!member) return;

  // ── DNA shift calculation ──────────────────────────────
  const dna = { ...member.ai_dna } as Record<string, number>;
  const provider = interaction.providerUsed;
  const performanceBoost = calculatePerformanceBoost(interaction);

  // Increase affinity for the performing provider
  dna[provider] = Math.min(0.80, (dna[provider] || 0.05) + performanceBoost);

  // Decrease others proportionally
  const otherProviders = Object.keys(dna).filter(k => k !== provider);
  const decreasePerOther = performanceBoost / Math.max(otherProviders.length, 1);
  for (const other of otherProviders) {
    dna[other] = Math.max(0.02, (dna[other] || 0.05) - decreasePerOther);
  }

  // Normalize to ~1.0
  const total = Object.values(dna).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const key of Object.keys(dna)) {
      dna[key] = parseFloat((dna[key] / total).toFixed(4));
    }
  }

  // Determine dominant provider
  const dominant = Object.entries(dna)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || member.ai_dna?.dominant_provider;

  // ── Provider affinity stats ────────────────────────────
  const affinity = { ...member.provider_affinity } as Record<string, any>;
  if (!affinity[provider]) {
    affinity[provider] = {
      uses: 0,
      avgResponseTime: 0,
      successRate: 1.0,
      fallbackRate: 0,
      memoryHitRate: 0,
    };
  }
  const prov = affinity[provider];
  prov.uses = (prov.uses || 0) + 1;
  prov.avgResponseTime = Math.round(
    ((prov.avgResponseTime || 0) * (prov.uses - 1) + interaction.responseTime) / prov.uses
  );
  prov.fallbackRate = parseFloat(
    (((prov.fallbackRate || 0) * (prov.uses - 1) + (interaction.wasFallback ? 1 : 0)) / prov.uses).toFixed(3)
  );
  if (interaction.memoryHit !== undefined) {
    prov.memoryHitRate = parseFloat(
      (((prov.memoryHitRate || 0) * (prov.uses - 1) + (interaction.memoryHit ? 1 : 0)) / prov.uses).toFixed(3)
    );
  }

  // ── Trust evolution ────────────────────────────────────
  let trustDelta = 0;
  if (!interaction.wasFallback && interaction.responseTime < 5000) trustDelta += 1;
  if (interaction.wasCrossDomain) trustDelta += 2;
  if (interaction.memoryHit) trustDelta += 1;
  if (interaction.wasFallback) trustDelta -= 1;
  const newTrust = Math.max(0, Math.min(100, member.trust_level + trustDelta));

  // ── Persist ────────────────────────────────────────────
  await supabase
    .from('boardroom_members')
    .update({
      ai_dna: dna,
      dominant_provider: dominant,
      provider_affinity: affinity,
      total_interactions: member.total_interactions + 1,
      cross_domain_assists: member.cross_domain_assists + (interaction.wasCrossDomain ? 1 : 0),
      trust_level: newTrust,
      last_active_at: new Date().toISOString(),
    })
    .eq('slug', interaction.memberSlug);

  // ── Interaction log ────────────────────────────────────
  await supabase
    .from('board_interaction_log')
    .insert({
      member_slug: interaction.memberSlug,
      message_type: interaction.messageType,
      topic_category: interaction.topicCategory,
      was_cross_domain: interaction.wasCrossDomain,
      provider_used: interaction.providerUsed,
      model_used: interaction.modelUsed,
      response_time: interaction.responseTime,
      was_fallback: interaction.wasFallback,
      founder_energy: interaction.founderEnergy || null,
      founder_arc: interaction.founderArc || null,
      memory_hit: interaction.memoryHit || false,
      feed_injected: interaction.feedInjected || false,
    })
    .then(() => {})
    .catch(() => {}); // Non-fatal
}

// ============================================================================
// INTERACTION OUTCOME RECORDING
// ============================================================================

/**
 * Record the outcome of an interaction (founder feedback / engagement signals).
 * Used to adapt what "success" means for each member over time.
 */
export async function recordInteractionOutcome(
  supabase: SupabaseClient,
  outcome: InteractionOutcome,
): Promise<void> {
  if (outcome.wasHelpful !== undefined) {
    const { data: member } = await supabase
      .from('boardroom_members')
      .select('trust_level')
      .eq('slug', outcome.memberSlug)
      .single();

    if (member) {
      const delta = outcome.wasHelpful ? 3 : -2;
      const newTrust = Math.max(0, Math.min(100, member.trust_level + delta));

      await supabase
        .from('boardroom_members')
        .update({ trust_level: newTrust })
        .eq('slug', outcome.memberSlug);
    }
  }

  await supabase
    .from('board_interaction_log')
    .update({
      was_helpful: outcome.wasHelpful,
      was_acted_on: outcome.wasActedOn,
      follow_up_count: outcome.followUpCount,
      energy_shift: outcome.energyShift,
    })
    .eq('member_slug', outcome.memberSlug)
    .order('created_at', { ascending: false })
    .limit(1)
    .then(() => {})
    .catch(() => {});
}

// ============================================================================
// BATCH EVOLUTION (for meeting summaries)
// ============================================================================

export async function evolveBoardAfterMeeting(
  supabase: SupabaseClient,
  interactions: InteractionResult[],
): Promise<{ evolved: number }> {
  let evolved = 0;
  for (const interaction of interactions) {
    await evolveBoarDna(supabase, interaction);
    evolved++;
  }
  return { evolved };
}