// FILE: api/boardroom/tasks.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD TASK SYSTEM — Assign work, get deliverables
// ═══════════════════════════════════════════════════════════════════════
//
// This is the work-product engine for the AI Board of Directors.
// Board members don't just advise — they PRODUCE.
//
// TASK LIFECYCLE:
//   QUEUED → ASSIGNED → IN_PROGRESS → REVIEW
//     → APPROVED → EXECUTING → VERIFIED → COMPLETE
//   Or: REVIEW → REVISION_REQUESTED → IN_PROGRESS
//   Or: REVIEW → REJECTED (with feedback)
//   Or: EXECUTING → BLOCKED → NEEDS_HUMAN
//
// MEMORY-AWARE (Sprint 0c):
//   Every task execution receives:
//   - Founder memory (what the member knows about you)
//   - Board decisions (what's been decided)
//   - Company context (active business knowledge)
//   This means: Griffin's financial projection references YOUR revenue
//   targets. Lexicoda's TOS addresses YOUR specific risks.
//
// PROVIDER GATEWAY (Sprint 0d):
//   All AI calls via shared provider-caller.ts.
//   Fallback chain protects task execution from provider outages.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// ── Provider Gateway ────────────────────────────────────
import {
  callWithFallback,
  callProviderDirect,
  getSupaAdmin,
  getCompanyContext,
  logGatewayCall,
} from './lib/provider-caller.js';

// ── Prompt Builder (task prompts) ───────────────────────
import { buildTaskPrompt } from './lib/prompt-builder.js';

// ── Founder Memory ──────────────────────────────────────
import {
  getFounderMemory,
  getRecentDecisions,
  getCrossBoardFeed,
} from '../../src/lib/boardroom/memory/founder-memory.js';

// ── Evolution (trust gating) ────────────────────────────
import {
  getTrustTier,
  type BoardMember,
} from '../../src/lib/boardroom/evolution.js';

// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60,
};

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// TASK TYPE REGISTRY
// =============================================================================
// Each task type has specific deliverable instructions that tell the
// board member exactly what output format the founder expects.
// These are paired with the member's expertise and memory context
// to produce specific, actionable deliverables.

