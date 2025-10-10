import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies({ req });
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { device_id, items, sync_type } = req.body;

  try {
    // Verify device belongs to user
    const { data: device } = await supabase
      .from('bluetooth_devices')
      .select('*')
      .eq('user_id', user.id)
      .eq('device_id', device_id)
      .single();

    if (!device) {
      return res.status(403).json({ error: 'Device not found' });
    }

    // Process items based on sync_type
    if (sync_type === 'inventory_add') {
      for (const item of items) {
        await supabase
          .from('inventory')
          .insert({
            user_id: user.id,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity || 1,
            source: 'bluetooth',
            device_id: device_id
          });
      }
    }

    // Log sync
    await supabase
      .from('bluetooth_sync_logs')
      .insert({
        user_id: user.id,
        device_id,
        sync_type,
        items_count: items.length,
        synced_at: new Date().toISOString()
      });

    return res.status(200).json({ success: true, synced_items: items.length });
  } catch (error) {
    return res.status(500).json({ error: 'Sync failed' });
  }
}