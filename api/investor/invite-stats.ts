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
}// FILE: api/investor/invite-stats.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '@supabase/supabase-js/dist/module/lib/SupabaseAuthClient';

// This is a placeholder for getting user by JWT. In a real scenario, you'd have a more robust way.
// For now, this demonstrates the security flow. The token is NOT from the client session.
const getUserByJWT = async (token: string) => {
    const { data: { user }, error } = await supaAdmin.auth.getUser(token);
    if (error) {
        console.error("JWT Error:", error.message);
        return null;
    }
    return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const user = await getUserByJWT(token);

    if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    try {
        // NOTE: This assumes you have an 'investor_invites' table with 'inviter_id', 'invitee_email', and 'status' columns.
        // The 'status' can be 'sent', 'accepted', or 'invested'.
        
        const { data: invites, error: invitesError } = await supaAdmin
            .from('investor_invites')
            .select('id, invitee_email, status, created_at')
            .eq('inviter_id', user.id);

        if (invitesError) throw invitesError;
        
        const totalSent = invites.length;
        const totalAccepted = invites.filter(i => i.status === 'accepted' || i.status === 'invested').length;
        const totalInvested = invites.filter(i => i.status === 'invested').length;
        const conversionRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;

        const stats = {
            totalSent,
            totalAccepted,
            totalInvested,
            conversionRate
        };

        return res.status(200).json({ stats, invites });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        console.error('Error fetching invite stats:', message);
        return res.status(500).json({ error: message });
    }
}