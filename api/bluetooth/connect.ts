// FILE: api/bluetooth/connect.ts
// Bluetooth device registration and retrieval.
// Stores device info in Supabase so the web UI can show paired devices.
//
// MOBILE FIRST: The phone/device does all Bluetooth scanning and pairing.
// This endpoint just persists the result so other TagnetIQ surfaces know about it.
//
// POST → register/update a connected device
// GET  → list user's active devices

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // ── POST: Register / update a connected device ──────────────────────────
  if (req.method === 'POST') {
    const { device_id, device_name, device_type, device_data } = req.body || {};

    if (!device_id || !device_name) {
      return res.status(400).json({ error: 'device_id and device_name are required' });
    }

    try {
      const { data, error } = await supabase
        .from('bluetooth_devices')
        .upsert({
          user_id: user.id,
          device_id,
          device_name,
          device_type: device_type || 'unknown',
          device_data: device_data || {},
          last_connected: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ device: data });
    } catch (err: any) {
      console.error('[bluetooth/connect] POST error:', err.message);
      return res.status(500).json({ error: 'Failed to save device' });
    }
  }

  // ── GET: List user's active devices ─────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('bluetooth_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_connected', { ascending: false });

      if (error) throw error;

      return res.status(200).json({ devices: data || [] });
    } catch (err: any) {
      console.error('[bluetooth/connect] GET error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }
  }

  // ── DELETE: Deactivate a device ─────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { device_id } = req.body || {};
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }

    try {
      await supabase
        .from('bluetooth_devices')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('device_id', device_id);

      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to deactivate device' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}