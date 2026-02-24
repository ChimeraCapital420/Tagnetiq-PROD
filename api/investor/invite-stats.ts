// FILE: api/investor/invite-stats.ts
// ═══════════════════════════════════════════════════════════════════════════════
// INVITE STATS — Shows invite metrics for the admin who sent them
// ═══════════════════════════════════════════════════════════════════════════════
//
// investor_invites schema:
//   id (uuid), inviter_id (uuid), token (text), expires_at (timestamptz),
//   mode (text), created_by (uuid), revoked (boolean), created_at (timestamptz)
//
// SECURITY: Uses standard verifyUser (JWT auth)
// ═══════════════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Fetch investor invites created by this user
    const { data: invites, error: invitesError } = await supaAdmin
      .from('investor_invites')
      .select('id, token, revoked, expires_at, mode, created_at')
      .eq('inviter_id', user.id)
      .order('created_at', { ascending: false });

    if (invitesError) throw invitesError;

    const allInvites = invites || [];
    const now = new Date();

    const totalSent = allInvites.length;
    const activeInvites = allInvites.filter(i => !i.revoked && (!i.expires_at || new Date(i.expires_at) > now)).length;
    const revokedInvites = allInvites.filter(i => i.revoked).length;
    const expiredInvites = allInvites.filter(i => !i.revoked && i.expires_at && new Date(i.expires_at) <= now).length;

    const stats = {
      totalSent,
      activeInvites,
      revokedInvites,
      expiredInvites,
    };

    // Return sanitized invite list (no full tokens exposed)
    const sanitizedInvites = allInvites.map(i => ({
      id: i.id,
      tokenPreview: i.token ? `${i.token.slice(0, 8)}...` : null,
      mode: i.mode,
      revoked: i.revoked,
      expiresAt: i.expires_at,
      createdAt: i.created_at,
      status: i.revoked
        ? 'revoked'
        : (i.expires_at && new Date(i.expires_at) <= now)
          ? 'expired'
          : 'active',
    }));

    return res.status(200).json({
      stats,
      invites: sanitizedInvites,
    });

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error fetching invite stats:', msg);
    return res.status(500).json({ error: msg });
  }
}