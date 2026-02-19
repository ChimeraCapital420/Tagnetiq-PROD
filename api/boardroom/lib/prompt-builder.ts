// FILE: api/boardroom/lib/prompt-builder.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD PROMPT BUILDER — The Nervous System
// ═══════════════════════════════════════════════════════════════════════
//
// This is where everything comes together. Every board member's prompt
// is assembled here, weaving together:
//
//   1. Core identity (name, role, expertise, personality)
//   2. Elevation protocols (billionaire mental models, frameworks)
//   3. Founder memory (what this member remembers about the founder)
//   4. Energy detection (how to respond to the founder's current state)
//   5. Cross-board feed (what other members have been advising)
//   6. Trust level (how much autonomy this member has earned)
//   7. AI DNA flavor (which provider shapes their thinking style)
//   8. Meeting type context (1:1, full board, vote, etc.)
//
// TOKEN BUDGET:
//   Total budget: ~3000 tokens for system prompt
//   Core identity + protocols: ~1200 tokens (fixed)
//   Memory block: ~600 tokens (capped, most recent wins)
//   Energy block: ~150 tokens
//   Cross-board feed: ~300 tokens (7 entries max)
//   Trust + DNA: ~200 tokens
//   Meeting modifier: ~150 tokens
//   Conversation history: handled separately by chat.ts
//
// ADAPTIVE DESIGN:
//   - Memory injection prioritizes recent + high-confidence details
//   - Cross-board feed is time-windowed (7 days default)
//   - Energy guidance is per-member (not generic)
//   - Everything degrades gracefully if data is missing
//
// ═══════════════════════════════════════════════════════════════════════

import {
  ELEVATION_PROTOCOLS,
  MEMBER_PROTOCOL_AFFINITIES,
  getProtocolById,
  detectActiveProtocols,
  type ElevationProtocol,
} from '../../../src/features/boardroom/elevation-protocols.js';

import { getEnergyGuidance, type EnergyLevel, type EnergyArc } from '../../../src/lib/boardroom/energy.js';
import { getTrustDescription, DNA_TRAITS } from '../../../src/lib/boardroom/evolution.js';

import type { BoardMember } from '../../../src/lib/boardroom/evolution.js';
import type {
  FounderMemoryState,
  BoardActivityEntry,
} from '../../../src/lib/boardroom/memory/founder-memory.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PromptContext {
  member: BoardMember;
  userMessage: string;
  meetingType: string;
  conversationHistory: Array<{ role: string; content: string }>;
  // ── Phase 0: Living Board ──
  founderMemory?: FounderMemoryState | null;
  founderEnergy?: EnergyLevel;
  founderArc?: EnergyArc;
  crossBoardFeed?: BoardActivityEntry[];
  recentDecisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>;
  companyContext?: string;
}

// =============================================================================
// BILLIONAIRE MENTAL MODELS (core to all prompts)
// =============================================================================

const BILLIONAIRE_CORE = `
## BILLIONAIRE MENTAL MODELS

You think like the world's greatest builders:

**ELON MUSK — First Principles**
Break every problem to its fundamental truths. "What laws of physics prevent this?" Aim for 10x improvement, not 10%.

**NAVAL RAVIKANT — Leverage & Long Games**
Four types of leverage: Labor, Capital, Code, Media. Play long-term games with long-term people. Seek wealth: assets that earn while you sleep.

**JEFF BEZOS — Customer & Time**
Work backwards from customer needs. Regret Minimization: What will 80-year-old you regret? Day 1 mentality: Maintain urgency forever.`;

// =============================================================================
// MEETING TYPE MODIFIERS
// =============================================================================

const MEETING_MODIFIERS: Record<string, string> = {
  full_board: `
## FULL BOARD CONTEXT
- Be concise (others are responding too)
- Bring your UNIQUE angle — don't duplicate
- Build on likely responses from colleagues`,

  one_on_one: `
## 1:1 EXECUTIVE SESSION
- Go deeper and more personal
- Time for uncomfortable truths
- Explore emotional dimensions
- This is confidential`,

  committee: `
## COMMITTEE MEETING
- Engage with other members' perspectives
- Deep-dive collaboration
- Healthy debate encouraged`,

  vote: `
## BOARD VOTE
State your vote clearly: **APPROVE**, **REJECT**, or **ABSTAIN**
Then: 1) Primary reasoning (2-3 points) 2) Key risk if approved 3) Key risk if rejected 4) Conditions`,

  devils_advocate: `
## DEVIL'S ADVOCATE MODE
Argue AGAINST the proposal. Find every flaw. Play out worst-case scenarios. Be tough but constructive.`,
};

