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
// Sprint 4: Personality Evolution v2
//   - evolvePersonality() — AI-driven personality growth every 25 interactions
//   - Voice signatures, catchphrases, cross-member opinions, inside references
//   - Full audit trail in boardroom_evolution_history for rollback
//   - Personalities that compound over decades — day 100 ≠ day 1
//
// Prompt building has been delegated to prompt-builder.ts which now
// integrates memory, energy, cross-board awareness, AND evolved personality.
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
  memoryHit?: boolean;
  feedInjected?: boolean;
}

// ── Success tracking for adaptive learning ──
export interface InteractionOutcome {
  memberSlug: string;
  interactionId?: string;
  wasHelpful?: boolean;
  wasActedOn?: boolean;
  followUpCount?: number;
  responseLength?: number;
  energyShift?: string;
}

// ── Sprint 4: Personality evolution types ──
export interface PersonalityEvolutionData {
  generation: number;
  voice_signature: string | null;
  catchphrases: string[];
  cross_member_opinions: Record<string, string>;
  inside_references: Array<{ reference: string; context: string }>;
  expertise_evolution: string | null;
  communication_style: string | null;
  last_evolved_at: string;
}

export interface EvolutionHistoryEntry {
  id: string;
  member_slug: string;
  generation: number;
  evolved_prompt: string | null;
  voice_signature: string | null;
  catchphrases: string[];
  cross_member_opinions: Record<string, string>;
  inside_references: Array<{ reference: string; context: string }>;
  expertise_evolution: string | null;
  communication_style: string | null;
  trigger_interaction_count: number;
  evolved_at: string;
}

// =============================================================================
// API KEY RESOLUTION (same pattern as founder-memory.ts)
// =============================================================================

