// FILE: api/boardroom/status.ts
// Board Status API — view DNA evolution and performance
//
// Sprint M: Admin endpoint to see how the board is evolving
//
// GET — returns all board members with their current DNA, trust, stats
// POST { action: 'member', slug } — detailed stats for one member
// POST { action: 'reset_dna', slug } — reset a member's DNA to defaults

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 15,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify admin access
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access || access.access_level !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    // ── GET: Overview of all members ────────────────────
    if (req.method === 'GET') {
      const { data: members } = await supabaseAdmin
        .from('boardroom_members')
        .select('slug, name, title, role, ai_provider, dominant_provider, ai_dna, trust_level, total_interactions, cross_domain_assists, current_energy, last_active_at, personality_evolution')
        .order('display_order');

      const board = (members || []).map(m => ({
        slug: m.slug,
        name: m.name,
        title: m.title,
        role: m.role,
        primaryProvider: m.ai_provider,
        dominantProvider: m.dominant_provider || m.ai_provider,
        dnaChanged: m.dominant_provider !== null && m.dominant_provider !== m.ai_provider,
        trustLevel: m.trust_level,
        totalInteractions: m.total_interactions,
        crossDomainAssists: m.cross_domain_assists,
        energy: m.current_energy,
        lastActive: m.last_active_at,
        evolutionGeneration: m.personality_evolution?.generation || 0,
        topDna: Object.entries(m.ai_dna || {})
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 3)
          .map(([p, v]) => ({ provider: p, affinity: Math.round((v as number) * 100) + '%' })),
      }));

      return res.status(200).json({
        board,
        totalMembers: board.length,
        totalInteractions: board.reduce((sum, m) => sum + m.totalInteractions, 0),
        totalCrossDomain: board.reduce((sum, m) => sum + m.crossDomainAssists, 0),
        averageTrust: Math.round(board.reduce((sum, m) => sum + m.trustLevel, 0) / Math.max(board.length, 1)),
      });
    }

    // ── POST: Detailed member view or actions ───────────
    if (req.method === 'POST') {
      const { action, slug } = req.body;

      if (action === 'member' && slug) {
        const { data: member } = await supabaseAdmin
          .from('boardroom_members')
          .select('*')
          .eq('slug', slug)
          .single();

        if (!member) return res.status(404).json({ error: 'Member not found.' });

        // Get recent interaction logs
        const { data: logs } = await supabaseAdmin
          .from('board_interaction_log')
          .select('*')
          .eq('member_slug', slug)
          .order('created_at', { ascending: false })
          .limit(20);

        return res.status(200).json({
          member: {
            ...member,
            system_prompt: undefined, // Don't expose full prompt
            evolved_prompt: undefined,
          },
          recentInteractions: logs || [],
        });
      }

      if (action === 'reset_dna' && slug) {
        const { data: member } = await supabaseAdmin
          .from('boardroom_members')
          .select('ai_provider')
          .eq('slug', slug)
          .single();

        if (!member) return res.status(404).json({ error: 'Member not found.' });

        await supabaseAdmin
          .from('boardroom_members')
          .update({
            ai_dna: { [member.ai_provider]: 0.60 },
            dominant_provider: member.ai_provider,
            provider_affinity: {},
            trust_level: 20,
            total_interactions: 0,
            cross_domain_assists: 0,
            personality_evolution: {},
            evolved_prompt: null,
          })
          .eq('slug', slug);

        return res.status(200).json({ success: true, message: `${slug} DNA reset to defaults.` });
      }

      return res.status(400).json({ error: 'Valid actions: "member", "reset_dna"' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Board status error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}