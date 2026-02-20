// FILE: api/boardroom/standup.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD STANDUP — Async Daily Check-ins from Every Member
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 5: Each board member posts an async standup every morning.
// The CEO reads them on their phone over coffee.
//
// GET  /api/boardroom/standup              — Today's standup entries
// GET  /api/boardroom/standup?date=...     — Specific date
// GET  /api/boardroom/standup?history=true — Last 7 days summary
// POST /api/boardroom/standup              — Trigger manual generation
//
// Mobile-first: responses are compact for phone rendering.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import {
  callWithFallback,
  getSupaAdmin,
  getCompanyContext,
} from './lib/provider-caller.js';
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

interface StandupEntry {
  id: string;
  member_slug: string;
  entry_date: string;
  content: string;
  priority_items: string[];
  blockers: string[];
  wins: string[];
  provider_used: string;
  response_time: number;
  created_at: string;
}

// =============================================================================
// MEMBER DISPLAY NAMES
// =============================================================================

const MEMBER_NAMES: Record<string, string> = {
  athena: 'Athena (CSO)', griffin: 'Griffin (CFO)', scuba: 'Scuba Steve (CRO)',
  glitch: 'Glitch (CMO)', lexicoda: 'Lexicoda (CLO)', vulcan: 'Vulcan (CTO)',
  leo: 'LEO (CDO)', cerebro: 'Cerebro (CHRO)', aegle: 'Aegle (CWO)',
  janus: 'Janus (CIO)', legolas: 'Legolas (CProdO)', orion: 'Orion (CKO)',
  sal: 'Sal (COO)', sha1: 'SHA-1 (CPO)', prometheus: 'Prometheus (CPsyO)',
};

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required' });
    }

    // ══════════════════════════════════════════════════════
    // GET: Retrieve standup entries
    // ══════════════════════════════════════════════════════

    if (req.method === 'GET') {
      const { date, history, member } = req.query;

      // ── History mode: last 7 days of standups ─────────
      if (history === 'true') {
        const since = new Date();
        since.setDate(since.getDate() - 7);

        const { data: entries } = await supabaseAdmin
          .from('boardroom_standup_entries')
          .select('member_slug, entry_date, content, priority_items, blockers, wins')
          .eq('user_id', user.id)
          .gte('entry_date', since.toISOString().split('T')[0])
          .order('entry_date', { ascending: false });

        // Group by date
        const grouped: Record<string, any[]> = {};
        for (const entry of (entries || [])) {
          const d = entry.entry_date;
          if (!grouped[d]) grouped[d] = [];
          grouped[d].push({
            ...entry,
            member_name: MEMBER_NAMES[entry.member_slug] || entry.member_slug,
          });
        }

        return res.status(200).json({
          days: Object.entries(grouped).map(([date, entries]) => ({
            date,
            entries,
            has_blockers: entries.some((e: any) => (e.blockers || []).length > 0),
          })),
          total_days: Object.keys(grouped).length,
        });
      }

      // ── Specific date or today ────────────────────────
      const targetDate = (date as string) || new Date().toISOString().split('T')[0];

      let query = supabaseAdmin
        .from('boardroom_standup_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', targetDate)
        .order('created_at', { ascending: true });

      // Filter by member if requested
      if (member && typeof member === 'string') {
        query = query.eq('member_slug', member);
      }

      const { data: entries } = await query;

      if (!entries || entries.length === 0) {
        return res.status(200).json({
          date: targetDate,
          exists: false,
          entries: [],
          message: 'No standup entries for this date. POST to generate.',
        });
      }

      // Enrich with member names + compute summary
      const enriched = entries.map(e => ({
        ...e,
        member_name: MEMBER_NAMES[e.member_slug] || e.member_slug,
      }));

      const allBlockers = enriched
        .flatMap(e => (e.blockers || []).map((b: string) => ({
          member: e.member_slug,
          member_name: e.member_name,
          blocker: b,
        })))
        .filter(b => b.blocker);

      const allWins = enriched
        .flatMap(e => (e.wins || []).map((w: string) => ({
          member: e.member_slug,
          member_name: e.member_name,
          win: w,
        })))
        .filter(w => w.win);

      return res.status(200).json({
        date: targetDate,
        exists: true,
        entries: enriched,
        summary: {
          total_members: enriched.length,
          blockers: allBlockers,
          wins: allWins,
          has_blockers: allBlockers.length > 0,
        },
      });
    }

    // ══════════════════════════════════════════════════════
    // POST: Trigger standup generation
    // ══════════════════════════════════════════════════════

    if (req.method === 'POST') {
      const { force = false, members: requestedMembers } = req.body || {};
      const today = new Date().toISOString().split('T')[0];

      // Check if standup already exists today
      if (!force) {
        const { data: existing } = await supabaseAdmin
          .from('boardroom_standup_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('entry_date', today)
          .limit(1);

        if (existing && existing.length > 0) {
          return res.status(409).json({
            error: 'Standup already generated for today. Set force: true to regenerate.',
            date: today,
            existing_count: existing.length,
          });
        }
      }

      // If force=true, delete existing entries for today
      if (force) {
        await supabaseAdmin
          .from('boardroom_standup_entries')
          .delete()
          .eq('user_id', user.id)
          .eq('entry_date', today);
      }

      // Fetch active members
      const memberFilter = Array.isArray(requestedMembers) && requestedMembers.length > 0
        ? requestedMembers
        : null;

      let membersQuery = supabaseAdmin
        .from('boardroom_members')
        .select('slug, name, title, role, expertise, personality, voice_style, personality_evolution')
        .eq('is_active', true);

      if (memberFilter) {
        membersQuery = membersQuery.in('slug', memberFilter);
      }

      const { data: members } = await membersQuery;

      if (!members || members.length === 0) {
        return res.status(400).json({ error: 'No active members found' });
      }

      const companyContext = await getCompanyContext();

      // Fetch lean founder context
      const feed = await getCrossBoardFeed(supabaseAdmin, user.id, '', 3, 5).catch(() => []);
      const founderContext = feed.length > 0
        ? '\n## RECENT BOARD ACTIVITY\n' + feed.map(f => `- ${f.member_slug}: ${f.summary}`).join('\n')
        : '';

      // Generate standups in parallel batches
      const batchSize = 5;
      const results: Array<{
        member_slug: string;
        success: boolean;
        content?: string;
        error?: string;
      }> = [];

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
  "update": "2-3 sentences on what's happening in your area today. Be specific.",
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

              // Save to DB
              await supabaseAdmin
                .from('boardroom_standup_entries')
                .insert({
                  user_id: user.id,
                  member_slug: member.slug,
                  entry_date: today,
                  content: String(parsed.update || result.text).substring(0, 1000),
                  priority_items: (parsed.priorities || []).map((p: any) => String(p).substring(0, 200)).slice(0, 3),
                  blockers: (parsed.blockers || []).map((b: any) => String(b).substring(0, 200)).slice(0, 3),
                  wins: (parsed.wins || []).map((w: any) => String(w).substring(0, 200)).slice(0, 3),
                  provider_used: result.provider,
                  response_time: result.responseTime,
                });

              return {
                member_slug: member.slug,
                success: true,
                content: parsed.update || result.text,
              };
            } catch (err: any) {
              console.warn(`[Standup] ${member.slug} failed:`, err.message);
              return {
                member_slug: member.slug,
                success: false,
                error: err.message,
              };
            }
          }),
        );

        results.push(...batchResults);
      }

      const successCount = results.filter(r => r.success).length;

      return res.status(200).json({
        date: today,
        generated: successCount,
        failed: results.length - successCount,
        results: results.map(r => ({
          member: r.member_slug,
          member_name: MEMBER_NAMES[r.member_slug] || r.member_slug,
          success: r.success,
          preview: r.content?.substring(0, 150),
          error: r.error,
        })),
      });
    }

    // ── Method not allowed ──────────────────────────────
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('[Standup] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}