const TASK_INSTRUCTIONS: Record<string, {
  description: string;
  deliverableFormat: string;
  defaultAssignee: string;
  maxTokens: number;
  requiresTrust: number;
}> = {
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
// BUILD MEMORY-AWARE TASK CONTEXT
// =============================================================================

async function buildTaskContext(
  userId: string,
  memberSlug: string,
  member: BoardMember,
  taskType: string,
  title: string,
  description: string | null,
): Promise<{ systemPrompt: string; taskPrompt: string; maxTokens: number }> {
  // ── Fetch founder memory + company context in parallel ──
  const [founderMemory, recentDecisions, crossBoardFeed, companyContext] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch(() => null),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug, 14, 5).catch(() => []),
    getCompanyContext(),
  ]);

  // ── Build memory context ──
  let memoryContext = '';

  if (founderMemory) {
    // Founder details (role-specific, confidence-sorted)
    const details = (founderMemory.founder_details || [])
      .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 15);

    if (details.length > 0) {
      memoryContext += '\n## WHAT YOU KNOW ABOUT THE FOUNDER\n';
      memoryContext += 'Use this context to make your deliverable specific and relevant:\n';
      details.forEach((d: any) => {
        memoryContext += `- ${d.key}: ${d.value}\n`;
      });
    }

    // Decisions this member witnessed
    const decisions = (founderMemory.decisions_witnessed || []).slice(-5);
    if (decisions.length > 0) {
      memoryContext += '\n## DECISIONS YOU WITNESSED\n';
      decisions.forEach((d: any) => {
        memoryContext += `- ${d.decision}${d.status === 'completed' ? ' ✓' : ''}\n`;
      });
    }

    // Compressed conversation summaries
    const memories = (founderMemory.compressed_memories || []).slice(-3);
    if (memories.length > 0) {
      memoryContext += '\n## PREVIOUS CONVERSATION SUMMARIES\n';
      memories.forEach((m: any) => {
        memoryContext += `- [${m.date}] ${m.summary}\n`;
      });
    }
  }

  // Cross-board context
  if (crossBoardFeed.length > 0) {
    memoryContext += '\n## WHAT OTHER BOARD MEMBERS HAVE BEEN DOING\n';
    crossBoardFeed.forEach((entry: any) => {
      memoryContext += `- ${entry.member_slug}: ${entry.summary}\n`;
    });
  }

  // Board decisions
  if (recentDecisions.length > 0) {
    memoryContext += '\n## ACTIVE BOARD DECISIONS\n';
    recentDecisions.forEach((d: any) => {
      memoryContext += `- ${d.decision} (via ${d.member_slug})\n`;
    });
  }

  // ── Build system prompt ──
  const taskConfig = TASK_INSTRUCTIONS[taskType];
  const baseTaskPrompt = buildTaskPrompt(taskType, member, description || title);

  const systemPrompt = `${member.system_prompt || ''}
${companyContext}
${memoryContext}

You are now executing a specific task for the founder. Focus entirely on producing the requested deliverable. Be thorough, professional, and actionable.

CRITICAL: Use what you know about the founder and the company (above) to make this deliverable SPECIFIC and RELEVANT to THEIR situation. Not generic boilerplate. Not placeholder data. Real context, real recommendations, real specifics.

If you reference a number, make it specific to what you know.
If you reference a competitor, reference one they've discussed.
If you reference a goal, reference THEIR stated goal.
This deliverable should feel like it was written by someone who KNOWS this business.`;

  // ── Build the task prompt ──
  const taskInstruction = taskConfig?.deliverableFormat || description || title;
  const maxTokens = taskConfig?.maxTokens || 2048;

  const taskPrompt = `## YOUR ASSIGNMENT
${title}

## ADDITIONAL CONTEXT FROM THE FOUNDER
${description || 'No additional context provided.'}

## DELIVERABLE REQUIREMENTS
${taskInstruction}

## OUTPUT STANDARDS
- Complete, professional deliverable that can be used immediately
- Format appropriately for the task type
- Reference specific details you know about the founder, company, and goals
- Flag any assumptions you're making
- Flag anything that needs human review or verification
- If you need information you don't have, say so clearly — don't fabricate`;

  return { systemPrompt, taskPrompt, maxTokens };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required' });
    }

    // ══════════════════════════════════════════════════════
    // GET: List tasks or get specific task
    // ══════════════════════════════════════════════════════

    if (req.method === 'GET') {
      const { id, status, assigned_to, task_type, limit: queryLimit } = req.query;

      // Specific task by ID
      if (id) {
        const { data: task } = await supabaseAdmin
          .from('boardroom_tasks')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (!task) {
          return res.status(404).json({ error: 'Task not found' });
        }
        return res.status(200).json(task);
      }

      // List tasks with filters
      let query = supabaseAdmin
        .from('boardroom_tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status as string);
      if (assigned_to) query = query.eq('assigned_to', assigned_to as string);
      if (task_type) query = query.eq('task_type', task_type as string);

      const limit = Math.min(parseInt(queryLimit as string) || 50, 100);
      const { data: tasks } = await query.limit(limit);

      return res.status(200).json({
        tasks: tasks || [],
        count: (tasks || []).length,
        filters: { status, assigned_to, task_type },
      });
    }

    // ══════════════════════════════════════════════════════
    // POST: Create and optionally execute a task
    // ══════════════════════════════════════════════════════

    if (req.method === 'POST') {
      const {
        assigned_to,
        title,
        description,
        task_type,
        priority,
        execute_now,
        deadline,
      } = req.body;

      if (!assigned_to || !title || !task_type) {
        return res.status(400).json({
          error: 'Required: assigned_to (member slug), title, task_type',
          available_task_types: Object.keys(TASK_INSTRUCTIONS),
        });
      }

      // Validate task type
      if (!TASK_INSTRUCTIONS[task_type]) {
        return res.status(400).json({
          error: `Unknown task_type: "${task_type}"`,
          available_task_types: Object.keys(TASK_INSTRUCTIONS),
        });
      }

      // Load the assigned board member
      const { data: member, error: memberError } = await supabaseAdmin
        .from('boardroom_members')
        .select('*')
        .eq('slug', assigned_to)
        .single();

      if (memberError || !member) {
        return res.status(400).json({ error: `Board member '${assigned_to}' not found` });
      }

      const boardMember = member as BoardMember;
      const taskConfig = TASK_INSTRUCTIONS[task_type];

      // Trust gating: check if member has sufficient trust for this task type
      const memberTrust = boardMember.trust_level || 0;
      if (memberTrust < taskConfig.requiresTrust) {
        const trustTier = getTrustTier(memberTrust);
        return res.status(403).json({
          error: `${boardMember.name} needs trust level ${taskConfig.requiresTrust}+ for ${task_type} tasks. Current: ${memberTrust} (${trustTier}).`,
          suggestion: 'Build trust through more conversations and successful task completions.',
        });
      }

      // Create the task record
      const { data: task, error: taskError } = await supabaseAdmin
        .from('boardroom_tasks')
        .insert({
          user_id: user.id,
          assigned_to,
          title,
          description: description || title,
          task_type,
          priority: priority || 'normal',
          status: execute_now ? 'in_progress' : 'pending',
          started_at: execute_now ? new Date().toISOString() : null,
          deadline: deadline || null,
          metadata: {
            member_name: boardMember.name,
            member_title: boardMember.title,
            trust_at_creation: memberTrust,
          },
        })
        .select()
        .single();

      if (taskError) {
        return res.status(500).json({ error: taskError.message });
      }

      // ── Execute immediately if requested ──────────────
      if (execute_now) {
        try {
          const { systemPrompt, taskPrompt, maxTokens } = await buildTaskContext(
            user.id, assigned_to, boardMember, task_type, title, description,
          );

          const result = await callWithFallback(
            boardMember.dominant_provider || boardMember.ai_provider,
            boardMember.ai_model,
            systemPrompt,
            taskPrompt,
            {
              maxTokens,
              taskContext: {
                memberSlug: assigned_to,
                taskType: task_type,
                source: 'task',
              },
            },
          );

          // Update task with deliverable
          const { data: completedTask } = await supabaseAdmin
            .from('boardroom_tasks')
            .update({
              status: 'review',
              completed_at: new Date().toISOString(),
              deliverable_type: 'markdown',
              deliverable_content: result.text,
              metadata: {
                ...task.metadata,
                provider: result.provider,
                model: result.model,
                responseTime: result.responseTime,
                isFallback: result.isFallback,
                tokenEstimate: result.tokenEstimate,
              },
            })
            .eq('id', task.id)
            .select()
            .single();

          // Audit log
          logGatewayCall({
            memberSlug: assigned_to,
            provider: result.provider,
            model: result.model,
            source: 'task',
            responseTime: result.responseTime,
            isFallback: result.isFallback,
            success: true,
            tokenEstimate: result.tokenEstimate,
          });

          return res.status(200).json({
            task: completedTask,
            deliverable: result.text,
            member: {
              name: boardMember.name,
              title: boardMember.title,
              slug: boardMember.slug,
            },
            _meta: {
              provider: result.provider,
              model: result.model,
              responseTime: result.responseTime,
              isFallback: result.isFallback,
              tokenEstimate: result.tokenEstimate,
              trustLevel: memberTrust,
              trustTier: getTrustTier(memberTrust),
            },
          });
        } catch (execError: any) {
          // Mark task as blocked
          await supabaseAdmin
            .from('boardroom_tasks')
            .update({
              status: 'blocked',
              metadata: {
                ...task.metadata,
                error: execError.message,
                blocked_at: new Date().toISOString(),
              },
            })
            .eq('id', task.id);

          return res.status(500).json({
            error: `Task execution failed: ${execError.message}`,
            task_id: task.id,
            task_status: 'blocked',
          });
        }
      }

      // Task created but not executed yet
      return res.status(201).json({
        task,
        message: `Task assigned to ${boardMember.name}. Set execute_now: true to run immediately.`,
      });
    }

    // ══════════════════════════════════════════════════════
    // PATCH: Update task (feedback, approval, status, revision)
    // ══════════════════════════════════════════════════════

    if (req.method === 'PATCH') {
      const { id, action, ceo_feedback, status } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Task ID required' });
      }

      // Fetch current task
      const { data: currentTask } = await supabaseAdmin
        .from('boardroom_tasks')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!currentTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updates: any = { updated_at: new Date().toISOString() };

      switch (action) {
        case 'approve':
          updates.status = 'approved';
          updates.ceo_approved = true;
          updates.ceo_feedback = ceo_feedback || 'Approved';
          break;

        case 'reject':
          updates.status = 'rejected';
          updates.ceo_approved = false;
          updates.ceo_feedback = ceo_feedback || 'Rejected';
          break;

        case 'request_revision':
          updates.status = 'revision_requested';
          updates.ceo_feedback = ceo_feedback || 'Please revise';
          // Future: auto-re-execute with feedback context
          break;

        case 'execute':
          // Execute a pending task
          if (currentTask.status !== 'pending') {
            return res.status(400).json({ error: `Cannot execute task in "${currentTask.status}" status` });
          }
          updates.status = 'in_progress';
          updates.started_at = new Date().toISOString();
          // TODO: trigger actual execution here
          break;

        default:
          // Direct field updates
          if (ceo_feedback !== undefined) updates.ceo_feedback = ceo_feedback;
          if (status !== undefined) updates.status = status;
      }

      const { data: updatedTask } = await supabaseAdmin
        .from('boardroom_tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      return res.status(200).json(updatedTask);
    }

    // ══════════════════════════════════════════════════════
    // DELETE: Cancel task
    // ══════════════════════════════════════════════════════

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'Task ID required (query param)' });
      }

      const { data: task } = await supabaseAdmin
        .from('boardroom_tasks')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id as string)
        .eq('user_id', user.id)
        .select()
        .single();

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.status(200).json({ success: true, task });
    }

    // ── Method not allowed ──────────────────────────────
    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('[Boardroom] Tasks error:', error);
    return res.status(500).json({ error: error.message });
  }
}