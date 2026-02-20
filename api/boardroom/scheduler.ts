// FILE: api/boardroom/scheduler.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD SCHEDULER — Cron-Triggered Autonomous Events
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 5: The board convenes on schedule, not just when the CEO remembers.
//
// Vercel Cron hits this endpoint with ?type=morning_briefing|standup|evening_debrief
// The scheduler:
//   1. Validates cron_secret
//   2. Queries all active boardroom users
//   3. For each user, triggers the appropriate generation
//   4. Saves results to DB
//
// SCHEDULE (UTC → MST):
//   morning_briefing:  0 14 * * *  (7 AM MST)
//   standup:           0 16 * * *  (9 AM MST)
//   evening_debrief:   0  1 * * *  (6 PM MST)
//
// This endpoint is NOT user-authenticated. It uses CRON_SECRET for auth
// and service_role Supabase for DB access.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  callProviderDirect,
  callWithFallback,
  getSupaAdmin,
  getCompanyContext,
  logGatewayCall,
} from './lib/provider-caller.js';
import { buildBriefingPrompt } from './lib/prompt-builder.js';
import {
  getFounderMemory,
  getCrossBoardFeed,
} from '../../src/lib/boardroom/memory/founder-memory.js';

export const config = {
  maxDuration: 60,
};

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// TYPES
// =============================================================================

interface ScheduleUser {
  user_id: string;
  access_level: string;
}

interface StandupResult {
  member_slug: string;
  content: string;
  priority_items: string[];
  blockers: string[];
  wins: string[];
  provider_used: string;
  response_time: number;
}

// =============================================================================
// CRON SECRET VALIDATION
// =============================================================================

function validateCronSecret(req: VercelRequest): boolean {
  const secret = req.query.cron_secret || req.headers['x-cron-secret'];
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    console.warn('[Scheduler] CRON_SECRET not configured. Rejecting.');
    return false;
  }

  return secret === expected;
}

// =============================================================================
// GET ACTIVE BOARDROOM USERS
// =============================================================================

async function getActiveUsers(): Promise<ScheduleUser[]> {
  const { data, error } = await supabaseAdmin
    .from('boardroom_access')
    .select('user_id, access_level')
    .or('expires_at.is.null,expires_at.gt.now()');

  if (error || !data) {
    console.warn('[Scheduler] Failed to fetch active users:', error?.message);
    return [];
  }

  return data;
}

// =============================================================================
// CHECK IF ALREADY GENERATED TODAY
// =============================================================================

async function hasScheduleRunToday(
  userId: string,
  scheduleType: string,
): Promise<boolean> {
  const { data: schedule } = await supabaseAdmin
    .from('boardroom_schedule')
    .select('last_triggered_at')
    .eq('user_id', userId)
    .eq('schedule_type', scheduleType)
    .eq('is_active', true)
    .single();

  if (!schedule?.last_triggered_at) return false;

  const lastRun = new Date(schedule.last_triggered_at);
  const now = new Date();

  // Same calendar day (UTC)
  return (
    lastRun.getUTCFullYear() === now.getUTCFullYear() &&
    lastRun.getUTCMonth() === now.getUTCMonth() &&
    lastRun.getUTCDate() === now.getUTCDate()
  );
}

// =============================================================================
// MARK SCHEDULE AS TRIGGERED
// =============================================================================

