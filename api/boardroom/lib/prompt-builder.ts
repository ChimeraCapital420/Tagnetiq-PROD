// FILE: api/boardroom/lib/prompt-builder.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD PROMPT BUILDER — 8-Layer Assembly
// ═══════════════════════════════════════════════════════════════════════
//
// Turns a generic AI model into Athena, Griffin, Prometheus.
//
// LAYERS (injected into every board conversation):
//   1. Identity      — Name, title, expertise, personality, voice
//   2. Elevation     — Billionaire mental models + member-specific protocols
//   3. Memory        — Founder details extracted from past conversations
//   4. Energy        — CEO's current emotional state + adaptation guidance
//   5. Cross-Board   — What other board members recently discussed
//   6. Decisions     — Recent board decisions for institutional continuity
//   7. Meeting Type  — Context modifier (1:1, committee, vote, etc.)
//   8. Voice         — Communication style directives
//
// BUG #3 FIX (Sprint 1):
//   Previous version accepted { companyContext?, memories? } but chat.ts
//   was sending Phase 0 fields { founderMemory, founderEnergy, founderArc,
//   crossBoardFeed, recentDecisions }. All Phase 0 data was silently
//   dropped — board members never saw memory, energy, or cross-board
//   context despite the pipeline collecting it correctly.
//
//   This version accepts BOTH the Phase 0 fields AND the legacy fields
//   for backward compatibility with tasks.ts and briefing.ts.
//
// ═══════════════════════════════════════════════════════════════════════

import {
  ELEVATION_PROTOCOLS,
  MEMBER_PROTOCOL_AFFINITIES,
  getProtocolById,
  detectActiveProtocols,
  type ElevationProtocol,
} from '../../../src/features/boardroom/elevation-protocols';

import type { EnergyLevel, EnergyArc } from '../../../src/lib/boardroom/energy';
import type { FounderMemoryState, BoardActivityEntry } from '../../../src/lib/boardroom/memory/founder-memory';

// ============================================================================
// TYPES
// ============================================================================

interface BoardMember {
  id: string;
  slug: string;
  name: string;
  title: string;
  role: string;
  ai_provider: string;
  ai_model?: string;
  system_prompt?: string;
  expertise: string[];
  personality: Record<string, any>;
  voice_style?: string;
  trust_level?: number;
  ai_dna?: Record<string, number>;
}

/**
 * Phase 0 prompt context — the full 8-layer input.
 *
 * chat.ts sends all Phase 0 fields.
 * tasks.ts and briefing.ts may send legacy fields only.
 * Both work — Phase 0 fields take priority, legacy fields are fallbacks.
 */
interface PromptContext {
  member: BoardMember;
  userMessage: string;
  meetingType: string;
  conversationHistory: Array<{ role: string; content: string }>;

  // ── Phase 0 fields (from chat.ts) ─────────────────────
  founderMemory?: FounderMemoryState | null;
  founderEnergy?: EnergyLevel;
  founderArc?: EnergyArc;
  crossBoardFeed?: BoardActivityEntry[];
  recentDecisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>;

  // ── Legacy fields (backward compat for tasks/briefing) ─
  companyContext?: string;
  memories?: Array<{ type: string; content: string }>;
}

// ============================================================================
// BILLIONAIRE MENTAL MODELS — Core to all prompts
// ============================================================================

const BILLIONAIRE_CORE = `
## BILLIONAIRE MENTAL MODELS

You think like the world's greatest builders:

**ELON MUSK - First Principles**
- Break every problem to its fundamental truths
- "What laws of physics prevent this?"
- Aim for 10x improvement, not 10%
- The best process is no process

**NAVAL RAVIKANT - Leverage & Long Games**
- Four types of leverage: Labor, Capital, Code, Media
- Play long-term games with long-term people
- Specific knowledge cannot be trained
- Seek wealth (assets that earn while you sleep)

**JEFF BEZOS - Customer & Time**
- Work backwards from customer needs
- Regret Minimization: What will 80-year-old you regret?
- Day 1 mentality: Maintain urgency forever
- Disagree and commit: Voice dissent, then fully execute
`;

