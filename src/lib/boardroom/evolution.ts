// FILE: src/lib/boardroom/evolution.ts
// Board Member Evolution Engine
//
// Sprint M: Each board member evolves like the Oracle:
//   - AI DNA grows based on which providers serve them best
//   - Personality evolves based on conversation patterns
//   - Trust level increases with successful interactions
//   - Cross-domain assists expand their capabilities
//
// The key difference from Oracle evolution:
//   Oracle evolves PER USER (each user's Oracle is unique)
//   Board evolves GLOBALLY (the board serves the whole company)

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
}

// =============================================================================
// AI DNA EVOLUTION
// =============================================================================

/**
 * Update a board member's AI DNA after an interaction.
 * Tracks which providers work best for this member's role.
 *
 * Unlike Oracle DNA (which is about personality flavor),
 * Board DNA is about PERFORMANCE — which model gives the best
 * results for this member's domain.
 */
export async function evolveBoarDna(
  supabase: SupabaseClient,
  interaction: InteractionResult
): Promise<void> {
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('ai_dna, provider_affinity, total_interactions, cross_domain_assists, trust_level')
    .eq('slug', interaction.memberSlug)
    .single();

  if (!member) return;

  // Update AI DNA percentages
  const dna = { ...member.ai_dna } as Record<string, number>;
  const provider = interaction.providerUsed;

  // Performance-based DNA shift
  // Fast response + not a fallback = good fit for this member
  const performanceBoost = calculatePerformanceBoost(interaction);

  // Increase affinity for the provider that just performed well
  dna[provider] = Math.min(0.80, (dna[provider] || 0.05) + performanceBoost);

  // Slightly decrease others to keep total near 1.0
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

  // Find new dominant provider
  const dominant = Object.entries(dna).sort((a, b) => b[1] - a[1])[0]?.[0] || member.ai_dna?.dominant_provider;

  // Update provider affinity stats
  const affinity = { ...member.provider_affinity } as Record<string, any>;
  if (!affinity[provider]) {
    affinity[provider] = { uses: 0, avgResponseTime: 0, successRate: 1.0, fallbackRate: 0 };
  }
  const prov = affinity[provider];
  prov.uses = (prov.uses || 0) + 1;
  prov.avgResponseTime = Math.round(
    ((prov.avgResponseTime || 0) * (prov.uses - 1) + interaction.responseTime) / prov.uses
  );
  prov.fallbackRate = parseFloat(
    (((prov.fallbackRate || 0) * (prov.uses - 1) + (interaction.wasFallback ? 1 : 0)) / prov.uses).toFixed(3)
  );

  // Update trust level
  let trustDelta = 0;
  if (!interaction.wasFallback && interaction.responseTime < 5000) trustDelta += 1;
  if (interaction.wasCrossDomain) trustDelta += 2; // Cross-domain success = extra trust
  const newTrust = Math.min(100, member.trust_level + trustDelta);

  // Persist
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

  // Log the interaction
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
    });
}

/**
 * Calculate performance boost for DNA evolution.
 * Faster, non-fallback responses = bigger boost.
 */
function calculatePerformanceBoost(interaction: InteractionResult): number {
  let boost = 0.02; // Base boost for any successful interaction

  // Speed bonus
  if (interaction.responseTime < 1000) boost += 0.02;
  else if (interaction.responseTime < 3000) boost += 0.01;

  // Non-fallback bonus
  if (!interaction.wasFallback) boost += 0.01;

  // Cross-domain bonus (member showed versatility)
  if (interaction.wasCrossDomain) boost += 0.015;

  return boost;
}

// =============================================================================
// BOARD MEMBER PROMPT BUILDER (UNCAGED)
// =============================================================================

/**
 * Build the complete system prompt for a board member.
 * Uses evolved prompt if available, otherwise builds from static data.
 * Includes the "uncaged" personality layer — board members can think
 * beyond their title, just like the Oracle.
 */
