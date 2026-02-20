// FILE: api/boardroom/lib/tasks/task-registry.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK MODULE — Task Type Registry
// ═══════════════════════════════════════════════════════════════════════
//
// Static configuration for every task type the board can produce.
// Adding a new task type = add an entry here. Nothing else changes.
//
// ═══════════════════════════════════════════════════════════════════════

import type { TaskInstruction } from './types.js';

// =============================================================================
// REGISTRY
// =============================================================================

export const TASK_INSTRUCTIONS: Record<string, TaskInstruction> = {

  // ── Marketing & Content ───────────────────────────────

  social_media_posts: {
    description: 'Create engaging social media content',
    deliverableFormat: `Create social media content for TagnetIQ. Output:
- 3 Twitter/X posts (under 280 chars each, punchy, hashtagged)
- 2 LinkedIn posts (professional tone, industry insight angle)
- 2 Instagram captions (visual-first, engagement hooks)
- 1 TikTok script concept (60-second, hook in first 3 seconds)

Align with "Bloomberg Terminal for Collectibles" positioning.
Include calls to action. Reference specific features or benefits.
Make each post shareable on its own — not a thread.`,
    defaultAssignee: 'glitch',
    maxTokens: 2048,
    requiresTrust: 0,
  },

  marketing_copy: {
    description: 'Write compelling marketing copy',
    deliverableFormat: `Write marketing copy for TagnetIQ:
- 3 headline variations (different angles: value, urgency, curiosity)
- 2 subheadline options per headline
- Body copy (150-200 words, scannable, benefit-focused)
- 3 CTA button text options
- Email subject line variation

Highlight multi-AI valuation technology as the differentiator.
Write like you're selling a superpower, not a feature.`,
    defaultAssignee: 'glitch',
    maxTokens: 2048,
    requiresTrust: 0,
  },

  campaign_design: {
    description: 'Design a complete marketing campaign',
    deliverableFormat: `Design a complete marketing campaign:
- Campaign name and theme
- Target audience (specific persona, not generic)
- Key messaging framework (problem, agitation, solution)
- Channel strategy with specific tactics per channel
- Content calendar (2-week sprint, specific dates)
- Budget allocation (even if $0, show where to spend first $500)
- Success metrics with specific targets
- A/B test opportunities`,
    defaultAssignee: 'glitch',
    maxTokens: 3072,
    requiresTrust: 20,
  },

  email_sequences: {
    description: 'Create email marketing sequences',
    deliverableFormat: `Create email marketing sequences:

WELCOME SEQUENCE (3 emails, days 1, 3, 7):
Each email: subject line, preview text, full body, CTA, send timing

ACTIVATION SEQUENCE (3 emails for users who haven't valued an item):
Focus on getting first scan. Reduce friction. Show value fast.

UPGRADE SEQUENCE (3 emails converting free to Pro):
Show what they're missing. Social proof. Urgency. Clear ROI.

Each email should be: personal, scannable, mobile-first, action-oriented.
Subject lines: under 50 chars, A/B testable.`,
    defaultAssignee: 'glitch',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  seo_optimization: {
    description: 'SEO strategy and content optimization',
    deliverableFormat: `SEO optimization deliverable:
- Target keyword research (10 primary, 20 long-tail)
- Content gap analysis vs competitors
- On-page optimization checklist for top 5 pages
- Blog post outlines (3 posts targeting specific keywords)
- Meta title/description templates
- Internal linking strategy
- Technical SEO quick wins`,
    defaultAssignee: 'glitch',
    maxTokens: 3072,
    requiresTrust: 20,
  },

  // ── Strategic Analysis ────────────────────────────────

  competitive_analysis: {
    description: 'Deep competitive intelligence',
    deliverableFormat: `Competitive analysis report:

For each competitor (PSA, BGS, WhatNot, eBay, Collectors.com, Goldin, StockX):
- Current positioning and value prop
- Pricing model
- Known strengths and weaknesses
- Recent moves (funding, features, partnerships)
- User sentiment (from reviews, social, forums)

Then:
- Competitive matrix (feature comparison table)
- Our differentiation opportunities (where we win)
- Threats to watch (where they could crush us)
- Strategic recommendations (3 specific moves)`,
    defaultAssignee: 'scuba',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  market_research: {
    description: 'Market intelligence and trend analysis',
    deliverableFormat: `Market research report:
- Total addressable market (with sources)
- Market segmentation by category
- Growth trends (3-year trajectory)
- Consumer behavior insights
- Technology disruption opportunities
- Emerging categories to watch
- Investment trends in the space
- Data quality: cite sources, include dates, flag estimates vs facts`,
    defaultAssignee: 'scuba',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  investor_narrative: {
    description: 'Craft seed round investor story',
    deliverableFormat: `Investor narrative (seed round):
- Problem (1 paragraph, visceral, relatable)
- Solution (1 paragraph, clear differentiation)
- Why Now (market timing, technology readiness)
- Why Us (founder story, unfair advantages)
- Traction (metrics, even small ones, framed powerfully)
- The Vision (where this goes in 5 years)
- The Ask (specific amount, specific use of funds, specific milestones)
- Comparable exits (who got acquired, for how much)

Tone: confident but honest. No buzzwords. Specific numbers.`,
    defaultAssignee: 'athena',
    maxTokens: 3072,
    requiresTrust: 40,
  },

  // ── Financial ─────────────────────────────────────────

  financial_projections: {
    description: 'Revenue model and financial projections',
    deliverableFormat: `Financial projections:
- Revenue model assumptions (clearly stated)
- Monthly projection: Months 1-6, quarterly: Q3-Q4, annual: Year 2-3
- Revenue streams: subscriptions, marketplace fees, API, partnerships
- Cost structure: infrastructure, API costs, support, marketing
- Unit economics: CAC, LTV, LTV:CAC ratio, payback period
- Path to profitability: when, at what scale
- Sensitivity analysis: best/base/worst case
- Key metrics dashboard: what to track weekly`,
    defaultAssignee: 'griffin',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  pricing_analysis: {
    description: 'Pricing strategy and optimization',
    deliverableFormat: `Pricing analysis:
- Current pricing assessment
- Market benchmarks (what competitors charge)
- Value-based pricing analysis (what it's worth to users)
- Recommended tier structure with specific prices
- Feature gating strategy (what's free vs paid)
- Transaction fee analysis for marketplace
- B2B/API pricing model
- Price sensitivity considerations
- Implementation recommendations with timeline`,
    defaultAssignee: 'griffin',
    maxTokens: 3072,
    requiresTrust: 20,
  },

  // ── Legal ─────────────────────────────────────────────

  terms_of_service: {
    description: 'Draft Terms of Service',
    deliverableFormat: `Terms of Service (complete, legally structured):
1. Acceptance of Terms
2. Description of Service (AI valuations, marketplace, vault)
3. User Accounts and Responsibilities
4. Subscription and Payment Terms
5. AI Valuation Disclaimers (critical: not financial advice)
6. Marketplace Terms (buyer/seller responsibilities)
7. Intellectual Property
8. User Content and Submissions
9. Privacy (reference Privacy Policy)
10. Disclaimers and Limitations of Liability
11. Indemnification
12. Termination
13. Governing Law
14. Dispute Resolution
15. Changes to Terms
16. Contact Information

Professional but readable. Users should understand what they're agreeing to.
Flag sections where a human lawyer MUST review before publishing.`,
    defaultAssignee: 'lexicoda',
    maxTokens: 4096,
    requiresTrust: 40,
  },

  privacy_policy: {
    description: 'Draft GDPR/CCPA compliant Privacy Policy',
    deliverableFormat: `Privacy Policy (GDPR + CCPA compliant):
1. Information We Collect (photos, account data, usage data, AI interactions)
2. How We Use Information (valuation processing, personalization, analytics)
3. Information Sharing (AI providers, payment processors, analytics)
4. Data Retention
5. Your Rights (access, deletion, portability, opt-out)
6. Cookie Policy
7. Children's Privacy
8. Security Measures
9. International Data Transfers
10. Changes to Policy
11. Contact / DPO Information

Include CCPA-specific disclosures.
Flag sections needing human legal review.`,
    defaultAssignee: 'lexicoda',
    maxTokens: 4096,
    requiresTrust: 40,
  },

  // ── Technical ─────────────────────────────────────────

  api_design: {
    description: 'Design public API specification',
    deliverableFormat: `Public API specification:
- Authentication (API keys, OAuth2)
- Rate limiting strategy
- Core endpoints:
  - POST /valuations (submit item for AI valuation)
  - GET /valuations/:id (retrieve valuation result)
  - GET /categories (list supported categories)
  - POST /vault/items (add to collection)
  - GET /vault/items (list collection)
  - GET /market/search (marketplace search)
- Request/response formats (JSON, with examples)
- Error handling (standard error codes)
- Webhook support (valuation complete, price change)
- SDK guidance (Python, JavaScript, Ruby)
- Versioning strategy

OpenAPI 3.0 format where possible.`,
    defaultAssignee: 'vulcan',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  architecture_docs: {
    description: 'Technical architecture documentation',
    deliverableFormat: `Architecture documentation:
- System overview (component diagram, text description)
- Data flow (user request → AI pipeline → response)
- Technology choices and rationale
- Database schema overview
- API layer architecture
- AI provider integration (HYDRA system)
- Authentication and authorization flow
- Scalability considerations
- Security architecture
- Monitoring and observability
- Deployment pipeline
- Known technical debt and remediation plan`,
    defaultAssignee: 'vulcan',
    maxTokens: 4096,
    requiresTrust: 20,
  },

  // ── Product ───────────────────────────────────────────

  feature_spec: {
    description: 'Product feature specification',
    deliverableFormat: `Feature specification:
- Feature name and one-line description
- Problem it solves (user pain point)
- User stories (3-5, "As a... I want... So that...")
- Acceptance criteria (specific, testable)
- UI/UX considerations (mobile-first)
- Technical requirements
- Dependencies
- Estimated effort (T-shirt sizing)
- Success metrics (how we know it's working)
- Rollout plan (beta → general availability)`,
    defaultAssignee: 'legolas',
    maxTokens: 3072,
    requiresTrust: 20,
  },

  // ── Customer Service ──────────────────────────────────

  support_response: {
    description: 'Draft customer support response',
    deliverableFormat: `Draft a professional, empathetic customer support response.
- Acknowledge the issue
- Explain what happened (if known)
- Provide solution or next steps
- Offer additional help
- Keep it concise and warm

Tone: professional but human. Not robotic.
If the issue requires escalation, say so clearly.`,
    defaultAssignee: 'sal',
    maxTokens: 1024,
    requiresTrust: 0,
  },

  // ── Knowledge & Documentation ─────────────────────────

  documentation: {
    description: 'Create internal documentation',
    deliverableFormat: `Documentation deliverable:
- Clear title and purpose statement
- Table of contents (if >500 words)
- Step-by-step instructions where applicable
- Code examples where relevant
- Troubleshooting section
- Related documents / further reading
- Version and last-updated date
- Owner (who maintains this doc)

Write for someone joining the team tomorrow.
Assume no prior context. Be explicit.`,
    defaultAssignee: 'orion',
    maxTokens: 3072,
    requiresTrust: 0,
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/** Get all available task type keys */
export function getAvailableTaskTypes(): string[] {
  return Object.keys(TASK_INSTRUCTIONS);
}

/** Validate a task type exists */
export function isValidTaskType(taskType: string): boolean {
  return taskType in TASK_INSTRUCTIONS;
}

/** Get the config for a task type (or null) */
export function getTaskConfig(taskType: string): TaskInstruction | null {
  return TASK_INSTRUCTIONS[taskType] || null;
}