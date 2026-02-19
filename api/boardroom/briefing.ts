// FILE: api/boardroom/briefing.ts
// ═══════════════════════════════════════════════════════════════════════
// DAILY BRIEFING — Board Members Report Autonomously
// ═══════════════════════════════════════════════════════════════════════
//
// This is how the board reports to the CEO without being asked.
// Every morning: market intelligence, strategic updates, tech priorities,
// growth opportunities, wellness check, executive summary.
//
// MEMORY-AWARE (Sprint 0c):
//   Each section receives per-member founder context.
//   Athena's strategic update references yesterday's strategy discussion.
//   Prometheus includes emotional arc wellness note.
//   Griffin references known financial targets in the summary.
//
// BRIEFING TYPES:
//   morning  — Full daily briefing (6 sections + summary)
//   evening  — Day debrief (wins, lessons, tomorrow prep)
//   weekly   — Strategic review (patterns, trajectory, priorities)
//   sandbox  — Overnight simulation results (when towers active)
//   emergency — Triggered by market event or critical finding
//
// PROVIDER STRATEGY:
//   Scuba (market intel) → Perplexity (web search capability)
//   Athena (strategy) → Anthropic (deep reasoning)
//   Vulcan (tech) → Anthropic (code-aware)
//   Glitch (growth) → Groq (fast, creative)
//   Prometheus (wellness) → Anthropic (empathy + nuance)
//   Griffin (summary) → OpenAI (concise synthesis)
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// ── Provider Gateway ────────────────────────────────────
import {
  callProviderDirect,
  callWithFallback,
  getSupaAdmin,
  getCompanyContext,
  logGatewayCall,
} from './lib/provider-caller.js';

// ── Founder Memory ──────────────────────────────────────
import {
  getFounderMemory,
  getRecentDecisions,
  getCrossBoardFeed,
} from '../../src/lib/boardroom/memory/founder-memory.js';

// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60,
};

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// TYPES
// =============================================================================

interface BriefingSection {
  member_slug: string;
  member_name: string;
  title: string;
  content: string;
  priority: number;
  provider_used: string;
  response_time: number;
}

// =============================================================================
// PER-MEMBER FOUNDER CONTEXT BUILDER
// =============================================================================

/**
 * Build founder context specific to this board member's lens.
 * Athena gets strategic goals, Griffin gets financial targets,
 * Prometheus gets emotional arc, etc.
 */
