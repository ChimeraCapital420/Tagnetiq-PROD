// FILE: api/users/search.ts
// Search users by username, screen_name, or email for messaging/connections

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requesting user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get search query
    const { q, limit = '20' } = req.query;
    const searchQuery = (q as string || '').trim().toLowerCase();
    const resultLimit = Math.min(parseInt(limit as string) || 20, 50);

    if (!searchQuery || searchQuery.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Search profiles by username, screen_name, or email
    const { data: profiles, error: searchError } = await supabase
      .from('profiles')
      .select('id, username, screen_name, full_name, avatar_url')
      .or(`username.ilike.%${searchQuery}%,screen_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .neq('id', user.id)
      .order('username', { ascending: true })
      .limit(resultLimit);

    if (searchError) {
      console.error('Search error:', searchError);
      return res.status(500).json({ error: 'Search failed', details: searchError.message });
    }

    return res.status(200).json({
      users: profiles || [],
      count: profiles?.length || 0,
      query: searchQuery,
    });

  } catch (error: any) {
    console.error('User search error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}