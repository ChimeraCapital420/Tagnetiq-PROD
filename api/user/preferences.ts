// FILE: api/user/preferences.ts
// User preferences API — GET and PATCH settings
// FIXED: Rewritten from Next.js (NextRequest/NextResponse/getServerSession)
//        to Vercel serverless (VercelRequest/VercelResponse/supabaseAdmin)
// FIXED: Removed duplicate imports
// FIXED: Uses auth token verification like all other API routes

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// AUTH
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // ── GET: Return user settings ──────────────────────────
    if (req.method === 'GET') {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json({
        settings: profile.settings || {},
      });
    }

    // ── PATCH: Merge and update settings ───────────────────
    if (req.method === 'PATCH') {
      // Get current settings
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      if (fetchError || !profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      // Merge with incoming updates
      const updates = req.body;
      const currentSettings = profile.settings || {};
      const newSettings = {
        ...currentSettings,
        ...updates,
      };

      // Update profile
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('[Preferences] Update error:', updateError);
        return res.status(500).json({ error: 'Failed to update preferences' });
      }

      return res.status(200).json({
        success: true,
        settings: newSettings,
      });
    }

    // ── Unsupported method ─────────────────────────────────
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[Preferences] API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
