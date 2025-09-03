import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supaAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Simple auth check using Supabase directly
async function verifyUserIsAdmin(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supaAdmin.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Authentication failed');
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supaAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    throw new Error('Authorization failed - admin access required');
  }

  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await verifyUserIsAdmin(req);

    if (req.method === 'GET') {
      const { data, error } = await supaAdmin
        .from('partnership_opportunities')
        .select('*')
        .order('discovered_at', { ascending: false });
      
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { name, url, source_category, notes } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: 'Name and URL are required.' });
      }

      const { data, error } = await supaAdmin
        .from('partnership_opportunities')
        .insert({ 
          name, 
          url, 
          source_category, 
          notes, 
          status: 'new' 
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    
    if (message.includes('Authorization')) {
      return res.status(403).json({ error: message });
    }
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    console.error('Error in partnership opportunities handler:', message);
    return res.status(500).json({ error: message });
  }
}