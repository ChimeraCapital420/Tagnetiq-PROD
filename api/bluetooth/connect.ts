import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { parseCookies } from 'nookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parseCookies({ req });
  const token = cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { data: { user } } = await supabase.auth.getUser(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (req.method === 'POST') {
    const { device_id, device_name, device_data } = req.body;

    try {
      const { data, error } = await supabase
        .from('bluetooth_devices')
        .upsert({
          user_id: user.id,
          device_id,
          device_name,
          device_data,
          last_connected: new Date().toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ device: data });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to save device' });
    }
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('bluetooth_devices')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;

      return res.status(200).json({ devices: data || [] });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}