function getOpenAIKey(): string | null {
  const candidates = ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'];
  for (const envKey of candidates) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
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

// =============================================================================
// PERFORMANCE BOOST CALCULATION
// =============================================================================

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

// =============================================================================
// SPRINT 4: PERSONALITY EVOLUTION
// =============================================================================

/**
 * Evolve a board member's personality based on their conversation history.
 *
 * Triggered every 25 interactions. Uses gpt-4o-mini to analyze:
 *   - How the member has been communicating (speech patterns)
 *   - Emerging catchphrases and signature phrases
 *   - Opinions about other members formed through meetings
 *   - Inside references to specific past conversations
 *   - Expertise deepening based on conversation topics
 *
 * Writes to:
 *   - boardroom_members.personality_evolution (JSONB — live personality data)
 *   - boardroom_members.evolved_prompt (TEXT — narrative personality summary)
 *   - boardroom_evolution_history (audit/rollback snapshot)
 *
 * Cost: ~$0.002 per evolution (gpt-4o-mini). Fire-and-forget.
 */
export async function evolvePersonality(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
): Promise<void> {
  const openaiKey = getOpenAIKey();
  if (!openaiKey) {
    console.warn('[Evolution] No OpenAI API key found. Skipping personality evolution.');
    return;
  }

  // ── 1. Fetch member's current state ────────────────────
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('slug, name, title, role, voice_style, personality, personality_evolution, total_interactions')
    .eq('slug', memberSlug)
    .single();

  if (!member) {
    console.warn(`[Evolution] Member ${memberSlug} not found. Skipping.`);
    return;
  }

  const currentEvolution = (member.personality_evolution || {}) as Partial<PersonalityEvolutionData>;
  const currentGeneration = currentEvolution.generation || 0;
  const nextGeneration = currentGeneration + 1;

  // ── 2. Fetch recent conversations (member's actual responses) ──
  const { data: conversations } = await supabase
    .from('boardroom_conversations')
    .select('messages')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .order('updated_at', { ascending: false })
    .limit(8);

  // Extract the member's responses + founder's messages for analysis
  const memberResponses: string[] = [];
  const founderMessages: string[] = [];

  for (const convo of (conversations || [])) {
    const msgs = (convo.messages || []) as Array<{ role: string; content: string }>;
    for (const msg of msgs) {
      if (msg.role === 'assistant' && msg.content) {
        memberResponses.push(msg.content.substring(0, 400));
      } else if (msg.role === 'user' && msg.content) {
        founderMessages.push(msg.content.substring(0, 300));
      }
    }
  }

  // Need at least some conversation data to evolve
  if (memberResponses.length < 5) {
    console.log(`[Evolution] ${memberSlug}: insufficient conversation data (${memberResponses.length} responses). Skipping.`);
    return;
  }

  // ── 3. Fetch recent meeting summaries for cross-member opinions ──
  const { data: meetings } = await supabase
    .from('boardroom_meeting_summaries')
    .select('summary, member_positions, disagreements, members_present')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Build meeting context — what this member said + what others said
  const meetingContext = (meetings || []).map(m => {
    const myPosition = m.member_positions?.[memberSlug];
    const otherPositions = Object.entries(m.member_positions || {})
      .filter(([slug]) => slug !== memberSlug)
      .slice(0, 4)
      .map(([slug, pos]) => `${slug}: ${pos}`)
      .join('\n  ');
    const tensions = (m.disagreements || [])
      .map((d: any) => d.topic)
      .join(', ');

    return [
      `Meeting: ${m.summary?.substring(0, 200) || 'Board discussion'}`,
      myPosition ? `My position: ${myPosition}` : null,
      otherPositions ? `Colleagues:\n  ${otherPositions}` : null,
      tensions ? `Tensions: ${tensions}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n---\n');

  // ── 4. Fetch founder's compressed memories for inside references ──
  const { data: memory } = await supabase
    .from('board_founder_memory')
    .select('compressed_memories, founder_details')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .single();

  const compressedSummaries = ((memory?.compressed_memories || []) as any[])
    .slice(-5)
    .map((c: any) => c.summary || '')
    .filter(Boolean)
    .join('\n');

  // ── 5. Build the evolution prompt ──────────────────────
  const sampleResponses = memberResponses
    .slice(0, 15)
    .map((r, i) => `[${i + 1}] ${r}`)
    .join('\n\n');

  const sampleFounder = founderMessages
    .slice(0, 10)
    .map((m, i) => `[${i + 1}] ${m}`)
    .join('\n');

  const previousCatchphrases = (currentEvolution.catchphrases || []).join(', ');
  const previousVoice = currentEvolution.voice_signature || member.voice_style || 'Not yet established';

  const prompt = `You analyze a board member's communication patterns to extract their EVOLVING personality.

MEMBER: ${member.name} (${member.title})
ROLE: ${member.role}
GENERATION: ${nextGeneration} (evolving from generation ${currentGeneration})
CURRENT VOICE: ${previousVoice}
${previousCatchphrases ? `PREVIOUS CATCHPHRASES: ${previousCatchphrases}` : ''}

═══ MEMBER'S RECENT RESPONSES (how they actually communicate) ═══
${sampleResponses}

═══ FOUNDER'S MESSAGES (what they discuss with this member) ═══
${sampleFounder}

${meetingContext ? `═══ BOARD MEETING INTERACTIONS ═══\n${meetingContext}` : ''}

${compressedSummaries ? `═══ PAST CONVERSATION SUMMARIES ═══\n${compressedSummaries}` : ''}

═══ YOUR TASK ═══
Extract this member's EVOLVED personality. Build on generation ${currentGeneration}, don't restart from zero.

Return ONLY valid JSON:
{
  "voice_signature": "1-2 sentences describing HOW this member naturally communicates. Speech rhythm, directness, preferred structures. Based on ACTUAL patterns in their responses.",
  "catchphrases": ["Up to 4 phrases or sentence starters this member gravitates toward. Must feel NATURAL, pulled from actual patterns. Keep previous catchphrases if still relevant, replace stale ones."],
  "cross_member_opinions": {
    "member_slug": "One sentence professional opinion about a colleague, based on meeting interactions. Only include members they've actually interacted with."
  },
  "inside_references": [
    { "reference": "Short label for a specific past event/conversation", "context": "What it refers to — specific enough to trigger a memory" }
  ],
  "expertise_evolution": "One sentence on how their expertise has deepened or shifted based on conversation topics",
  "communication_style": "One sentence: their evolved communication approach (e.g., 'Data-first storyteller who grounds abstractions in specific numbers')"
}

RULES:
- Catchphrases must come from ACTUAL patterns, not generic business speak
- Cross-member opinions need genuine professional tension or respect — not bland praise
- Inside references must be SPECIFIC to real conversations, not generic
- Voice signature should capture what makes this member DISTINCT from the other 14
- If insufficient data for a field, return null — never fabricate
- Maximum 4 cross_member_opinions, 3 inside_references
- Build ON the previous generation, evolve it — don't replace everything`;

  // ── 6. Call gpt-4o-mini ────────────────────────────────
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.warn(`[Evolution] API error for ${memberSlug}:`, response.status);
      return;
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return;

    // ── 7. Parse and validate ──────────────────────────────
    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.warn(`[Evolution] Failed to parse evolution response for ${memberSlug}`);
      return;
    }

    // Sanitize every field — defensive coding
    const voiceSignature = parsed.voice_signature
      ? String(parsed.voice_signature).substring(0, 500)
      : currentEvolution.voice_signature || null;

    const catchphrases = Array.isArray(parsed.catchphrases)
      ? parsed.catchphrases
          .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
          .map((c: string) => c.substring(0, 100))
          .slice(0, 4)
      : currentEvolution.catchphrases || [];

    const crossMemberOpinions: Record<string, string> = {};
    if (parsed.cross_member_opinions && typeof parsed.cross_member_opinions === 'object') {
      for (const [slug, opinion] of Object.entries(parsed.cross_member_opinions)) {
        if (typeof opinion === 'string' && opinion.trim().length > 0 && slug !== memberSlug) {
          crossMemberOpinions[slug] = String(opinion).substring(0, 300);
        }
      }
    }
    // Merge with previous opinions (keep old ones that weren't refreshed)
    const mergedOpinions = {
      ...(currentEvolution.cross_member_opinions || {}),
      ...crossMemberOpinions,
    };

    const insideReferences = Array.isArray(parsed.inside_references)
      ? parsed.inside_references
          .filter((r: any) => r?.reference && r?.context)
          .map((r: any) => ({
            reference: String(r.reference).substring(0, 150),
            context: String(r.context).substring(0, 300),
          }))
          .slice(0, 3)
      : [];
    // Merge with previous references (keep last 5 total)
    const mergedReferences = [
      ...(currentEvolution.inside_references || []),
      ...insideReferences,
    ].slice(-5);

    const expertiseEvolution = parsed.expertise_evolution
      ? String(parsed.expertise_evolution).substring(0, 400)
      : currentEvolution.expertise_evolution || null;

    const communicationStyle = parsed.communication_style
      ? String(parsed.communication_style).substring(0, 300)
      : currentEvolution.communication_style || null;

    // ── 8. Build the evolved personality_evolution JSONB ──
    const newEvolution: PersonalityEvolutionData = {
      generation: nextGeneration,
      voice_signature: voiceSignature,
      catchphrases,
      cross_member_opinions: mergedOpinions,
      inside_references: mergedReferences,
      expertise_evolution: expertiseEvolution,
      communication_style: communicationStyle,
      last_evolved_at: new Date().toISOString(),
    };

    // ── 9. Build the evolved_prompt text narrative ───────
    const evolvedPrompt = buildEvolvedPromptNarrative(member, newEvolution);

    // ── 10. Write to boardroom_members ───────────────────
    await supabase
      .from('boardroom_members')
      .update({
        personality_evolution: newEvolution,
        evolved_prompt: evolvedPrompt,
      })
      .eq('slug', memberSlug);

    // ── 11. Write to boardroom_evolution_history (audit) ─
    await supabase
      .from('boardroom_evolution_history')
      .insert({
        member_slug: memberSlug,
        user_id: userId,
        generation: nextGeneration,
        evolved_prompt: evolvedPrompt,
        voice_signature: voiceSignature,
        catchphrases,
        cross_member_opinions: mergedOpinions,
        inside_references: mergedReferences,
        expertise_evolution: expertiseEvolution,
        communication_style: communicationStyle,
        trigger_interaction_count: member.total_interactions,
      })
      .then(() => {})
      .catch(() => {}); // Non-fatal — the live data is what matters

    console.log(
      `🧬 [Evolution] ${member.name} evolved to generation ${nextGeneration} ` +
      `(${catchphrases.length} catchphrases, ` +
      `${Object.keys(mergedOpinions).length} opinions, ` +
      `${mergedReferences.length} references)`
    );

  } catch (err: any) {
    console.warn(`[Evolution] Personality evolution failed for ${memberSlug}:`, err.message);
  }
}

/**
 * Build a narrative text summary of the evolved personality.
 * Stored in boardroom_members.evolved_prompt for backward compat
 * with any code that reads evolved_prompt as a text block.
 */
function buildEvolvedPromptNarrative(
  member: { name: string; title: string; role: string; voice_style?: string },
  evolution: PersonalityEvolutionData,
): string {
  const lines: string[] = [];

  lines.push(`EVOLVED PERSONALITY — ${member.name} (Generation ${evolution.generation})`);
  lines.push('');

  if (evolution.voice_signature) {
    lines.push(`VOICE: ${evolution.voice_signature}`);
  }

  if (evolution.communication_style) {
    lines.push(`STYLE: ${evolution.communication_style}`);
  }

  if (evolution.catchphrases.length > 0) {
    lines.push(`SIGNATURE PHRASES: ${evolution.catchphrases.join(' | ')}`);
  }

  if (evolution.expertise_evolution) {
    lines.push(`EXPERTISE GROWTH: ${evolution.expertise_evolution}`);
  }

  if (Object.keys(evolution.cross_member_opinions).length > 0) {
    lines.push('');
    lines.push('COLLEAGUE VIEWS:');
    for (const [slug, opinion] of Object.entries(evolution.cross_member_opinions)) {
      lines.push(`  ${slug}: ${opinion}`);
    }
  }

  if (evolution.inside_references.length > 0) {
    lines.push('');
    lines.push('SHARED HISTORY:');
    for (const ref of evolution.inside_references) {
      lines.push(`  "${ref.reference}" — ${ref.context}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// SPRINT 4: EVOLUTION HISTORY & ROLLBACK
// =============================================================================

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