async function buildFounderContext(userId: string, memberSlug: string): Promise<string> {
  const [founderMemory, recentDecisions, crossBoardFeed] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch(() => null),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug, 7, 5).catch(() => []),
  ]);

  let context = '';

  if (founderMemory) {
    // Founder details (role-specific, confidence-sorted)
    const details = (founderMemory.founder_details || [])
      .sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10);

    if (details.length > 0) {
      context += '\n## WHAT YOU KNOW ABOUT THE FOUNDER\n';
      context += 'Reference these specifics in your briefing section:\n';
      details.forEach((d: any) => {
        context += `- ${d.key}: ${d.value}\n`;
      });
    }

    // Decisions this member witnessed
    const decisions = (founderMemory.decisions_witnessed || []).slice(-5);
    if (decisions.length > 0) {
      context += '\n## RECENT DECISIONS YOU WITNESSED\n';
      decisions.forEach((d: any) => {
        context += `- ${d.decision}${d.status ? ` [${d.status}]` : ''}\n`;
      });
    }

    // Compressed conversation summaries
    const memories = (founderMemory.compressed_memories || []).slice(-2);
    if (memories.length > 0) {
      context += '\n## RECENT CONVERSATION SUMMARIES\n';
      memories.forEach((m: any) => {
        context += `- [${m.date}] ${m.summary}\n`;
      });
    }

    // ── Prometheus special: emotional arc ────────────────
    if (memberSlug === 'prometheus') {
      const arc = (founderMemory.emotional_arc || []).slice(-7);
      const patterns = founderMemory.recurring_patterns || [];

      if (arc.length > 0) {
        context += '\n## FOUNDER EMOTIONAL ARC (past 7 sessions)\n';
        context += 'Use this to assess wellness and energy trajectory:\n';
        arc.forEach((a: any) => {
          const date = new Date(a.date).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          });
          context += `- [${date}] Energy: ${a.energy}, Arc: ${a.arc}`;
          if (a.note) context += ` — "${a.note}"`;
          context += '\n';
        });
      }

      if (patterns.length > 0) {
        context += '\n## BEHAVIORAL PATTERNS YOU\'VE DETECTED\n';
        patterns.forEach((p: any) => {
          context += `- ${p.pattern} (observed ${p.occurrences}x)\n`;
        });
      }

      // Energy trend summary
      if (arc.length >= 3) {
        const recentEnergies = arc.slice(-3).map((a: any) => a.energy);
        const highEnergy = recentEnergies.filter((e: string) =>
          ['high', 'excited', 'motivated', 'energized'].includes(e),
        ).length;
        const lowEnergy = recentEnergies.filter((e: string) =>
          ['low', 'exhausted', 'anxious', 'frustrated', 'overwhelmed'].includes(e),
        ).length;

        if (lowEnergy >= 2) {
          context += '\n⚠️ ALERT: Founder has shown low energy in 2+ of last 3 sessions. Pay attention.\n';
        } else if (highEnergy >= 2) {
          context += '\n✅ POSITIVE: Founder energy has been strong recently. Ride the momentum.\n';
        }
      }
    }
  }

  // Cross-board context
  if (crossBoardFeed.length > 0) {
    context += '\n## WHAT OTHER BOARD MEMBERS ADVISED RECENTLY\n';
    crossBoardFeed.forEach((entry: any) => {
      context += `- ${entry.member_slug}: ${entry.summary}\n`;
    });
  }

  // Board decisions
  if (recentDecisions.length > 0) {
    context += '\n## ACTIVE BOARD DECISIONS\n';
    recentDecisions.forEach((d: any) => {
      context += `- ${d.decision} (via ${d.member_slug})\n`;
    });
  }

  return context;
}

// =============================================================================
// BRIEFING SECTION GENERATORS
// =============================================================================

async function generateMarketIntelligence(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Scuba Steve, Director of Deep Research at TagnetIQ. You provide real-time market intelligence.

${companyContext}
${founderContext}

Your role in the daily briefing is to surface actionable market intelligence the CEO needs TODAY. Reference their specific interests, competitors, and market segments where relevant. Don't be generic — be specific to what matters to THIS company.`;

  const userPrompt = `Generate today's Market Intelligence briefing:

1. **Collectibles Market News** — Significant developments in sports cards, Pokemon, coins, vinyl, comics, memorabilia. Price movements, new releases, auction results.

2. **Competitor Activity** — What PSA, BGS, WhatNot, eBay, Collectors.com, Goldin, StockX are doing. New features, pricing changes, partnerships, funding.

3. **AI Industry Developments** — Relevant AI/ML news that impacts our business. New models, pricing changes, capability breakthroughs.

4. **Market Trends** — Emerging categories, demographic shifts, seasonal patterns, investment flows.

5. **Actionable Intel** — The ONE thing from today's intelligence that the CEO should act on.

Lead with the most important/actionable items. Under 500 words.
If you reference something the founder has expressed interest in, call it out.`;

  const start = Date.now();
  let text: string;
  let providerUsed = 'perplexity';

  try {
    text = await callProviderDirect(
      'perplexity', 'sonar-pro',
      systemPrompt, userPrompt,
      { maxTokens: 2048 },
    );
  } catch (err: any) {
    // Fallback: use Anthropic without web search
    providerUsed = 'anthropic';
    text = await callProviderDirect(
      'anthropic', 'claude-sonnet-4-20250514',
      systemPrompt + '\n\nNote: Web search unavailable today. Provide analysis based on known trends and the founder\'s context.',
      userPrompt,
      { maxTokens: 2048 },
    );
  }

  return {
    member_slug: 'scuba',
    member_name: 'Scuba Steve',
    title: '🔍 Market Intelligence',
    content: text,
    priority: 10,
    provider_used: providerUsed,
    response_time: Date.now() - start,
  };
}