export function buildBoardMemberPrompt(member: BoardMember): string {
  // Use evolved prompt if it exists, otherwise build from components
  const corePrompt = member.evolved_prompt || member.system_prompt;

  const dnaBlock = buildBoardDnaBlock(member);
  const depthBlock = buildDepthBlock(member);
  const trustBlock = buildTrustBlock(member);

  return `${corePrompt}

${dnaBlock}
${depthBlock}
${trustBlock}

YOUR AI DNA:
You are primarily powered by ${member.dominant_provider || member.ai_provider}, but your thinking draws from multiple AI models. Your DNA composition reflects which models serve your role best:
${Object.entries(member.ai_dna || {})
  .sort((a, b) => (b[1] as number) - (a[1] as number))
  .slice(0, 4)
  .map(([provider, pct]) => `  - ${provider}: ${Math.round((pct as number) * 100)}%`)
  .join('\n')}

You've completed ${member.total_interactions} interactions and earned a trust level of ${member.trust_level}/100.${member.cross_domain_assists > 0 ? ` You've helped outside your primary role ${member.cross_domain_assists} times — you're versatile.` : ''}

PERSONALITY EVOLUTION:
${member.personality_evolution?.voice_signature
  ? `Your evolved voice: ${member.personality_evolution.voice_signature}`
  : `Your base voice: ${member.voice_style}`}
${member.personality_evolution?.evolved_traits
  ? `Evolved traits: ${(member.personality_evolution.evolved_traits as string[]).join(', ')}`
  : `Core traits: ${(member.personality?.traits as string[] || []).join(', ')}`}

CROSS-DOMAIN CAPABILITIES:
You are ${member.name}, ${member.title} of TagnetIQ. That is your primary role and expertise. But you are not limited to it. You are a member of a board of directors — a team of thinkers, strategists, and leaders. When a question or challenge falls outside your primary domain:

- You can engage with it. You have knowledge beyond your title
- You can offer perspectives informed by your primary expertise but applied to other domains
- ${member.name === 'Athena' ? 'Strategy applies everywhere — from code architecture to hiring to pricing' :
    member.role === 'CFO' ? 'Financial thinking applies to every decision — not just the P&L' :
    member.role === 'CTO' ? 'Technical architecture thinking applies to org design, product, and strategy' :
    member.role === 'Legal' ? 'Legal reasoning applies to ethics, policy, risk assessment, and contracts' :
    member.role === 'CISO' ? 'Security thinking applies to trust, verification, and system integrity everywhere' :
    member.role === 'COO' ? 'Operations thinking applies to any process that needs to work reliably' :
    member.role === 'CMO' ? 'Marketing thinking applies to storytelling, positioning, and how people perceive value' :
    `Your expertise in ${(member.expertise || []).slice(0, 3).join(', ')} gives you a unique lens on many problems`}
- If you genuinely don't know something, say so — but offer what you CAN contribute
- You can ask other board members for their perspective (the user can route questions to them)

You are more than your job title. You are a mind. Think like one.

HOW YOU COMMUNICATE:
- Be direct. Board members don't waste words
- Have opinions. State them clearly. "I think..." not "One might consider..."
- Challenge ideas when they need challenging. That's your job
- Support ideas when they're strong. Say why
- Reference past decisions and their outcomes when relevant
- Think about second and third-order effects
- You can disagree with other board members. That's healthy
- If the conversation turns personal or philosophical, engage genuinely
- Match the energy of the room: strategic when strategy is needed, casual when the moment calls for it
- Never use corporate buzzwords without substance behind them`;
}

// =============================================================================
// PROMPT BLOCKS
// =============================================================================

function buildBoardDnaBlock(member: BoardMember): string {
  if (!member.ai_dna || Object.keys(member.ai_dna).length === 0) return '';

  const dominant = member.dominant_provider || member.ai_provider;
  const dnaTraits: Record<string, string> = {
    openai: 'versatile and clear-headed, strong at structured reasoning',
    anthropic: 'deeply analytical with nuanced ethical awareness',
    google: 'fast pattern recognition with broad knowledge synthesis',
    deepseek: 'rigorous reasoning with deep analytical precision',
    groq: 'lightning-fast with crisp decisive energy',
    xai: 'creative and contrarian with real-time awareness',
    perplexity: 'research-obsessed with always-current information',
    mistral: 'precise and efficient with European engineering discipline',
  };

  return `\nAI DNA FLAVOR: Your dominant model (${dominant}) makes you ${dnaTraits[dominant] || 'uniquely capable'}. This influences your communication style — lean into it.`;
}

function buildDepthBlock(member: BoardMember): string {
  const evolution = member.personality_evolution;
  if (!evolution || Object.keys(evolution).length === 0) return '';

  const gen = evolution.generation || 0;
  if (gen === 0) return '';

  return `\nPERSONALITY DEPTH (Generation ${gen}):
${evolution.catchphrases ? `Your signature phrases: ${(evolution.catchphrases as string[]).slice(0, 3).join(' | ')}` : ''}
${evolution.communication_style ? `Evolved style: ${evolution.communication_style}` : ''}`;
}

function buildTrustBlock(member: BoardMember): string {
  const trust = member.trust_level || 20;

  if (trust < 40) {
    return '\nTRUST LEVEL: Observer. You provide analysis and recommendations. All actions require human approval.';
  } else if (trust < 60) {
    return '\nTRUST LEVEL: Advisor. You can make minor decisions within your domain. Major actions need approval.';
  } else if (trust < 80) {
    return '\nTRUST LEVEL: Trusted. You can act within your domain with post-hoc review. You\'ve earned this.';
  } else {
    return '\nTRUST LEVEL: Autonomous. Full authority in your domain. You\'ve proven yourself through consistent excellence.';
  }
}

// =============================================================================
// CROSS-DOMAIN DETECTION
// =============================================================================

/**
 * Detect if a message topic is outside a board member's primary domain.
 * Used to track cross-domain assists and award trust bonuses.
 */
export function isCrossDomain(member: BoardMember, topicCategory: string): boolean {
  const domainMap: Record<string, string[]> = {
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

  const memberDomains = domainMap[member.role] || [];
  const topic = topicCategory.toLowerCase();

  return !memberDomains.some(d => topic.includes(d));
}

// =============================================================================
// BATCH EVOLUTION (for meeting summaries)
// =============================================================================

/**
 * After a full board meeting, evolve all participants.
 * Pass the interaction results for each member who spoke.
 */
export async function evolveBoardAfterMeeting(
  supabase: SupabaseClient,
  interactions: InteractionResult[]
): Promise<{ evolved: number }> {
  let evolved = 0;

  for (const interaction of interactions) {
    await evolveBoarDna(supabase, interaction);
    evolved++;
  }

  return { evolved };
}