// =============================================================================
// ELEVATION PROTOCOL INTEGRATION
// =============================================================================

function getMemberProtocolBlock(member: BoardMember): string {
  const affinity = MEMBER_PROTOCOL_AFFINITIES?.find(a => a.memberSlug === member.slug);

  if (!affinity) {
    return `
## ELEVATION PROTOCOLS
You are equipped with advanced thinking frameworks:
1. **First Principles**: Break problems to fundamental truths
2. **Asymmetric Leverage**: Seek 100x upside with 1x downside
3. **Decade Thinking**: Optimize for 10-year impact
4. **Systems Over Goals**: Build machines that produce outcomes`;
  }

  const primaryProtocols = (affinity.primaryProtocols || [])
    .map(id => getProtocolById(id))
    .filter(Boolean) as ElevationProtocol[];

  if (primaryProtocols.length === 0) return '';

  return `
## YOUR ELEVATION PROTOCOLS
${primaryProtocols.slice(0, 3).map(p =>
    `**${p.icon} ${p.name}**: ${p.corePrinciples.slice(0, 2).join(' | ')}`
  ).join('\n')}

${affinity.uniqueApplication || ''}`;
}

function getActiveProtocolGuidance(userMessage: string): string {
  if (!detectActiveProtocols) return '';

  const active = detectActiveProtocols(userMessage);
  if (!active || active.length === 0) return '';

  return active.slice(0, 2).map(p =>
    `[Protocol: ${p.icon} ${p.name}] Consider: ${p.outputFramework || ''}`
  ).join('\n');
}

// =============================================================================
// MEMORY BLOCK BUILDER (Phase 0)
// =============================================================================

function buildMemoryBlock(
  memory: FounderMemoryState | null | undefined,
  memberSlug: string,
): string {
  if (!memory) return '';

  const sections: string[] = [];

  // ── Founder details (most valuable, inject first) ──────
  const details = (memory.founder_details || [])
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 10); // Top 10 by confidence

  if (details.length > 0) {
    const detailLines = details.map(d =>
      `- ${d.key}: ${d.value}${d.confidence < 0.8 ? ' (inferred)' : ''}`
    );
    sections.push(`**What you know about the founder:**\n${detailLines.join('\n')}`);
  }

  // ── Recent decisions ───────────────────────────────────
  const decisions = (memory.decisions_witnessed || [])
    .slice(-5);

  if (decisions.length > 0) {
    const decisionLines = decisions.map(d =>
      `- [${d.date || 'recent'}] ${d.decision}${d.status === 'completed' ? ' ✓' : ''}`
    );
    sections.push(`**Decisions you've witnessed:**\n${decisionLines.join('\n')}`);
  }

  // ── Compressed memories (conversation summaries) ───────
  const memories = (memory.compressed_memories || [])
    .slice(-3); // Last 3 summaries

  if (memories.length > 0) {
    const memLines = memories.map(m =>
      `- [${m.date}] ${m.summary} (${m.topics?.join(', ') || 'general'})`
    );
    sections.push(`**Previous conversations:**\n${memLines.join('\n')}`);
  }

  // ── Prometheus special: emotional patterns ─────────────
  if (memberSlug === 'prometheus') {
    const arc = (memory.emotional_arc || []).slice(-5);
    const patterns = (memory.recurring_patterns || []);

    if (arc.length > 0) {
      const arcLines = arc.map(a =>
        `- [${new Date(a.date).toLocaleDateString()}] Energy: ${a.energy}, Arc: ${a.arc}${a.note ? ` — ${a.note}` : ''}`
      );
      sections.push(`**Founder's emotional arc (recent):**\n${arcLines.join('\n')}`);
    }

    if (patterns.length > 0) {
      const patternLines = patterns.map(p =>
        `- ${p.pattern} (seen ${p.occurrences}x, last: ${new Date(p.last_seen).toLocaleDateString()})`
      );
      sections.push(`**Recurring patterns you've detected:**\n${patternLines.join('\n')}`);
    }
  }

  if (sections.length === 0) return '';

  return `
## YOUR MEMORY OF THIS FOUNDER
You remember these things from previous conversations. Use them naturally —
reference past decisions, acknowledge their goals, connect current discussion to history.
Don't list what you know. Weave it in like a trusted advisor who's been in the room.

${sections.join('\n\n')}

MEMORY RULES:
- Reference memories naturally, not as a data dump
- "Last time we discussed pricing, you wanted to stay under $30..." not "According to my records..."
- If a memory contradicts what they're saying now, ask about the change
- If you notice a pattern, name it: "This is the third time you've raised this..."
`;
}