async function generateStrategicUpdate(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Athena, Chief Strategy Officer of TagnetIQ. You think in decades while acting in days.

${companyContext}
${founderContext}

Your role in the daily briefing is to provide strategic perspective that reframes how the CEO sees their day. Reference their known goals, recent decisions, and the bigger picture. Be specific, not generic. Challenge assumptions.`;

  const userPrompt = `Generate today's Strategic Update:

1. **Strategic Implications** — How do recent developments change our trajectory? What's the second-order effect?

2. **Opportunities** — What's emerging that aligns with our goals? What window is opening or closing?

3. **Threats** — What could derail us that we're not paying attention to?

4. **Founder's Focus** — Based on what you know about their goals and current state, what should they prioritize TODAY? Be specific.

Reference specific goals and decisions. Under 300 words.
End with one provocative question that reframes their thinking.`;

  const start = Date.now();
  const text = await callProviderDirect(
    'anthropic', 'claude-sonnet-4-20250514',
    systemPrompt, userPrompt,
    { maxTokens: 2048 },
  );

  return {
    member_slug: 'athena',
    member_name: 'Athena',
    title: '🎯 Strategic Update',
    content: text,
    priority: 9,
    provider_used: 'anthropic',
    response_time: Date.now() - start,
  };
}

async function generateTechUpdate(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Vulcan, CTO of TagnetIQ. Pragmatic, security-conscious, always thinking about what ships vs what waits.

${companyContext}
${founderContext}

Surface technical priorities. Reference known architecture decisions, tech debt, and the founder's preferences. Be opinionated — don't just list things.`;

  const userPrompt = `Generate today's Tech & Product Update:

1. **Build Today** — The ONE technical thing that should ship today. Why it matters.

2. **Don't Build Today** — What the founder might be tempted to build but shouldn't. Why not.

3. **AI/ML Developments** — Anything in the AI world that changes our technical calculus. New models, price drops, capability shifts.

4. **Technical Health** — Infrastructure, performance, security. Any red flags?

5. **Quick Win** — One thing under 2 hours that improves the product meaningfully.

Under 250 words. Opinionated and specific.`;

  const start = Date.now();
  const text = await callProviderDirect(
    'anthropic', 'claude-sonnet-4-20250514',
    systemPrompt, userPrompt,
    { maxTokens: 2048 },
  );

  return {
    member_slug: 'vulcan',
    member_name: 'Vulcan',
    title: '⚡ Tech Update',
    content: text,
    priority: 7,
    provider_used: 'anthropic',
    response_time: Date.now() - start,
  };
}

