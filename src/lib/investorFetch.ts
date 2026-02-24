// FILE: src/lib/investorFetch.ts
// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR FETCH — Authenticated fetch wrapper for investor endpoints
// ═══════════════════════════════════════════════════════════════════════════════
//
// Usage in components:
//   import { investorFetch } from '@/lib/investorFetch';
//   const response = await investorFetch('/api/investor/kpis', session);
//
// Handles both paths:
//   - Admin (Bearer JWT from session)
//   - Portal (invite token from cookie/URL)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Session } from '@supabase/supabase-js';
import { getInvestorToken } from './investorAuth';

/**
 * Fetch wrapper that adds the appropriate auth for investor routes.
 * If a Supabase session is available, sends Bearer token.
 * If no session, falls back to invite token as query param.
 */
export async function investorFetch(
  url: string,
  session: Session | null,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  if (session?.access_token) {
    // Admin path: Bearer JWT
    headers.set('Authorization', `Bearer ${session.access_token}`);
  } else {
    // Portal path: append invite token to URL
    const inviteToken = getInvestorToken();
    if (inviteToken) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}token=${encodeURIComponent(inviteToken)}`;
    }
  }

  return fetch(url, { ...options, headers });
}

/**
 * POST wrapper with JSON body and auth.
 */
export async function investorPost(
  url: string,
  session: Session | null,
  body: Record<string, any>,
): Promise<Response> {
  return investorFetch(url, session, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}