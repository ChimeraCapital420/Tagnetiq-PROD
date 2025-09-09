// FILE: api/dashboard/spotlight-items.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Simple auth check using Supabase directly
async function verifyUser(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supaAdmin.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Authentication failed');
  }

  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);

    // Fetch spotlight items from database
    const { data, error } = await supaAdmin
      .from('vault_items')
      .select(`
        id,
        asset_name,
        photos,
        created_at
      `)
      .eq('spotlight_featured', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching spotlight items:', error);
      throw new Error('Failed to fetch spotlight items');
    }

    // Transform the data to match expected format
    const transformedData = (data || []).map(item => ({
      id: item.id,
      item_name: item.asset_name, // Map asset_name to item_name for compatibility
      primary_photo_url: item.photos?.[0] || null, // Use first photo from array
      created_at: item.created_at
    }));

    // Return the data as JSON
    return res.status(200).json(transformedData);

  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    console.error('Error in spotlight items handler:', message);
    return res.status(500).json({ error: message });
  }
}