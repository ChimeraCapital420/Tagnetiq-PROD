import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Use correct environment variable names for Vercel deployment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Simple user verification
async function getUserByJWT(token: string) {
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
    // Fetch investor invites for this user
    const { data: invites, error: invitesError } = await supaAdmin
      .from('investor_invites')
      .select('id, invitee_email, status, created_at')
      .eq('inviter_id', user.id);

    if (invitesError) throw invitesError;
    
    const totalSent = invites?.length || 0;
    const totalAccepted = invites?.filter(i => i.status === 'accepted' || i.status === 'invested').length || 0;
    const totalInvested = invites?.filter(i => i.status === 'invested').length || 0;
    const conversionRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;

    const stats = {
      totalSent,
      totalAccepted,
      totalInvested,
      conversionRate
    };

    return res.status(200).json({ 
      stats, 
      invites: invites || [] 
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching invite stats:', message);
    return res.status(500).json({ error: message });
  }
}