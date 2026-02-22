// FILE: api/boardroom/lib/prompt-builder/tasks.ts
// ═══════════════════════════════════════════════════════════════════════
// QUICK TASK PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════
//
// Pre-built prompt templates for common board tasks.
// Each task type gets a rich, framework-driven prompt.
//
// ═══════════════════════════════════════════════════════════════════════

import { BILLIONAIRE_CORE } from './constants.js';
import { getMemberProtocolPrompt } from './elevation.js';
import type { BoardMember } from './types.js';

// ============================================================================
// TASK PROMPT TEMPLATES
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

// ============================================================================
// BUILD TASK PROMPT
// ============================================================================

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