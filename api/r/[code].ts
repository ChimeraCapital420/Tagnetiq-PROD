// FILE: api/r/[code].ts
// Short referral URL redirect handler
// /r/ABC123 -> /join?ref=ABC123 (with tracking)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.redirect(302, DOMAIN);
  }

  try {
    // Verify code exists
    const { data: refCode, error } = await supabase
      .from('referral_codes')
      .select('user_id, code')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !refCode) {
      // Invalid code - redirect to home
      return res.redirect(302, DOMAIN);
    }

    // Track click (fire and forget)
    fetch(`${DOMAIN}/api/referrals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track_click',
        code: refCode.code,
        user_agent: req.headers['user-agent'],
        referrer: req.headers['referer'],
      }),
    }).catch(() => {}); // Ignore errors

    // Set referral cookie (30 days)
    res.setHeader('Set-Cookie', [
      `ref=${refCode.code}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
    ]);

    // Redirect to signup/marketplace
    const destination = `${DOMAIN}/join?ref=${refCode.code}`;
    
    return res.redirect(302, destination);
  } catch (err) {
    console.error('Referral redirect error:', err);
    return res.redirect(302, DOMAIN);
  }
}