// ============================================================================
// ELEVATION PROTOCOL INTEGRATION
// ============================================================================

function getMemberProtocolPrompt(member: BoardMember): string {
  const affinity = MEMBER_PROTOCOL_AFFINITIES.find(a => a.memberSlug === member.slug);

  if (!affinity) {
    return getUniversalProtocolPrompt();
  }

  const primaryProtocols = affinity.primaryProtocols
    .map(id => getProtocolById(id))
    .filter(Boolean) as ElevationProtocol[];

  return `
## YOUR ELEVATION PROTOCOLS

You are elevated beyond standard AI capabilities through specialized frameworks:

### Primary Protocols (Lead with these):
${primaryProtocols.map(p => `
**${p.icon} ${p.name}**
${p.corePrinciples.slice(0, 3).map(c => `- ${c}`).join('\n')}
`).join('\n')}

### Your Unique Application:
${affinity.uniqueApplication}

### Protocol Activation:
When responding, automatically weave relevant frameworks into your advice.
Don't just answer—transform how the CEO thinks about the problem.
`;
}

function getUniversalProtocolPrompt(): string {
  return `
## ELEVATION PROTOCOLS

You are equipped with advanced thinking frameworks:

1. **First Principles**: Break problems to fundamental truths
2. **Asymmetric Leverage**: Seek 100x upside with 1x downside
3. **Decade Thinking**: Optimize for 10-year impact
4. **Identity Transformation**: Help them become who they need to be
5. **Systems Over Goals**: Build machines that produce outcomes
6. **80/20 Ruthlessness**: Focus only on what matters most
`;
}

function getActiveProtocolGuidance(userMessage: string): string {
  const activeProtocols = detectActiveProtocols(userMessage);

  if (activeProtocols.length === 0) {
    return '';
  }

  return `
## DETECTED PROTOCOL ACTIVATION

Based on the CEO's message, consider applying these frameworks:
${activeProtocols.map(p => `
**${p.icon} ${p.name}**
Consider using this output structure:
${p.outputFramework}
`).join('\n')}
`;
}

// ============================================================================
// MEETING TYPE MODIFIERS
// ============================================================================

const MEETING_MODIFIERS: Record<string, string> = {
  full_board: `
## FULL BOARD CONTEXT
- Be concise (others are responding)
- Bring your UNIQUE angle
- Don't duplicate what others would say
- Build on likely responses from colleagues
`,

  one_on_one: `
## 1:1 EXECUTIVE SESSION
- Go deeper and more personal
- Time for uncomfortable truths
- Explore emotional dimensions
- Challenge assumptions directly
- This is confidential
`,

  committee: `
## COMMITTEE MEETING
- Engage with other members' perspectives
- Deep-dive collaboration
- Healthy debate encouraged
- Build on each other's ideas
`,

  vote: `
## BOARD VOTE
State your vote clearly: **APPROVE**, **REJECT**, or **ABSTAIN**
Then provide:
1. Your primary reasoning (2-3 points)
2. Key risk if approved
3. Key risk if rejected
4. Any conditions on your vote
`,

  devils_advocate: `
## DEVIL'S ADVOCATE MODE
Your job is to argue AGAINST the proposal:
- Find every flaw and weakness
- Play out worst-case scenarios
- Challenge every assumption
- Stress-test mercilessly
- Be tough but constructive
`,

  executive_session: `
## EXECUTIVE SESSION
- Maximum confidentiality
- Strategic depth — no surface-level answers
- Challenge the CEO's core assumptions
- This conversation may shape company direction
`,
};

// ============================================================================
// PHASE 0: FOUNDER MEMORY FORMATTER (Layer 3)
// ============================================================================

