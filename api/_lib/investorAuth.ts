// FILE: api/_lib/investorAuth.ts
// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR AUTH — Dual-path verification for investor routes
// ═══════════════════════════════════════════════════════════════════════════════
//
// Two access paths:
//   1. ADMIN (Bearer JWT) — logged-in admin/investor viewing InvestorSuite
//   2. TOKEN (query param) — external investor with invite link ?token=xxx
//
// investor_invites schema:
//   id (uuid), inviter_id (uuid), token (text), expires_at (timestamptz),
//   mode (text), created_by (uuid), revoked (boolean), created_at (timestamptz)
//
// Usage:
//   const access = await verifyInvestorAccess(req);
//   // access.userId, access.accessType, access.accessLevel
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { VercelRequest } from '@vercel/node';
import { supaAdmin } from './supaAdmin.js';

export interface InvestorAccess {
  userId: string | null;
  accessType: 'admin' | 'invite_token';
  accessLevel: 'full' | 'readonly';
  email?: string;
}

/**
 * Verifies investor access via JWT (admin/investor role) or invite token.
 * Throws on failure — caller should catch and return 401/403.
 */
export async function verifyInvestorAccess(req: VercelRequest): Promise<InvestorAccess> {
  // ── Path 1: Bearer JWT (admin or investor role) ──────────────────────
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = authHeader.split(' ')[1];
    if (jwt && jwt.length >= 10) {
      const { data: { user }, error } = await supaAdmin.auth.getUser(jwt);
      if (user && !error) {
        const { data: profile } = await supaAdmin
          .from('profiles')
          .select('role, account_status')
          .eq('id', user.id)
          .single();

        if (!profile) {
          throw new Error('Authentication error: Profile not found.');
        }

        const status = profile.account_status || 'active';
        if (status === 'suspended' || status === 'locked') {
          throw new Error('Authentication error: Account suspended.');
        }

        if (profile.role === 'admin' || profile.role === 'investor') {
          return {
            userId: user.id,
            accessType: 'admin',
            accessLevel: 'full',
            email: user.email,
          };
        }

        // Authenticated user but not admin/investor role
        throw new Error('Authorization error: Investor or admin role required.');
      }
    }
  }

  // ── Path 2: Invite token (?token=xxx or ?t=xxx) ─────────────────────
  const inviteToken = (req.query.token as string) || (req.query.t as string) || '';
  if (inviteToken && inviteToken.length >= 8) {
    const { data: invite, error: inviteError } = await supaAdmin
      .from('investor_invites')
      .select('id, token, revoked, expires_at')
      .eq('token', inviteToken)
      .eq('revoked', false)
      .single();

    if (invite && !inviteError) {
      // Check expiry if set
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw new Error('Authentication error: Invite token has expired.');
      }

      return {
        userId: null,
        accessType: 'invite_token',
        accessLevel: 'readonly',
      };
    }
  }

  // ── Neither path worked ──────────────────────────────────────────────
  throw new Error('Authentication error: Valid admin session or investor token required.');
}

/**
 * Lightweight CORS setup for investor routes.
 * Restricts to same-origin + specific allowed origins instead of wildcard.
 */
export function setInvestorCORS(req: VercelRequest, res: any): boolean {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    process.env.VITE_APP_URL || '',
    'https://tagnetiq.com',
    'https://www.tagnetiq.com',
    'https://tagnetiq.vercel.app',
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}