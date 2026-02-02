// FILE: api/notifications/preferences.ts
// Email notification preferences management
// Users can subscribe/unsubscribe and configure their digest

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: Fetch current preferences
  if (req.method === 'GET') {
    const { data: prefs, error } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }

    // Return defaults if no preferences set
    return res.status(200).json(prefs || {
      user_id: user.id,
      digest_enabled: false,
      frequency: 'weekly',
      categories: [],
      location_radius_miles: 50,
      price_min: null,
      price_max: null,
      instant_watchlist: true,
      instant_messages: true,
      instant_sales: true,
      marketing_enabled: false,
    });
  }

  // PUT: Update preferences
  if (req.method === 'PUT') {
    const {
      digest_enabled,
      frequency,
      categories,
      location_radius_miles,
      price_min,
      price_max,
      instant_watchlist,
      instant_messages,
      instant_sales,
      marketing_enabled,
    } = req.body;

    const updates = {
      user_id: user.id,
      digest_enabled: digest_enabled ?? false,
      frequency: frequency || 'weekly',
      categories: categories || [],
      location_radius_miles: location_radius_miles ?? 50,
      price_min: price_min || null,
      price_max: price_max || null,
      instant_watchlist: instant_watchlist ?? true,
      instant_messages: instant_messages ?? true,
      instant_sales: instant_sales ?? true,
      marketing_enabled: marketing_enabled ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('email_preferences')
      .upsert(updates, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log preference update
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'email_preferences_updated',
      resource_type: 'email_preferences',
      resource_id: user.id,
      details: { digest_enabled, frequency },
    });

    return res.status(200).json(data);
  }

  // DELETE: Unsubscribe from all
  if (req.method === 'DELETE') {
    const { type } = req.query;

    if (type === 'all') {
      // Unsubscribe from everything
      await supabase
        .from('email_preferences')
        .update({
          digest_enabled: false,
          instant_watchlist: false,
          instant_messages: false,
          instant_sales: false,
          marketing_enabled: false,
        })
        .eq('user_id', user.id);
    } else if (type === 'digest') {
      await supabase
        .from('email_preferences')
        .update({ digest_enabled: false })
        .eq('user_id', user.id);
    } else if (type === 'marketing') {
      await supabase
        .from('email_preferences')
        .update({ marketing_enabled: false })
        .eq('user_id', user.id);
    }

    return res.status(200).json({ success: true, unsubscribed: type || 'all' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}