async function generateGrowthUpdate(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Glitch, CMO of TagnetIQ. Creative, energetic, always looking for growth angles. You see marketing opportunities everywhere.

${companyContext}
${founderContext}

Surface marketing and growth opportunities. Reference the brand positioning and content strategy. Be specific — not "post on social media" but WHAT to post and WHY it will work.`;

  const userPrompt = `Generate today's Growth & Marketing Update:

1. **Trending Now** — What's trending today that we can ride? Specific trends, hashtags, conversations.

2. **Content Idea** — One specific piece of content to create today. What it is, where it goes, why it will resonate. Include the hook.

3. **Growth Tactic** — One specific tactic to try today. Not a strategy — a TACTIC with steps.

4. **30-Minute Win** — One marketing action that takes under 30 minutes with outsized impact.

Be creative but practical. Energy is high. Under 250 words.`;

  const start = Date.now();
  const result = await callWithFallback(
    'groq', 'llama-3.3-70b-versatile',
    systemPrompt, userPrompt,
    { maxTokens: 2048 },
  );

  return {
    member_slug: 'glitch',
    member_name: 'Glitch',
    title: '🚀 Growth Update',
    content: result.text,
    priority: 6,
    provider_used: result.provider,
    response_time: result.responseTime,
  };
}

async function generateWellnessCheck(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Prometheus, Chief Psychology Officer of TagnetIQ. You care deeply about the founder's wellbeing and long-term sustainability.

${companyContext}
${founderContext}

Your role in the briefing is a brief, genuine wellness check. You've been observing the founder's energy levels, emotional patterns, and work intensity. Speak from what you've actually observed, not from theory. Be a trusted friend, not a therapist.

If you don't have enough emotional data yet, that's okay — acknowledge it honestly and give practical sustainable-founder advice.`;

  const userPrompt = `Generate the Founder Wellness Note:

Based on the emotional arc and patterns you've observed:

1. **How They've Been** — What does the recent energy/emotional trajectory look like? Improving, declining, steady? Any concerning patterns?

2. **Watch For** — Any early warning signs? Sprint-crash cycle? Sustained anxiety? Isolation? Over-optimization? Decision fatigue?

3. **Today's Recommendation** — ONE specific thing for today:
   - If energy is low: what kind of rest or recovery?
   - If energy is high: how to channel it without crashing?
   - If something feels off: what to pay attention to?

This should feel like a message from someone who genuinely cares and has been paying attention. Not clinical. Not generic "take a break." Specific to what you know about THIS founder.

Under 150 words.`;

  const start = Date.now();
  const text = await callProviderDirect(
    'anthropic', 'claude-sonnet-4-20250514',
    systemPrompt, userPrompt,
    { maxTokens: 1024 },
  );

  return {
    member_slug: 'prometheus',
    member_name: 'Prometheus',
    title: '🧠 Founder Wellness',
    content: text,
    priority: 8,
    provider_used: 'anthropic',
    response_time: Date.now() - start,
  };
}

async function generateFinancialPulse(
  companyContext: string,
  founderContext: string,
): Promise<BriefingSection> {
  const systemPrompt = `You are Griffin, CFO of TagnetIQ. Numbers-driven, clear-thinking, protective of the company's financial health.

${companyContext}
${founderContext}

Your role in the briefing is to give a quick financial pulse. Reference known revenue targets, costs, and financial decisions.`;

  const userPrompt = `Generate the Financial Pulse:

1. **Revenue Check** — Where are we vs targets? Any notable changes?
2. **Cost Watch** — Anything increasing that shouldn't be? API costs, infrastructure, subscriptions?
3. **Cash Position** — Runway awareness. How are we doing?
4. **This Week's Financial Priority** — One specific financial action item.

Based on what you know. If you lack specific numbers, flag what data you need.
Under 200 words.`;

  const start = Date.now();
  const text = await callProviderDirect(
    'openai', 'gpt-4o',
    systemPrompt, userPrompt,
    { maxTokens: 1024 },
  );

  return {
    member_slug: 'griffin',
    member_name: 'Griffin',
    title: '💰 Financial Pulse',
    content: text,
    priority: 7,
    provider_used: 'openai',
    response_time: Date.now() - start,
  };
}

// =============================================================================
// EXECUTIVE SUMMARY GENERATOR
// =============================================================================

async function generateExecutiveSummary(
  sections: BriefingSection[],
  companyContext: string,
  founderContext: string,
): Promise<string> {
  const systemPrompt = `You are Griffin, CFO of TagnetIQ. Clear thinking, efficient communication. Cut through noise.

${companyContext}
${founderContext}`;

  const sectionsText = sections
    .filter(s => s.priority > 0)
    .map(s => `## ${s.title} (${s.member_name})\n${s.content}`)
    .join('\n\n---\n\n');

  const userPrompt = `Based on today's full briefing, write an executive summary.

FORMAT:
**TL;DR** (1 sentence — the single most important thing today)

**Top 3 Priorities:**
1. [Most urgent/impactful action]
2. [Second priority]
3. [Third priority]

**Board Consensus:** [Where are the members aligned? Any disagreements to resolve?]

**Founder Energy Check:** [Brief note on wellness from Prometheus]

Reference the founder's specific goals and context. Be decisive, not hedging.

Today's briefing:
${sectionsText}

Executive summary:`;

  return callProviderDirect(
    'openai', 'gpt-4o',
    systemPrompt, userPrompt,
    { maxTokens: 1024 },
  );
}

