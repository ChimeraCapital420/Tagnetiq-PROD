// FILE: api/investor/invite.ts
// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR INVITE — Creates invite tokens for external investors
// ═══════════════════════════════════════════════════════════════════════════════
//
// investor_invites schema:
//   id (uuid), inviter_id (uuid), token (text), expires_at (timestamptz),
//   mode (text), created_by (uuid), revoked (boolean), created_at (timestamptz)
//
// SECURITY: Requires Bearer JWT + admin or investor role
// ═══════════════════════════════════════════════════════════════════════════════

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { randomBytes } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Verify the user is authenticated.
    const inviter = await verifyUser(req);

    // 2. SECURITY: Verify the inviter has the correct role.
    const { data: profile, error: profileError } = await supaAdmin
      .from('profiles')
      .select('role')
      .eq('id', inviter.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Could not verify inviter role.');
    }

    if (profile.role !== 'admin' && profile.role !== 'investor') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to invite investors.' });
    }

    // 3. Get invite details from request body.
    const { email: inviteeEmail, mode: inviteMode } = req.body;

    if (!inviteeEmail || typeof inviteeEmail !== 'string') {
      return res.status(400).json({ error: 'A valid email is required.' });
    }

    // 4. Generate a secure random token
    const inviteToken = randomBytes(24).toString('hex');

    // 5. Set expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 6. Insert into investor_invites using actual schema columns
    const { error: insertError } = await supaAdmin
      .from('investor_invites')
      .insert({
        inviter_id: inviter.id,
        created_by: inviter.id,
        token: inviteToken,
        mode: inviteMode || 'standard',
        revoked: false,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'A duplicate invite token was generated. Please try again.' });
      }
      throw insertError;
    }

    // 7. Send the Supabase auth invite email
    const { error: inviteError } = await supaAdmin.auth.admin.inviteUserByEmail(inviteeEmail);

    if (inviteError) {
      if (inviteError.message.includes('User already registered')) {
        // Don't delete the invite token — the investor can still use the portal link
        return res.status(200).json({
          success: true,
          message: `User already registered. Portal link created for ${inviteeEmail}.`,
          token: inviteToken,
          portalUrl: `${process.env.VITE_APP_URL || ''}/investor/portal?t=${inviteToken}`,
        });
      }
      // Clean up the invite row if email sending failed
      await supaAdmin.from('investor_invites').delete().eq('token', inviteToken);
      throw inviteError;
    }

    return res.status(200).json({
      success: true,
      message: `Invite successfully sent to ${inviteeEmail}.`,
      token: inviteToken,
      portalUrl: `${process.env.VITE_APP_URL || ''}/investor/portal?t=${inviteToken}`,
    });

  } catch (error: any) {
    console.error('Error in investor invite endpoint:', error);
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    return res.status(500).json({ error: message });
  }
}