async function markTriggered(userId: string, scheduleType: string): Promise<void> {
  // Upsert — creates the schedule record if it doesn't exist
  await supabaseAdmin
    .from('boardroom_schedule')
    .upsert(
      {
        user_id: userId,
        schedule_type: scheduleType,
        is_active: true,
        last_triggered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,schedule_type' }
    )
    .then(() => {})
    .catch((err) => {
      console.warn(`[Scheduler] Failed to mark triggered:`, err.message);
    });
}

// =============================================================================
// BRIEFING GENERATION (lean cron version)
// =============================================================================
// Uses buildBriefingPrompt from prompt-builder.ts + callWithFallback.
// Simpler than the full briefing.ts handler but produces the same DB rows.

const BRIEFING_MEMBERS = [
  { slug: 'scuba', name: 'Scuba Steve', title: 'Director of Deep Research', provider: 'perplexity', model: 'sonar-pro', fallbackProvider: 'anthropic', fallbackModel: 'claude-sonnet-4-20250514' },
  { slug: 'athena', name: 'Athena', title: 'Chief Strategy Officer', provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { slug: 'vulcan', name: 'Vulcan', title: 'Chief Technology Officer', provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { slug: 'glitch', name: 'Glitch', title: 'Chief Marketing Officer', provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { slug: 'prometheus', name: 'Prometheus', title: 'Chief Psychology Officer', provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  { slug: 'griffin', name: 'Griffin', title: 'Chief Financial Officer', provider: 'openai', model: 'gpt-4o' },
];

async function generateBriefingForUser(
  userId: string,
  briefingType: 'morning' | 'evening' | 'weekly',
): Promise<{ success: boolean; briefingId?: string; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  // Check if briefing already exists today
  const { data: existing } = await supabaseAdmin
    .from('boardroom_briefings')
    .select('id')
    .eq('user_id', userId)
    .eq('briefing_date', today)
    .eq('briefing_type', briefingType)
    .limit(1)
    .single();

  if (existing) {
    return { success: true, briefingId: existing.id };
  }

  const companyContext = await getCompanyContext();

  // Fetch all members from DB for buildBriefingPrompt
  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('id, slug, name, title, role, ai_provider, expertise, personality, voice_style, personality_evolution, evolved_prompt, total_interactions')
    .eq('is_active', true)
    .in('slug', BRIEFING_MEMBERS.map(m => m.slug));

  const memberMap = new Map((members || []).map(m => [m.slug, m]));

  // Generate sections in parallel
  const sectionPromises = BRIEFING_MEMBERS.map(async (cfg) => {
    const dbMember = memberMap.get(cfg.slug);
    if (!dbMember) {
      return {
        member_slug: cfg.slug,
        member_name: cfg.name,
        title: `⚠️ ${cfg.name}`,
        content: 'Member not found in database.',
        priority: 0,
        provider_used: 'none',
        response_time: 0,
      };
    }

    // Fetch founder context for this member
    const founderMemory = await getFounderMemory(supabaseAdmin, userId, cfg.slug).catch(() => null);
    let founderContext = '';
    if (founderMemory) {
      const details = (founderMemory.founder_details || [])
        .filter((d: any) => d.confidence >= 0.7)
        .slice(-8);
      if (details.length > 0) {
        founderContext = '\n## FOUNDER CONTEXT\n' +
          details.map((d: any) => `- ${d.key}: ${d.value}`).join('\n');
      }
    }

    const prompt = buildBriefingPrompt(
      dbMember as any,
      briefingType,
      companyContext + founderContext,
    );

    const start = Date.now();
    try {
      const result = await callWithFallback(
        cfg.provider, cfg.model,
        prompt, `Generate your ${briefingType} briefing section.`,
        { maxTokens: 1024, timeoutMs: 20000 },
      );

      return {
        member_slug: cfg.slug,
        member_name: cfg.name,
        title: getSectionTitle(cfg.slug),
        content: result.text,
        priority: getSectionPriority(cfg.slug),
        provider_used: result.provider,
        response_time: result.responseTime,
      };
    } catch (err: any) {
      console.warn(`[Scheduler] Briefing section ${cfg.slug} failed:`, err.message);
      return {
        member_slug: cfg.slug,
        member_name: cfg.name,
        title: `⚠️ ${getSectionTitle(cfg.slug)}`,
        content: `Section generation failed: ${err.message}`,
        priority: 0,
        provider_used: 'none',
        response_time: Date.now() - start,
      };
    }
  });

  const sections = await Promise.all(sectionPromises);
  sections.sort((a, b) => b.priority - a.priority);

  // Generate executive summary from valid sections
  const validSections = sections.filter(s => s.priority > 0);
  let summary = 'No sections generated successfully.';

  if (validSections.length > 0) {
    const summaryInput = validSections
      .map(s => `## ${s.title}\n${s.content}`)
      .join('\n\n');

    try {
      summary = await callProviderDirect(
        'openai', 'gpt-4o-mini',
        'You are Griffin, CFO. Write a concise executive summary. TL;DR first, then top 3 priorities.',
        `Summarize this briefing:\n${summaryInput}`,
        { maxTokens: 512 },
      );
    } catch {
      summary = 'Executive summary generation failed. Review individual sections.';
    }
  }

  // Save to DB
  const { data: briefing, error: saveError } = await supabaseAdmin
    .from('boardroom_briefings')
    .insert({
      user_id: userId,
      briefing_date: today,
      briefing_type: briefingType,
      sections,
      summary,
      action_items: validSections.map(s => ({
        from: s.member_slug,
        member_name: s.member_name,
        section: s.title,
        summary: `Review ${s.member_name}'s section`,
      })),
      metadata: {
        source: 'scheduler',
        sections_generated: validSections.length,
        sections_failed: sections.length - validSections.length,
        providers_used: [...new Set(sections.map(s => s.provider_used))],
        generated_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (saveError) {
    return { success: false, error: saveError.message };
  }

  return { success: true, briefingId: briefing?.id };
}

function getSectionTitle(slug: string): string {
  const titles: Record<string, string> = {
    scuba: '🔍 Market Intelligence',
    athena: '🎯 Strategic Update',
    vulcan: '⚡ Tech Update',
    glitch: '🚀 Growth Update',
    prometheus: '🧠 Founder Wellness',
    griffin: '💰 Financial Pulse',
  };
  return titles[slug] || slug;
}

function getSectionPriority(slug: string): number {
  const priorities: Record<string, number> = {
    scuba: 10, athena: 9, prometheus: 8,
    vulcan: 7, griffin: 7, glitch: 6,
  };
  return priorities[slug] || 5;
}

// =============================================================================
// STANDUP GENERATION
// =============================================================================

const STANDUP_MEMBERS = [
  'athena', 'griffin', 'vulcan', 'glitch', 'sal',
  'lexicoda', 'scuba', 'prometheus', 'cerebro', 'sha1',
  'janus', 'leo', 'aegle', 'legolas', 'orion',
];

async function generateStandupForUser(
  userId: string,
): Promise<{ success: boolean; entries: number; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  // Check if standup already exists today
  const { data: existing } = await supabaseAdmin
    .from('boardroom_standup_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('entry_date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return { success: true, entries: existing.length };
  }

  // Fetch active members
  const { data: members } = await supabaseAdmin
    .from('boardroom_members')
    .select('slug, name, title, role, expertise, personality, voice_style, personality_evolution')
    .eq('is_active', true)
    .in('slug', STANDUP_MEMBERS);

  if (!members || members.length === 0) {
    return { success: false, entries: 0, error: 'No active members found' };
  }

  const companyContext = await getCompanyContext();

  // Fetch founder context (shared across all members for standup)
  const founderContext = await buildLeanFounderContext(userId);

  // Generate standups in parallel (batched to avoid rate limits)
  const batchSize = 5;
  const entries: StandupResult[] = [];

  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (member) => {
        const standupPrompt = `You are ${member.name}, ${member.title}.

${companyContext}
${founderContext}

Generate your daily standup entry. Be concise and specific to YOUR domain.

Return ONLY valid JSON:
{
  "update": "2-3 sentences on what's happening in your area today. Be specific, not generic.",
  "priorities": ["Top priority for today", "Second priority"],
  "blockers": ["Any blockers or concerns (empty array if none)"],
  "wins": ["Recent wins to celebrate (empty array if none)"]
}`;

        const start = Date.now();
        try {
          const result = await callWithFallback(
            'groq', 'llama-3.3-70b-versatile',
            standupPrompt,
            'Generate your daily standup. Respond with ONLY the JSON.',
            { maxTokens: 512, timeoutMs: 10000 },
          );

          let parsed: any;
          try {
            const jsonMatch = result.text.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
          } catch {
            parsed = { update: result.text, priorities: [], blockers: [], wins: [] };
          }

          return {
            member_slug: member.slug,
            content: String(parsed.update || result.text).substring(0, 1000),
            priority_items: (parsed.priorities || []).map((p: any) => String(p).substring(0, 200)).slice(0, 3),
            blockers: (parsed.blockers || []).map((b: any) => String(b).substring(0, 200)).slice(0, 3),
            wins: (parsed.wins || []).map((w: any) => String(w).substring(0, 200)).slice(0, 3),
            provider_used: result.provider,
            response_time: result.responseTime,
          };
        } catch (err: any) {
          console.warn(`[Scheduler] Standup ${member.slug} failed:`, err.message);
          return null;
        }
      }),
    );

    entries.push(...batchResults.filter(Boolean) as StandupResult[]);
  }

  if (entries.length === 0) {
    return { success: false, entries: 0, error: 'All standup generations failed' };
  }

  // Save all entries
  const rows = entries.map(e => ({
    user_id: userId,
    member_slug: e.member_slug,
    entry_date: today,
    content: e.content,
    priority_items: e.priority_items,
    blockers: e.blockers,
    wins: e.wins,
    provider_used: e.provider_used,
    response_time: e.response_time,
  }));

  const { error: insertError } = await supabaseAdmin
    .from('boardroom_standup_entries')
    .insert(rows);

  if (insertError) {
    return { success: false, entries: 0, error: insertError.message };
  }

  return { success: true, entries: entries.length };
}

// =============================================================================
// LEAN FOUNDER CONTEXT (shared by standup generation)
// =============================================================================

async function buildLeanFounderContext(userId: string): Promise<string> {
  const feed = await getCrossBoardFeed(supabaseAdmin, userId, '', 3, 5).catch(() => []);

  if (feed.length === 0) return '';

  return '\n## RECENT BOARD ACTIVITY\n' +
    feed.map(f => `- ${f.member_slug}: ${f.summary}`).join('\n');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only GET (Vercel Cron sends GET requests)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate cron secret
  if (!validateCronSecret(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const scheduleType = req.query.type as string;
  if (!scheduleType) {
    return res.status(400).json({ error: 'Missing ?type= parameter' });
  }

  console.log(`[Scheduler] Triggered: ${scheduleType} at ${new Date().toISOString()}`);

  try {
    // Get all active boardroom users
    const users = await getActiveUsers();

    if (users.length === 0) {
      return res.status(200).json({
        schedule_type: scheduleType,
        users_processed: 0,
        message: 'No active boardroom users found.',
      });
    }

    const results: Array<{ userId: string; success: boolean; detail?: any }> = [];

    for (const user of users) {
      // Check if already run today for this user
      const alreadyRun = await hasScheduleRunToday(user.user_id, scheduleType);
      if (alreadyRun) {
        results.push({ userId: user.user_id, success: true, detail: 'already_run_today' });
        continue;
      }

      let result: { success: boolean; detail?: any };

      switch (scheduleType) {
        case 'morning_briefing':
          const briefingResult = await generateBriefingForUser(user.user_id, 'morning');
          result = { success: briefingResult.success, detail: briefingResult };
          break;

        case 'evening_debrief':
          const debriefResult = await generateBriefingForUser(user.user_id, 'evening');
          result = { success: debriefResult.success, detail: debriefResult };
          break;

        case 'standup':
          const standupResult = await generateStandupForUser(user.user_id);
          result = { success: standupResult.success, detail: standupResult };
          break;

        default:
          result = { success: false, detail: `Unknown schedule type: ${scheduleType}` };
      }

      // Mark as triggered regardless of success (prevents retry storms)
      await markTriggered(user.user_id, scheduleType);

      results.push({ userId: user.user_id, ...result });
    }

    const successCount = results.filter(r => r.success).length;

    console.log(
      `[Scheduler] ${scheduleType} complete: ${successCount}/${results.length} users processed`
    );

    return res.status(200).json({
      schedule_type: scheduleType,
      users_processed: results.length,
      success_count: successCount,
      results,
      triggered_at: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error(`[Scheduler] Fatal error in ${scheduleType}:`, error);
    return res.status(500).json({
      error: error.message,
      schedule_type: scheduleType,
    });
  }
}