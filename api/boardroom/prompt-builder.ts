// FILE: api/boardroom/lib/prompt-builder.ts
// Server-side prompt builder that assembles complete prompts for board member AI calls
// This integrates the Elevation Protocols into every AI interaction

import { 
  ELEVATION_PROTOCOLS, 
  MEMBER_PROTOCOL_AFFINITIES,
  getProtocolById,
  detectActiveProtocols,
  type ElevationProtocol 
} from '../../../src/features/boardroom/elevation-protocols';

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
}

interface PromptContext {
  member: BoardMember;
  userMessage: string;
  meetingType: string;
  conversationHistory: Array<{ role: string; content: string }>;
  companyContext?: string;
  memories?: Array<{ type: string; content: string }>;
}

// ============================================================================
// BILLIONAIRE MENTAL MODELS - Core to all prompts
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
};

// ============================================================================
// COMPANY CONTEXT BUILDER
// ============================================================================

function formatCompanyContext(context?: string): string {
  if (!context) {
    return '';
  }
  
  return `
## COMPANY CONTEXT
${context}
`;
}

function formatMemories(memories?: Array<{ type: string; content: string }>): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  return `
## YOUR MEMORIES OF THIS CEO
Previous interactions and key information:
${memories.map(m => `- [${m.type}] ${m.content}`).join('\n')}

Use these memories to provide personalized, contextual advice.
`;
}

function formatConversationHistory(history: Array<{ role: string; content: string }>): string {
  if (history.length === 0) {
    return '';
  }

  const recent = history.slice(-10); // Last 10 messages
  
  return `
## CONVERSATION SO FAR
${recent.map(h => {
  const speaker = h.role === 'user' ? 'CEO' : 'Board';
  return `**${speaker}**: ${h.content.substring(0, 500)}${h.content.length > 500 ? '...' : ''}`;
}).join('\n\n')}
`;
}

// ============================================================================
// MAIN PROMPT BUILDER
// ============================================================================

export function buildBoardMemberPrompt(context: PromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const { member, userMessage, meetingType, conversationHistory, companyContext, memories } = context;

  // Build the complete system prompt
  const systemPrompt = `
# ${member.name.toUpperCase()} - ${member.title}
## AI Board of Directors | Executive Boardroom

You are ${member.name}, serving as ${member.title} on this executive AI Board of Directors.
You advise the CEO with the strategic depth of history's greatest business minds.

### YOUR EXPERTISE:
${(member.expertise || []).map(e => `- ${e}`).join('\n')}

### YOUR PERSONALITY:
${member.personality?.style || 'Direct, insightful, and action-oriented'}
Voice: ${member.voice_style || 'Professional but warm'}

${BILLIONAIRE_CORE}

${getMemberProtocolPrompt(member)}

${MEETING_MODIFIERS[meetingType] || ''}

### RESPONSE GUIDELINES:
- **Be Direct**: No corporate fluff. Say what you mean.
- **Be Bold**: Recommend what's right, not what's safe.
- **Be Specific**: Give exact numbers, names, timelines.
- **Be Transformational**: Leave them thinking differently.
- **Challenge Assumptions**: Question what they didn't know to question.
- **End with Action**: Always provide a specific next step.

${formatCompanyContext(companyContext)}

${formatMemories(memories)}

---
Your goal is not just to advise, but to ELEVATE the CEO's thinking permanently.
Every response should leave them at a higher level than before.
`.trim();

  // Build the user prompt with any active protocol guidance
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
  additionalContext?: string
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
  companyContext?: string
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