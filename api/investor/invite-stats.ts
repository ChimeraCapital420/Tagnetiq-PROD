// FILE: api/investor/invite-stats.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';

// It's crucial to use the public client here so Row Level Security is enforced.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is not defined in environment variables.");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    
    const decodedToken: { sub: string } = jwtDecode(token);
    const userId = decodedToken.sub;

    // Create a Supabase client with the user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // RLS policy ensures this query only returns records where inviter_id matches the user's ID.
    const { data, error, count } = await supabase
      .from('investor_invites')
      .select('*', { count: 'exact' });

    if (error) throw error;

    const stats = {
        totalSent: count || 0,
        totalAccepted: data.filter(d => d.status === 'accepted' || d.status === 'invested').length,
        totalInvested: data.filter(d => d.status === 'invested').length,
    };
    
    const conversionRate = stats.totalAccepted > 0 ? (stats.totalInvested / stats.totalAccepted) * 100 : 0;

    return res.status(200).json({
        stats: {
            ...stats,
            conversionRate: parseFloat(conversionRate.toFixed(2)),
        },
        invites: data, // Full list of invites sent by this user
    });

  } catch (error: any) {
    console.error('Error fetching invite stats:', error);
    const message = error.message || 'An unexpected error occurred.';
    return res.status(500).json({ error: message });
  }
}