// FILE: api/partner/keys.ts
// API Key management for partners
// Create, list, revoke API keys

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET: List user's API keys
  if (req.method === 'GET') {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, tier, is_active, created_at, last_used_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      keys: keys || [],
      count: keys?.length || 0,
    });
  }

  // POST: Create new API key
  if (req.method === 'POST') {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check key limit (max 5 per user for free tier)
    const { count } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if ((count || 0) >= 5) {
      return res.status(400).json({ 
        error: 'Maximum 5 active API keys allowed',
        upgrade_url: '/settings/billing',
      });
    }

    // Generate API key
    const apiKey = `tnq_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.slice(0, 12);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        tier: 'free',
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('id, name, key_prefix, tier, created_at')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log key creation
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'api_key_created',
      resource_type: 'api_key',
      resource_id: data.id,
      details: { name, tier: 'free' },
    });

    return res.status(201).json({
      ...data,
      // Only return full key once, on creation
      api_key: apiKey,
      warning: 'Save this API key now. You will not be able to see it again.',
    });
  }

  // DELETE: Revoke API key
  if (req.method === 'DELETE') {
    const { key_id } = req.body;

    if (!key_id) {
      return res.status(400).json({ error: 'key_id is required' });
    }

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', key_id)
      .eq('user_id', user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Log key revocation
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'api_key_revoked',
      resource_type: 'api_key',
      resource_id: key_id,
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}