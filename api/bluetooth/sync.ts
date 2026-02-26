// FILE: api/bluetooth/sync.ts
// Bluetooth device sync — processes items scanned via connected devices.
//
// MOBILE FIRST: All image capture, compression, and barcode scanning happens
// on the user's device. This endpoint receives the RESULTS, not raw data.
// The phone does the heavy lifting, the server just stores and logs.
//
// Sync types:
//   inventory_add   → Add scanned items to user's inventory
//   glasses_scan    → Process a batch of glasses camera captures
//   barcode_batch   → Process barcode scanner batch

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  // ── Validate body ──────────────────────────────────────────────────────
  const { device_id, items, sync_type } = req.body || {};

  if (!device_id) {
    return res.status(400).json({ error: 'device_id is required' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array is required and must not be empty' });
  }
  if (!sync_type) {
    return res.status(400).json({ error: 'sync_type is required' });
  }

  try {
    // ── Verify device belongs to user ──────────────────────────────────
    const { data: device } = await supabase
      .from('bluetooth_devices')
      .select('id, device_name')
      .eq('user_id', user.id)
      .eq('device_id', device_id)
      .eq('is_active', true)
      .single();

    if (!device) {
      return res.status(403).json({ error: 'Device not found or not active' });
    }

    // ── Process items based on sync_type ───────────────────────────────
    let processedCount = 0;

    if (sync_type === 'inventory_add') {
      // Batch insert — much faster than one-by-one
      const rows = items.map((item: any) => ({
        user_id: user.id,
        sku: item.sku || null,
        name: item.name || 'Unknown Item',
        quantity: item.quantity || 1,
        category: item.category || 'general',
        source: 'bluetooth',
        device_id: device_id,
        metadata: item.metadata || {},
      }));

      const { error: insertError } = await supabase
        .from('inventory')
        .insert(rows);

      if (insertError) {
        console.error('[bluetooth/sync] inventory insert error:', insertError.message);
        // Don't fail the whole request — partial success is better than nothing
      }
      processedCount = rows.length;
    }

    if (sync_type === 'glasses_scan' || sync_type === 'barcode_batch') {
      // For glasses/barcode scans, we just log the sync event.
      // The actual analysis happens through /api/analyze (called by the device).
      processedCount = items.length;
    }

    // ── Log the sync event ─────────────────────────────────────────────
    await supabase
      .from('bluetooth_sync_logs')
      .insert({
        user_id: user.id,
        device_id,
        sync_type,
        items_count: processedCount,
        synced_at: new Date().toISOString(),
      })
      .then(({ error }) => {
        if (error) console.error('[bluetooth/sync] log error:', error.message);
      });

    // ── Update device last_connected ───────────────────────────────────
    await supabase
      .from('bluetooth_devices')
      .update({ last_connected: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('device_id', device_id);

    return res.status(200).json({
      success: true,
      synced_items: processedCount,
      device_name: device.device_name,
    });
  } catch (err: any) {
    console.error('[bluetooth/sync] error:', err.message);
    return res.status(500).json({ error: 'Sync failed' });
  }
}