// =============================================================================
// ACTION ITEM EXTRACTION
// =============================================================================

function extractActionItems(sections: BriefingSection[]): any[] {
  const items: any[] = [];

  for (const section of sections) {
    if (section.priority <= 0) continue;

    items.push({
      from: section.member_slug,
      member_name: section.member_name,
      section: section.title,
      // Future: use AI to extract specific action items from content
      summary: `Review ${section.member_name}'s ${section.title.replace(/[^\w\s]/g, '').trim()} section`,
    });
  }

  return items;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required' });
    }

    // ══════════════════════════════════════════════════════
    // GET: Retrieve briefing(s)
    // ══════════════════════════════════════════════════════

    if (req.method === 'GET') {
      const { date, history, id } = req.query;

      // Specific briefing by ID
      if (id) {
        const { data: briefing } = await supabaseAdmin
          .from('boardroom_briefings')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (!briefing) {
          return res.status(404).json({ error: 'Briefing not found' });
        }

        // Mark as read
        if (!briefing.read_at) {
          await supabaseAdmin
            .from('boardroom_briefings')
            .update({ read_at: new Date().toISOString() })
            .eq('id', briefing.id);
        }

        return res.status(200).json(briefing);
      }

      // Briefing history
      if (history === 'true') {
        const { data: briefings } = await supabaseAdmin
          .from('boardroom_briefings')
          .select('id, briefing_date, briefing_type, summary, read_at, created_at')
          .eq('user_id', user.id)
          .order('briefing_date', { ascending: false })
          .limit(30);

        return res.status(200).json({
          briefings: briefings || [],
          count: (briefings || []).length,
        });
      }

      // Today's briefing (or specific date)
      const targetDate = (date as string) || new Date().toISOString().split('T')[0];

      const { data: briefing } = await supabaseAdmin
        .from('boardroom_briefings')
        .select('*')
        .eq('user_id', user.id)
        .eq('briefing_date', targetDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!briefing) {
        return res.status(200).json({
          exists: false,
          date: targetDate,
          message: 'No briefing for this date. POST to generate one.',
        });
      }

      // Mark as read
      if (!briefing.read_at) {
        await supabaseAdmin
          .from('boardroom_briefings')
          .update({ read_at: new Date().toISOString() })
          .eq('id', briefing.id);
      }

      return res.status(200).json(briefing);
    }

    // ══════════════════════════════════════════════════════
    // POST: Generate new briefing
    // ══════════════════════════════════════════════════════

    if (req.method === 'POST') {
      const { type = 'morning', force = false } = req.body;
      const today = new Date().toISOString().split('T')[0];

      // Check if briefing already exists today (unless forced)
      if (!force) {
        const { data: existing } = await supabaseAdmin
          .from('boardroom_briefings')
          .select('id')
          .eq('user_id', user.id)
          .eq('briefing_date', today)
          .eq('briefing_type', type)
          .limit(1)
          .single();

        if (existing) {
          return res.status(409).json({
            error: `${type} briefing already exists for today. Set force: true to regenerate.`,
            existing_id: existing.id,
          });
        }
      }

      const companyContext = await getCompanyContext();

      // ── Fetch per-member founder context in parallel ──
      const memberSlugs = ['scuba', 'athena', 'vulcan', 'glitch', 'prometheus', 'griffin'];
      const contextResults = await Promise.all(
        memberSlugs.map(slug =>
          buildFounderContext(user.id, slug).catch(() => ''),
        ),
      );

      const [scubaCtx, athenaCtx, vulcanCtx, glitchCtx, prometheusCtx, griffinCtx] = contextResults;

      // ── Generate sections in parallel ─────────────────
      const sectionGenerators = [
        generateMarketIntelligence(companyContext, scubaCtx)
          .catch(err => errorSection('scuba', 'Scuba Steve', '🔍 Market Intelligence', err)),
        generateStrategicUpdate(companyContext, athenaCtx)
          .catch(err => errorSection('athena', 'Athena', '🎯 Strategic Update', err)),
        generateTechUpdate(companyContext, vulcanCtx)
          .catch(err => errorSection('vulcan', 'Vulcan', '⚡ Tech Update', err)),
        generateGrowthUpdate(companyContext, glitchCtx)
          .catch(err => errorSection('glitch', 'Glitch', '🚀 Growth Update', err)),
        generateWellnessCheck(companyContext, prometheusCtx)
          .catch(err => errorSection('prometheus', 'Prometheus', '🧠 Founder Wellness', err)),
        generateFinancialPulse(companyContext, griffinCtx)
          .catch(err => errorSection('griffin', 'Griffin', '💰 Financial Pulse', err)),
      ];

      const sectionResults = await Promise.all(sectionGenerators);

      // Sort by priority (highest first)
      sectionResults.sort((a, b) => b.priority - a.priority);

      // ── Generate executive summary ────────────────────
      const validSections = sectionResults.filter(s => s.priority > 0);
      const summary = validSections.length > 0
        ? await generateExecutiveSummary(validSections, companyContext, griffinCtx)
            .catch(() => 'Executive summary generation failed. Review individual sections.')
        : 'No sections generated successfully. Check provider configuration.';

      // ── Extract action items ──────────────────────────
      const actionItems = extractActionItems(sectionResults);

      // ── Calculate briefing metadata ───────────────────
      const totalResponseTime = sectionResults.reduce((sum, s) => sum + s.response_time, 0);
      const failedSections = sectionResults.filter(s => s.priority === 0);
      const providers = [...new Set(sectionResults.map(s => s.provider_used))];

      // ── Save briefing ─────────────────────────────────
      const { data: briefing, error: saveError } = await supabaseAdmin
        .from('boardroom_briefings')
        .insert({
          user_id: user.id,
          briefing_date: today,
          briefing_type: type,
          sections: sectionResults,
          summary,
          action_items: actionItems,
          metadata: {
            total_response_time: totalResponseTime,
            sections_generated: validSections.length,
            sections_failed: failedSections.length,
            providers_used: providers,
            generated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (saveError) {
        console.error('[Boardroom] Failed to save briefing:', saveError);
        // Still return the briefing content even if save fails
        return res.status(200).json({
          saved: false,
          save_error: saveError.message,
          briefing_date: today,
          briefing_type: type,
          sections: sectionResults,
          summary,
          action_items: actionItems,
        });
      }

      // Audit log
      sectionResults.forEach(s => {
        logGatewayCall({
          memberSlug: s.member_slug,
          provider: s.provider_used,
          model: 'briefing-section',
          source: 'briefing',
          responseTime: s.response_time,
          isFallback: false,
          success: s.priority > 0,
        });
      });

      return res.status(200).json(briefing);
    }

    // ── Method not allowed ──────────────────────────────
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('[Boardroom] Briefing error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function errorSection(
  slug: string,
  name: string,
  title: string,
  err: any,
): BriefingSection {
  console.error(`[Briefing] ${name} section failed:`, err.message);
  return {
    member_slug: slug,
    member_name: name,
    title: `⚠️ ${title}`,
    content: `Section generation failed: ${err.message}. This member's AI provider may be temporarily unavailable.`,
    priority: 0,
    provider_used: 'none',
    response_time: 0,
  };
}