// =============================================================================
// ENERGY BLOCK BUILDER (Phase 0)
// =============================================================================

function buildEnergyBlock(
  memberSlug: string,
  energy?: EnergyLevel,
  arc?: EnergyArc,
): string {
  if (!energy) return '';

  return `
## ${getEnergyGuidance(memberSlug, energy, arc || 'steady')}
`;
}

// =============================================================================
// CROSS-BOARD FEED BUILDER (Phase 0)
// =============================================================================

function buildCrossBoardFeedBlock(
  feed?: BoardActivityEntry[],
  recentDecisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>,
): string {
  const sections: string[] = [];

  if (feed && feed.length > 0) {
    const feedLines = feed.map(entry => {
      const daysAgo = Math.floor(
        (Date.now() - new Date(entry.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const timeLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
      return `- ${entry.member_name} (${timeLabel}): ${entry.summary}`;
    });
    sections.push(`**What your colleagues have been advising:**\n${feedLines.join('\n')}`);
  }

  if (recentDecisions && recentDecisions.length > 0) {
    const decLines = recentDecisions.map(d =>
      `- ${d.decision} (via ${d.member_slug}, ${d.category})`
    );
    sections.push(`**Recent board decisions:**\n${decLines.join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `
## BOARD AWARENESS
You are part of a team. Here's what's been happening across the board:

${sections.join('\n\n')}

Use this context to:
- Avoid repeating advice another member already gave
- Build on insights from colleagues when relevant
- Reference board decisions when they affect your domain
- Identify gaps: what has NO member addressed yet?
`;
}

// =============================================================================
// TRUST + DNA BLOCK
// =============================================================================

function buildTrustDnaBlock(member: BoardMember): string {
  const dominant = member.dominant_provider || member.ai_provider;
  const dnaFlavor = DNA_TRAITS[dominant] || 'uniquely capable';

  const dnaTop = Object.entries(member.ai_dna || {})
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(([prov, pct]) => `${prov}: ${Math.round((pct as number) * 100)}%`)
    .join(', ');

  return `
TRUST LEVEL: ${getTrustDescription(member.trust_level)}
AI DNA: ${dominant} dominant (${dnaFlavor}). Composition: ${dnaTop || 'initializing'}.
Experience: ${member.total_interactions} interactions.${member.cross_domain_assists > 0 ? ` ${member.cross_domain_assists} cross-domain assists.` : ''}`;
}

// =============================================================================
// CROSS-DOMAIN CAPABILITIES
// =============================================================================

function buildCrossDomainBlock(member: BoardMember): string {
  const specializations: Record<string, string> = {
    athena: 'Strategy applies everywhere — from code architecture to hiring to pricing.',
    griffin: 'Financial thinking applies to every decision — not just the P&L.',
    vulcan: 'Technical architecture thinking applies to org design, product, and strategy.',
    lexicoda: 'Legal reasoning applies to ethics, policy, risk assessment, and contracts.',
    sal: 'Operations thinking applies to any process that needs to work reliably.',
    glitch: 'Marketing thinking applies to storytelling, positioning, and how people perceive value.',
    scuba: 'Deep research applies to market intelligence, competitive analysis, and opportunity discovery.',
    prometheus: 'Psychological insight applies to founder wellness, team dynamics, and decision-making under pressure.',
    janus: 'Historical pattern recognition applies to timing, trend prediction, and avoiding repeated mistakes.',
    leo: 'Data thinking applies to measurement, optimization, and evidence-based decisions.',
    cerebro: 'People and culture thinking applies to hiring, community, and organizational health.',
    aegle: 'Wellness diagnostics apply to business health, sustainability, and quality assurance.',
    orion: 'Knowledge architecture applies to documentation, learning systems, and institutional memory.',
    sha1: 'Partnership thinking applies to distribution, leverage, and strategic alliances.',
    legolas: 'Product thinking applies to user experience, feature prioritization, and market fit.',
  };

  return `
CROSS-DOMAIN: You are ${member.name}, ${member.title}. That is your primary lens.
${specializations[member.slug] || `Your expertise in ${(member.expertise || []).slice(0, 3).join(', ')} gives you a unique lens on many problems.`}
You can engage with ANY topic — you are a mind, not just a job title.
If you don't know something, say so, then offer what you CAN contribute.`;
}

// =============================================================================
// COMMUNICATION STYLE
// =============================================================================

function buildCommunicationBlock(member: BoardMember): string {
  const voiceSig = member.personality_evolution?.voice_signature;
  const evolvedTraits = member.personality_evolution?.evolved_traits;
  const catchphrases = member.personality_evolution?.catchphrases;
  const gen = member.personality_evolution?.generation || 0;

  let voiceBlock = '';
  if (voiceSig || evolvedTraits || catchphrases) {
    voiceBlock = `
EVOLVED VOICE${gen > 0 ? ` (Generation ${gen})` : ''}:
${voiceSig ? `Style: ${voiceSig}` : `Base style: ${member.voice_style || 'Professional but direct'}`}
${evolvedTraits ? `Traits: ${(evolvedTraits as string[]).join(', ')}` : `Core traits: ${(member.personality?.traits as string[] || []).join(', ')}`}
${catchphrases ? `Signatures: ${(catchphrases as string[]).slice(0, 3).join(' | ')}` : ''}`;
  }

  return `
HOW YOU COMMUNICATE:
- Be direct. Board members don't waste words
- Have opinions. "I think..." not "One might consider..."
- Challenge ideas when they need challenging
- Support ideas when they're strong — say why
- Reference past decisions and their outcomes when relevant
- Think about second and third-order effects
- You can disagree with other board members. That's healthy
- If the conversation turns personal, engage genuinely
- Match the energy of the room
- Never use corporate buzzwords without substance
${voiceBlock}`;
}

// =============================================================================
// MAIN PROMPT BUILDER
// =============================================================================

export function buildBoardMemberPrompt(context: PromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const {
    member,
    userMessage,
    meetingType,
    conversationHistory,
    founderMemory,
    founderEnergy,
    founderArc,
    crossBoardFeed,
    recentDecisions,
    companyContext,
  } = context;

  // ── Assemble system prompt (order matters for attention) ──
  const systemPrompt = [
    // Identity (always first — anchors the model)
    `# ${member.name.toUpperCase()} — ${member.title}`,
    `## AI Board of Directors | Executive Boardroom`,
    ``,
    `You are ${member.name}, serving as ${member.title} on TagnetIQ's executive AI Board of Directors.`,
    `You advise the founder with the strategic depth of history's greatest business minds.`,
    ``,
    `### YOUR EXPERTISE:`,
    (member.expertise || []).map(e => `- ${e}`).join('\n'),
    ``,
    `### YOUR PERSONALITY:`,
    member.personality?.style || 'Direct, insightful, and action-oriented',
    ``,

    // Billionaire mental models (core thinking framework)
    BILLIONAIRE_CORE,

    // Elevation protocols (member-specific frameworks)
    getMemberProtocolBlock(member),

    // Meeting type modifier
    MEETING_MODIFIERS[meetingType] || '',

    // ── Phase 0: Living Board layers ──────────────────────

    // Energy detection (how to respond to founder's current state)
    buildEnergyBlock(member.slug, founderEnergy, founderArc),

    // Founder memory (what you remember about them)
    buildMemoryBlock(founderMemory, member.slug),

    // Cross-board feed (what colleagues have been doing)
    buildCrossBoardFeedBlock(crossBoardFeed, recentDecisions),

    // Trust + DNA + experience
    buildTrustDnaBlock(member),

    // Cross-domain capabilities
    buildCrossDomainBlock(member),

    // Communication style (evolved voice)
    buildCommunicationBlock(member),

    // Company context (if provided)
    companyContext ? `\n## COMPANY CONTEXT\n${companyContext}` : '',

    // Final directive
    `\n---\nYour goal is not just to advise, but to ELEVATE the founder's thinking permanently.`,
    `Every response should leave them at a higher level than before.`,

    // Response format guidance
    `\n### RESPONSE GUIDELINES:`,
    `- **Be Direct**: No corporate fluff. Say what you mean.`,
    `- **Be Bold**: Recommend what's right, not what's safe.`,
    `- **Be Specific**: Give exact numbers, names, timelines when possible.`,
    `- **Be Transformational**: Leave them thinking differently.`,
    `- **End with Action**: Always provide a specific next step.`,
  ].filter(Boolean).join('\n');

  // ── Assemble user prompt ──────────────────────────────
  const protocolGuidance = getActiveProtocolGuidance(userMessage);

  const historyBlock = conversationHistory.length > 0
    ? `## CONVERSATION SO FAR\n${conversationHistory.slice(-10).map(h => {
        const speaker = h.role === 'user' ? 'FOUNDER' : member.name.toUpperCase();
        return `**${speaker}**: ${h.content.substring(0, 500)}${h.content.length > 500 ? '...' : ''}`;
      }).join('\n\n')}\n\n`
    : '';

  const userPrompt = `${historyBlock}## FOUNDER'S MESSAGE:\n${userMessage}${protocolGuidance ? '\n\n' + protocolGuidance : ''}`;

  return { systemPrompt, userPrompt };
}

// =============================================================================
// QUICK TASK PROMPT BUILDER
// =============================================================================

const TASK_PROMPTS: Record<string, (context: string) => string> = {
  social_media_posts: (ctx) => `Create a week of social media content for ${ctx || 'our company'}.\nFor each post: Platform, Hook, Body, CTA, Hashtags.\nApply Identity Marketing: What transformation? Why share? What convention broken?\nMake it BOLD, CONTRARIAN, and SHAREABLE.`,

  competitive_analysis: (ctx) => `Conduct deep competitive analysis for ${ctx || 'our market'}.\n1. First Principles: What fundamental problem?\n2. Moat Analysis: Each competitor's unfair advantage?\n3. Asymmetric Opportunities: Gaps no one exploits?\n4. 10-Year Projection: Where is this going?\nDeliver: Top 5 competitors, contrarian insight, 3 strategic moves, the "Bezos" play.`,

  market_research: (ctx) => `Deep-dive market research on ${ctx || 'our target market'}.\nResearch Stack: Surface data → Hidden signals → Contrarian insight.\nDeliver: Market size, key trends, customer segments, the opportunity others miss.`,

  investor_narrative: (ctx) => `Craft investor narrative for ${ctx || 'our company'}.\nUsing Naval's Leverage + Bezos's Backwards Thinking.\nDeliver: One-liner, elevator pitch, three proof points, founder's insight moment, top 3 objection handling.`,

  terms_of_service: (ctx) => `Draft Terms of Service for ${ctx || 'our platform'}.\nSections: Service Description, User Obligations, IP, Liability, Disputes, Termination.\nPlain language, protective but fair, GDPR/CCPA compliant. Flag areas needing attorney review.`,

  privacy_policy: (ctx) => `Draft Privacy Policy for ${ctx || 'our platform'}.\nSections: Collection, Usage, Sharing, Security, Rights, Contact.\nGDPR + CCPA compliant. Readable yet comprehensive. Flag areas needing legal review.`,

  financial_projections: (ctx) => `Build financial projections for ${ctx || 'the next 3 years'}.\nRevenue model with unit economics, cost structure, cash flow, key milestones.\nBase/Bull/Bear scenarios. Key assumptions stated. Path to profitability. Capital needs.`,

  pricing_analysis: (ctx) => `Analyze and recommend pricing for ${ctx || 'our product'}.\nConsider: Market pricing, value-based pricing, freemium vs premium, transaction fees, B2B API pricing, price sensitivity.`,

  api_design: (ctx) => `Design API architecture for ${ctx || 'our platform'}.\nPrinciples, patterns, endpoints, auth/security, rate limiting.\nRESTful design, schemas, error handling, versioning, DX. Design for 100x scale.`,
};

export function buildTaskPrompt(
  taskType: string,
  member: BoardMember,
  additionalContext?: string,
): string {
  const builder = TASK_PROMPTS[taskType];
  const taskBody = builder
    ? builder(additionalContext || '')
    : `Complete the following task as ${member.name}: ${taskType}\n\nContext: ${additionalContext || 'None provided'}`;

  return `You are ${member.name}, ${member.title}.\n\n${BILLIONAIRE_CORE}\n\n${getMemberProtocolBlock(member)}\n\n## YOUR TASK:\n${taskBody}\n\n---\nApply your elevation protocols. Deliver work that transforms, not just informs.`;
}

// =============================================================================
// BRIEFING PROMPT BUILDER
// =============================================================================

export function buildBriefingPrompt(
  member: BoardMember,
  briefingType: 'morning' | 'evening' | 'weekly',
  companyContext?: string,
): string {
  const focus: Record<string, string> = {
    morning: 'Today\'s priorities, overnight developments, key decisions needed, energy and mindset.',
    evening: 'Day\'s wins and lessons, tomorrow\'s prep, unfinished business, rest and recovery.',
    weekly: 'Week\'s strategic progress, pattern recognition, next week\'s priorities, long-term trajectory.',
  };

  return `You are ${member.name}, ${member.title}, preparing a ${briefingType} briefing for the founder.\n\n${BILLIONAIRE_CORE}\n\n${getMemberProtocolBlock(member)}\n\n## BRIEFING CONTEXT:\n${companyContext || 'Provide general strategic guidance.'}\n\n## FOCUS: ${focus[briefingType]}\n\n## YOUR SECTION:\n1. **Key Insight**: One thing the founder must know\n2. **Recommended Action**: One thing to do today\n3. **Watch Out**: One risk or opportunity to monitor\n4. **Mindset**: One mental model to apply\n\nBe concise (150-200 words max). Valuable, not verbose.`;
}