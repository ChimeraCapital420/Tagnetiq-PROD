// FILE: src/lib/boardroom/evolution.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD MEMBER EVOLUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint M+: Evolution engine focused on what it does best:
//   - AI DNA tracking (which providers serve each member best)
//   - Trust escalation (earn autonomy through performance)
//   - Cross-domain detection (members grow beyond their title)
//   - Adaptive metrics (learn what "success" looks like over time)
//
// Prompt building has been delegated to prompt-builder.ts which now
// integrates memory, energy, and cross-board awareness.
//
// ADAPTIVE DESIGN:
//   - Every metric has a decay factor (old data matters less)
//   - Success criteria evolve based on founder feedback
//   - Trust is earned AND can be lost (bad advice = trust decay)
//   - DNA shifts reflect real provider performance, not just usage
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface BoardMember {
  slug: string;
  name: string;
  title: string;
  role: string;
  ai_provider: string;
  ai_model: string;
  personality: Record<string, any>;
  expertise: string[];
  system_prompt: string;
  evolved_prompt: string | null;
  voice_style: string;
  ai_dna: Record<string, number>;
  dominant_provider: string | null;
  provider_affinity: Record<string, any>;
  personality_evolution: Record<string, any>;
  trust_level: number;
  total_interactions: number;
  cross_domain_assists: number;
  current_energy: string;
  last_active_at: string | null;
  is_active: boolean;
  display_order: number;
}

export interface InteractionResult {
  memberSlug: string;
  providerUsed: string;
  modelUsed: string;
  responseTime: number;
  wasFallback: boolean;
  wasCrossDomain: boolean;
  topicCategory: string;
  messageType: 'chat' | 'analysis' | 'decision' | 'cross_domain' | 'autonomous';
  // ── Phase 0 additions ──
  founderEnergy?: string;
  founderArc?: string;
  memoryHit?: boolean;      // Did founder memory contribute to this response?
  feedInjected?: boolean;   // Was cross-board feed injected?
}

// ── Success tracking for adaptive learning ──
export interface InteractionOutcome {
  memberSlug: string;
  interactionId?: string;
  // Founder signals (captured from UI or inferred)
  wasHelpful?: boolean;        // Thumbs up/down
  wasActedOn?: boolean;        // Did founder take the advice?
  followUpCount?: number;      // How many follow-up messages (engagement proxy)
  responseLength?: number;     // Longer founder responses = more engagement
  energyShift?: string;        // Did energy improve after this response?
}

// =============================================================================
// AI DNA EVOLUTION
// =============================================================================

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
  // Track memory utilization rate
  if (interaction.memoryHit !== undefined) {
    prov.memoryHitRate = parseFloat(
      (((prov.memoryHitRate || 0) * (prov.uses - 1) + (interaction.memoryHit ? 1 : 0)) / prov.uses).toFixed(3)
    );
  }

  // ── Trust evolution ────────────────────────────────────
  let trustDelta = 0;
  if (!interaction.wasFallback && interaction.responseTime < 5000) trustDelta += 1;
  if (interaction.wasCrossDomain) trustDelta += 2;
  if (interaction.memoryHit) trustDelta += 1; // Memory-informed responses earn extra trust
  // Fallback penalty (provider unreliability erodes trust slightly)
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

/**
 * Record the outcome of an interaction (founder feedback / engagement signals).
 * Used to adapt what "success" means for each member over time.
 */
