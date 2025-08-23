// FILE: api/dashboard/spotlight-items.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Tier 1: Fetch user's interests
    const { data: profile, error: profileError } = await supaAdmin
      .from('profiles')
      .select('interests')
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error('Could not fetch user profile.');

    const userInterests: string[] = profile?.interests || [];
    let spotlightItems: any[] = [];

    // Fetch items matching user interests
    if (userInterests.length > 0) {
      const { data: interestItems, error: interestError } = await supaAdmin
        .from('marketplace_listings')
        .select('id, item_name, primary_photo_url')
        .in('item_category', userInterests)
        .eq('status', 'active')
        .limit(10);
      
      if (interestError) console.error('Error fetching interest items:', interestError);
      if (interestItems) spotlightItems = [...spotlightItems, ...interestItems];
    }

    // Tier 2: Fetch items based on recent scan categories if needed
    if (spotlightItems.length < 10) {
      const { data: recentScans, error: scanError } = await supaAdmin
        .from('scan_history')
        .select('category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (scanError) console.error('Error fetching recent scans:', scanError);

      if (recentScans && recentScans.length > 0) {
        const recentCategories = [...new Set(recentScans.map(s => s.category))];
        const { data: categoryItems, error: categoryError } = await supaAdmin
          .from('marketplace_listings')
          .select('id, item_name, primary_photo_url')
          .in('item_category', recentCategories)
          .eq('status', 'active')
          .limit(10 - spotlightItems.length);

        if (categoryError) console.error('Error fetching category items:', categoryError);
        if (categoryItems) spotlightItems = [...spotlightItems, ...categoryItems];
      }
    }
    
    // Tier 3: Fill with most recent popular items if still not enough
    if (spotlightItems.length < 10) {
        const { data: recentItems, error: recentError } = await supaAdmin
            .from('marketplace_listings')
            .select('id, item_name, primary_photo_url')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(10 - spotlightItems.length);

        if (recentError) console.error('Error fetching recent items:', recentError);
        if (recentItems) spotlightItems = [...spotlightItems, ...recentItems];
    }
    
    // Deduplicate and ensure final count is 10 or less
    const uniqueItems = Array.from(new Map(spotlightItems.map(item => [item.id, item])).values());

    return res.status(200).json(uniqueItems.slice(0, 10));

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error fetching spotlight items:', message);
    return res.status(500).json({ error: message });
  }
}