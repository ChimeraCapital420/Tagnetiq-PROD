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
    await verifyUser(req); // SECURITY: Verify user is authenticated to view leaderboards
    
    const { data, error } = await supaAdmin
      .from('leaderboards')
      .select(`
        user_id,
        roi,
        challenge:arena_challenges(
          purchase_price,
          sale_price
        ),
        user:profiles(
          screen_name
        )
      `)
      .order('roi', { ascending: false })
      .limit(100);

    if (error) throw error;
    
    // Fix the type issues with proper null checking
    const formattedData = data?.map(entry => {
      const screenName = Array.isArray(entry.user) ? entry.user[0]?.screen_name : entry.user?.screen_name;
      const salePrice = Array.isArray(entry.challenge) ? entry.challenge[0]?.sale_price : entry.challenge?.sale_price;
      const purchasePrice = Array.isArray(entry.challenge) ? entry.challenge[0]?.purchase_price : entry.challenge?.purchase_price;
      
      return {
        user: screenName || 'Anonymous',
        roi: Number(entry.roi || 0).toFixed(2),
        totalProfit: (Number(salePrice || 0) - Number(purchasePrice || 0)).toFixed(2)
      };
    }) || [];

    return res.status(200).json(formattedData);
    
  } catch (error: any) {
    const message = error.message || 'An internal server error occurred.';
    
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    
    console.error('Error fetching leaderboard data:', message);
    return res.status(500).json({ error: message });
  }
}