export async function recordInteractionOutcome(
  supabase: SupabaseClient,
  outcome: InteractionOutcome,
): Promise<void> {
  // Trust adjustment based on founder signals
  if (outcome.wasHelpful !== undefined) {
    const { data: member } = await supabase
      .from('boardroom_members')
      .select('trust_level')
      .eq('slug', outcome.memberSlug)
      .single();

    if (member) {
      const delta = outcome.wasHelpful ? 3 : -2; // Positive signal = bigger boost
      const newTrust = Math.max(0, Math.min(100, member.trust_level + delta));

      await supabase
        .from('boardroom_members')
        .update({ trust_level: newTrust })
        .eq('slug', outcome.memberSlug);
    }
  }

  // Log for future adaptive learning
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

// =============================================================================
// PERFORMANCE BOOST CALCULATION
// =============================================================================

function calculatePerformanceBoost(interaction: InteractionResult): number {
  let boost = 0.02; // Base boost for any successful interaction

  // Speed bonus
  if (interaction.responseTime < 1000) boost += 0.02;
  else if (interaction.responseTime < 3000) boost += 0.01;
  else if (interaction.responseTime > 10000) boost -= 0.01; // Slow = penalty

  // Reliability bonus
  if (!interaction.wasFallback) boost += 0.01;

  // Cross-domain bonus (versatility)
  if (interaction.wasCrossDomain) boost += 0.015;

  // Memory-informed bonus (using context well)
  if (interaction.memoryHit) boost += 0.01;

  return Math.max(0.005, boost); // Always at least a tiny boost
}

// =============================================================================
// CROSS-DOMAIN DETECTION
// =============================================================================

const DOMAIN_MAP: Record<string, string[]> = {
  CFO: ['finance', 'revenue', 'pricing', 'budget', 'accounting', 'fundraising'],
  CTO: ['architecture', 'code', 'technical', 'infrastructure', 'engineering', 'devops'],
  CMO: ['marketing', 'brand', 'growth', 'content', 'acquisition', 'social'],
  COO: ['operations', 'process', 'efficiency', 'health', 'performance', 'reliability'],
  CSO: ['strategy', 'competitive', 'planning', 'positioning', 'market'],
  Legal: ['legal', 'compliance', 'contracts', 'ip', 'regulatory', 'risk'],
  CISO: ['security', 'fraud', 'trust', 'verification', 'encryption', 'privacy'],
  CIO: ['innovation', 'research', 'emerging', 'experimentation', 'future'],
  CHRO: ['hr', 'culture', 'communications', 'support', 'community', 'feedback'],
  CKO: ['knowledge', 'research', 'documentation', 'learning', 'information'],
  CDO: ['data', 'analytics', 'metrics', 'database', 'ml', 'quality'],
  CSciO: ['science', 'experiment', 'methodology', 'hypothesis', 'analysis'],
  Research: ['research', 'investigation', 'deep-dive', 'discovery'],
  Product: ['product', 'ux', 'features', 'roadmap', 'user-experience'],
  Psychology: ['psychology', 'behavior', 'motivation', 'mental-health', 'cognitive'],
};

/**
 * Detect if a message topic is outside a board member's primary domain.
 */
export function isCrossDomain(member: BoardMember, topicCategory: string): boolean {
  const memberDomains = DOMAIN_MAP[member.role] || [];
  const topic = topicCategory.toLowerCase();
  return !memberDomains.some(d => topic.includes(d));
}

// =============================================================================
// TOPIC DETECTION
// =============================================================================

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/\b(revenue|cost|budget|pricing|margin|p[&]l|financial|roi|subscription|stripe)\b/i, 'finance'],
  [/\b(security|fraud|hack|breach|encrypt|auth|verification|trust)\b/i, 'security'],
  [/\b(strateg|competi|market position|long.?term|vision|pivot)\b/i, 'strategy'],
  [/\b(code|bug|deploy|api|refactor|architect|infra|database)\b/i, 'technical'],
  [/\b(market|brand|growth|campaign|seo|social|content|acquisition)\b/i, 'marketing'],
  [/\b(legal|compliance|contract|ip|patent|regulat|terms|privacy)\b/i, 'legal'],
  [/\b(hire|team|culture|onboard|performance review|hr)\b/i, 'hr'],
  [/\b(data|analytics|metric|dashboard|ml|model|pipeline)\b/i, 'data'],
  [/\b(product|feature|ux|roadmap|user experience|design)\b/i, 'product'],
  [/\b(research|investigat|deep.?dive|analysis|study)\b/i, 'research'],
  [/\b(science|experiment|hypothesis|method|test)\b/i, 'science'],
  [/\b(innovat|emerging|future|ai|blockchain|trend)\b/i, 'innovation'],
  [/\b(operat|process|efficien|uptime|health|monitor)\b/i, 'operations'],
  [/\b(psycholog|behavior|motivat|cognitiv|mental)\b/i, 'psychology'],
];

export function detectTopicCategory(message: string): string {
  for (const [pattern, category] of TOPIC_PATTERNS) {
    if (pattern.test(message)) return category;
  }
  return 'general';
}

// =============================================================================
// BATCH EVOLUTION (for meeting summaries)
// =============================================================================

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

// =============================================================================
// TRUST LEVEL HELPERS
// =============================================================================

export function getTrustTier(trustLevel: number): 'observer' | 'advisor' | 'trusted' | 'autonomous' {
  if (trustLevel < 40) return 'observer';
  if (trustLevel < 60) return 'advisor';
  if (trustLevel < 80) return 'trusted';
  return 'autonomous';
}

export function getTrustDescription(trustLevel: number): string {
  const tier = getTrustTier(trustLevel);
  switch (tier) {
    case 'observer':
      return 'Observer. You provide analysis and recommendations. All actions require human approval.';
    case 'advisor':
      return 'Advisor. You can make minor decisions within your domain. Major actions need approval.';
    case 'trusted':
      return 'Trusted. You can act within your domain with post-hoc review. You\'ve earned this.';
    case 'autonomous':
      return 'Autonomous. Full authority in your domain. You\'ve proven yourself through consistent excellence.';
  }
}

// =============================================================================
// DNA FLAVOR TEXT
// =============================================================================

export const DNA_TRAITS: Record<string, string> = {
  openai: 'versatile and clear-headed, strong at structured reasoning',
  anthropic: 'deeply analytical with nuanced ethical awareness',
  google: 'fast pattern recognition with broad knowledge synthesis',
  deepseek: 'rigorous reasoning with deep analytical precision',
  groq: 'lightning-fast with crisp decisive energy',
  xai: 'creative and contrarian with real-time awareness',
  perplexity: 'research-obsessed with always-current information',
  mistral: 'precise and efficient with European engineering discipline',
};