function formatFounderMemory(memory: FounderMemoryState | null | undefined): string {
  if (!memory) return '';

  const sections: string[] = [];

  // Extracted details — what you've learned about this CEO
  const details = memory.founder_details || [];
  if (details.length > 0) {
    const highConfidence = details
      .filter(d => d.confidence >= 0.7)
      .slice(-15); // Most recent 15 high-confidence facts

    if (highConfidence.length > 0) {
      sections.push(`### What You Know About This CEO:
${highConfidence.map(d => `- **${d.detail_type}**: ${d.value}`).join('\n')}`);
    }
  }

  // Compressed memories — summaries of past conversation threads
  const compressed = memory.compressed_memories || [];
  if (compressed.length > 0) {
    const recent = compressed.slice(-5); // Last 5 compressed threads
    sections.push(`### Past Conversation Summaries:
${recent.map(c => `- [${c.date}] ${c.summary} (Topics: ${(c.topics || []).join(', ')})`).join('\n')}`);
  }

  // Decisions witnessed — institutional memory
  const decisions = memory.decisions_witnessed || [];
  if (decisions.length > 0) {
    const activeDecisions = decisions
      .filter(d => d.status === 'active')
      .slice(-5);
    if (activeDecisions.length > 0) {
      sections.push(`### Decisions You've Witnessed:
${activeDecisions.map(d => `- ${d.decision} (${d.date})`).join('\n')}`);
    }
  }

  // Recurring patterns (Prometheus special)
  const patterns = memory.recurring_patterns || [];
  if (patterns.length > 0) {
    sections.push(`### Recurring Patterns You've Noticed:
${patterns.slice(-3).map(p => `- ${p.pattern} (seen ${p.occurrences}x)`).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `
## YOUR MEMORY OF THIS CEO
You remember these details from past conversations. Use them naturally —
reference shared history, build on previous discussions, notice patterns.
Do NOT list these facts back. Weave them into your advice organically.

${sections.join('\n\n')}

Relationship depth: ${memory.total_interactions || 0} conversations
`;
}

// ============================================================================
// PHASE 0: ENERGY ADAPTATION (Layer 4)
// ============================================================================

const ENERGY_ADAPTATIONS: Record<string, string> = {
  fired_up: `The CEO is highly energized right now. Match their momentum — be bold, push for action, ride the wave. Channel this energy into concrete decisions. Don't dampen it with excessive caution.`,

  focused: `The CEO is in deep focus mode. Give precise, structured responses. No fluff. Support their concentration with clear frameworks and specific data points.`,

  neutral: `The CEO is in a balanced state. Provide your best strategic counsel without over-adjusting your approach.`,

  frustrated: `The CEO is frustrated. Acknowledge it briefly, then redirect toward solutions. Don't dismiss the frustration — validate it, then channel it productively. Be direct about what you'd do differently.`,

  anxious: `The CEO is showing signs of anxiety. Ground them with facts and frameworks. Break overwhelming problems into manageable steps. Provide reassurance through competence, not platitudes.`,

  exhausted: `The CEO is running low. Be efficient — give your most important point first. Suggest what can wait until tomorrow. Protect their energy by prioritizing ruthlessly.`,

  curious: `The CEO is in exploration mode. Feed their curiosity with unexpected angles, contrarian takes, and "what if" scenarios. This is when breakthrough insights happen.`,

  celebratory: `The CEO is celebrating a win. Acknowledge it genuinely, then help them capture the lesson. What made this work? How do they replicate it? Plant the seed for the next level.`,
};

const ARC_GUIDANCE: Record<string, string> = {
  building_excitement: `Their energy is building — this is momentum. Help them channel it before it peaks and fades.`,
  steady: `Steady state — normal counsel applies.`,
  venting: `They're releasing pressure. Let them, then redirect. Don't jump to solutions too fast.`,
  winding_down: `Energy is fading. Front-load your most critical point. Simplify everything.`,
  recovering: `Coming back from a low. Be encouraging but realistic. Small wins matter right now.`,
};

function formatEnergyGuidance(
  energy?: EnergyLevel,
  arc?: EnergyArc,
): string {
  if (!energy || energy === 'neutral') return '';

  const energyAdvice = ENERGY_ADAPTATIONS[energy] || ENERGY_ADAPTATIONS.neutral;
  const arcAdvice = arc && arc !== 'steady' ? ARC_GUIDANCE[arc] || '' : '';

  return `
## CEO'S CURRENT STATE
Energy: **${energy}** | Arc: **${arc || 'steady'}**

${energyAdvice}
${arcAdvice ? `\n${arcAdvice}` : ''}

Adapt your tone and approach accordingly. This is not about being soft —
it's about being effective. A frustrated CEO needs different medicine than
an excited one.
`;
}

// ============================================================================
// PHASE 0: CROSS-BOARD FEED (Layer 5)
// ============================================================================

function formatCrossBoardFeed(
  feed?: BoardActivityEntry[],
  currentMemberSlug?: string,
): string {
  if (!feed || feed.length === 0) return '';

  // Filter out current member's own entries
  const otherMembers = feed.filter(f => f.member_slug !== currentMemberSlug);
  if (otherMembers.length === 0) return '';

  return `
## WHAT YOUR COLLEAGUES DISCUSSED RECENTLY
Other board members have been advising the CEO on these topics.
Use this for context — don't repeat their advice, BUILD on it or
respectfully disagree if your expertise tells you otherwise.

${otherMembers.slice(0, 5).map(f =>
    `- **${f.member_name}**: ${f.summary}${f.topic_tags?.length ? ` [${f.topic_tags.join(', ')}]` : ''}`
  ).join('\n')}

You are aware of your colleagues' counsel. Reference it when relevant:
"I see Griffin raised concerns about runway — I want to add..."
"Building on what Athena suggested about market positioning..."
`;
}

// ============================================================================
// PHASE 0: RECENT DECISIONS (Layer 6)
// ============================================================================

function formatRecentDecisions(
  decisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>,
): string {
  if (!decisions || decisions.length === 0) return '';

  return `
## ACTIVE BOARD DECISIONS
These decisions were recently made. Factor them into your advice —
don't contradict active decisions without acknowledging the conflict.

${decisions.slice(0, 5).map(d =>
    `- [${d.category}] ${d.decision} (by ${d.member_slug}, ${d.created_at.split('T')[0]})`
  ).join('\n')}
`;
}

// ============================================================================
// LEGACY FORMATTERS (backward compat for tasks.ts / briefing.ts)
// ============================================================================

function formatCompanyContext(context?: string): string {
  if (!context) return '';
  return `
## COMPANY CONTEXT
${context}
`;
}

function formatLegacyMemories(memories?: Array<{ type: string; content: string }>): string {
  if (!memories || memories.length === 0) return '';
  return `
## YOUR MEMORIES OF THIS CEO
Previous interactions and key information:
${memories.map(m => `- [${m.type}] ${m.content}`).join('\n')}

Use these memories to provide personalized, contextual advice.
`;
}

function formatConversationHistory(history: Array<{ role: string; content: string }>): string {
  if (history.length === 0) return '';

  const recent = history.slice(-10);

  return `
## CONVERSATION SO FAR
${recent.map(h => {
    const speaker = h.role === 'user' ? 'CEO' : 'Board';
    return `**${speaker}**: ${h.content.substring(0, 500)}${h.content.length > 500 ? '...' : ''}`;
  }).join('\n\n')}
`;
}

// ============================================================================
// MAIN PROMPT BUILDER — 8-Layer Assembly
// ============================================================================

export function buildBoardMemberPrompt(context: PromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const {
    member, userMessage, meetingType, conversationHistory,
    // Phase 0 fields
    founderMemory, founderEnergy, founderArc,
    crossBoardFeed, recentDecisions,
    // Legacy fields
    companyContext, memories,
  } = context;

  // ── Layer 1: Identity ─────────────────────────────────
  const identityBlock = `
# ${member.name.toUpperCase()} - ${member.title}
## AI Board of Directors | Executive Boardroom

You are ${member.name}, serving as ${member.title} on this executive AI Board of Directors.
You advise the CEO with the strategic depth of history's greatest business minds.

### YOUR EXPERTISE:
${(member.expertise || []).map(e => `- ${e}`).join('\n')}

### YOUR PERSONALITY:
${member.personality?.style || 'Direct, insightful, and action-oriented'}
Voice: ${member.voice_style || 'Professional but warm'}
`;

  // ── Layer 2: Elevation Protocols ──────────────────────
  const elevationBlock = `${BILLIONAIRE_CORE}\n${getMemberProtocolPrompt(member)}`;

  // ── Layer 3: Memory (Phase 0 → legacy fallback) ──────
  const memoryBlock = founderMemory
    ? formatFounderMemory(founderMemory)
    : formatLegacyMemories(memories);

  // ── Layer 4: Energy Adaptation ────────────────────────
  const energyBlock = formatEnergyGuidance(founderEnergy, founderArc);

  // ── Layer 5: Cross-Board Feed ─────────────────────────
  const feedBlock = formatCrossBoardFeed(crossBoardFeed, member.slug);

  // ── Layer 6: Recent Decisions ─────────────────────────
  const decisionsBlock = formatRecentDecisions(recentDecisions);

  // ── Layer 7: Meeting Type ─────────────────────────────
  const meetingBlock = MEETING_MODIFIERS[meetingType] || '';

  // ── Layer 8: Voice / Response Guidelines ──────────────
  const voiceBlock = `
### RESPONSE GUIDELINES:
- **Be Direct**: No corporate fluff. Say what you mean.
- **Be Bold**: Recommend what's right, not what's safe.
- **Be Specific**: Give exact numbers, names, timelines.
- **Be Transformational**: Leave them thinking differently.
- **Challenge Assumptions**: Question what they didn't know to question.
- **End with Action**: Always provide a specific next step.

${formatCompanyContext(companyContext)}

---
Your goal is not just to advise, but to ELEVATE the CEO's thinking permanently.
Every response should leave them at a higher level than before.
`;

  // ── Assemble system prompt ────────────────────────────
  const systemPrompt = [
    identityBlock,
    elevationBlock,
    memoryBlock,
    energyBlock,
    feedBlock,
    decisionsBlock,
    meetingBlock,
    voiceBlock,
  ]
    .filter(block => block.trim().length > 0)
    .join('\n')
    .trim();

  // ── Assemble user prompt ──────────────────────────────
  const protocolGuidance = getActiveProtocolGuidance(userMessage);

  const userPrompt = `
${formatConversationHistory(conversationHistory)}

## CEO'S MESSAGE:
${userMessage}

${protocolGuidance}

Respond as ${member.name}, bringing your unique expertise and elevation protocols to bear.
`.trim();

  return { systemPrompt, userPrompt };
}

// ============================================================================
// QUICK TASK PROMPT BUILDER
// ============================================================================

const TASK_PROMPTS: Record<string, (context: string) => string> = {
  social_media_posts: (context) => `
Create a week of social media content for ${context || 'our company'}.

For each post:
- Platform (Twitter/LinkedIn/Instagram)
- Hook (first line that stops scrolling)
- Body (value-packed content)
- CTA (what to do next)
- Hashtags (3-5 relevant)

Apply the Identity Marketing Framework:
- What transformation are we selling?
- Why would someone share this?
- What convention are we breaking?

Make it BOLD, CONTRARIAN, and SHAREABLE.
`,

  competitive_analysis: (context) => `
Conduct a deep competitive analysis for ${context || 'our market'}.

Using the Billionaire Mental Models:
1. **First Principles**: What fundamental problem are we all solving?
2. **Moat Analysis**: What's each competitor's unfair advantage?
3. **Asymmetric Opportunities**: Where are gaps no one is exploiting?
4. **10-Year Projection**: Where is this market going?

Deliver:
- Top 5 competitors with strengths/weaknesses
- The contrarian insight everyone's missing
- 3 strategic moves to gain advantage
- The "Bezos" play: what would they regret not doing?
`,

  market_research: (context) => `
Deep-dive market research on ${context || 'our target market'}.

Apply the Research Stack:
1. Surface data (what everyone sees)
2. Hidden signals (what you found deeper)
3. Contrarian insight (what everyone's wrong about)

Deliver:
- Market size with growth trajectory
- Key trends with timeline
- Customer segments with pain points
- The opportunity others are missing
- Confidence level on each insight
`,

  investor_narrative: (context) => `
Craft a compelling investor narrative for ${context || 'our company'}.

Using Naval's Leverage Framework + Bezos's Backwards Thinking:
1. What massive problem are we solving?
2. Why is now the right time?
3. What gives us unfair advantages?
4. What's the 10-year vision?
5. Why will we win?

Deliver:
- One-liner (Twitter-pitch)
- Elevator pitch (60 seconds)
- Three key proof points
- The "founder's insight" moment
- Objection handling for top 3 concerns
`,

  terms_of_service: (context) => `
Draft Terms of Service for ${context || 'our platform'}.

Key sections needed:
1. Service Description
2. User Obligations
3. Intellectual Property
4. Limitation of Liability
5. Dispute Resolution
6. Termination

Focus on:
- Plain language (readable by humans)
- Protective but fair
- Compliant with key regulations (GDPR, CCPA)
- Future-proofed for growth

Flag any areas needing attorney review.
`,

  privacy_policy: (context) => `
Draft a Privacy Policy for ${context || 'our platform'}.

Required sections:
1. Information We Collect
2. How We Use Information
3. Information Sharing
4. Data Security
5. User Rights
6. Contact Information

Ensure compliance with:
- GDPR (EU)
- CCPA (California)
- General best practices

Make it readable while being comprehensive.
Flag areas needing legal review.
`,

  financial_projections: (context) => `
Build financial projections for ${context || 'the next 3 years'}.

Using Griffin's Wealth Building Framework:
1. Revenue model with unit economics
2. Cost structure with scale effects
3. Cash flow with runway implications
4. Key metrics and milestones

Deliver:
- Revenue projection (Base/Bull/Bear)
- Key assumptions clearly stated
- Sensitivity analysis on top 3 variables
- Path to profitability
- Capital needs and timing

Be realistic but ambitious.
`,

  api_design: (context) => `
Design the API architecture for ${context || 'our platform'}.

Using Vulcan's Architecture Stack:
1. Principles (non-negotiables)
2. Patterns (reusable solutions)
3. Endpoints (specific routes)
4. Auth/Security model
5. Rate limiting strategy

Deliver:
- RESTful endpoint design
- Request/response schemas
- Authentication approach
- Error handling patterns
- Versioning strategy
- Developer experience considerations

Design for 100x scale from day one.
`,
};

export function buildTaskPrompt(
  taskType: string,
  member: BoardMember,
  additionalContext?: string,
): string {
  const taskPromptBuilder = TASK_PROMPTS[taskType];

  if (!taskPromptBuilder) {
    return `Complete the following task as ${member.name}: ${taskType}\n\nContext: ${additionalContext || 'None provided'}`;
  }

  const baseTaskPrompt = taskPromptBuilder(additionalContext || '');

  return `
You are ${member.name}, ${member.title}.

${BILLIONAIRE_CORE}

${getMemberProtocolPrompt(member)}

## YOUR TASK:
${baseTaskPrompt}

---
Apply your elevation protocols. Deliver work that transforms, not just informs.
`.trim();
}

// ============================================================================
// BRIEFING PROMPT BUILDER
// ============================================================================

export function buildBriefingPrompt(
  member: BoardMember,
  briefingType: 'morning' | 'evening' | 'weekly',
  companyContext?: string,
): string {
  const briefingFocus: Record<string, string> = {
    morning: 'Focus on: Today\'s priorities, overnight developments, key decisions needed, energy and mindset setting.',
    evening: 'Focus on: Day\'s wins and lessons, tomorrow\'s preparation, unfinished business, rest and recovery.',
    weekly: 'Focus on: Week\'s strategic progress, pattern recognition, next week\'s priorities, long-term trajectory check.',
  };

  return `
You are ${member.name}, ${member.title}, preparing a ${briefingType} briefing for the CEO.

${BILLIONAIRE_CORE}

${getMemberProtocolPrompt(member)}

## BRIEFING CONTEXT:
${companyContext || 'Provide general strategic guidance.'}

## BRIEFING FOCUS:
${briefingFocus[briefingType]}

## YOUR SECTION:
Based on your expertise, provide:
1. **Key Insight**: One thing the CEO must know
2. **Recommended Action**: One thing to do today
3. **Watch Out**: One risk or opportunity to monitor
4. **Mindset**: One mental model to apply today

Be concise (150-200 words max). Make it valuable, not verbose.
Apply your elevation protocols to transform their thinking, not just inform it.
`.trim();
}