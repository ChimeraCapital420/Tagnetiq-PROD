// FILE: api/analysis/history.ts

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    if (req.method === 'GET') {
      const { limit = 10, offset = 0, category } = req.query;
      
      let query = supaAdmin
        .from('analysis_history')
        .select(`
          id,
          user_id,
          analysis_result,
          created_at,
          item_name,
          estimated_value,
          thumbnail_url,
          category,
          confidence,
          decision,
          consensus_data,
          authority_data
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      return res.status(200).json({ 
        items: data || [], 
        total: count,
        hasMore: count ? (Number(offset) + Number(limit)) < count : false 
      });
    }

    if (req.method === 'POST') {
      const { analysis_result } = req.body;

      if (!analysis_result) {
        return res.status(400).json({ error: 'analysis_result is required.' });
      }

      // Extract key fields for easy querying
      const { data: newEntry, error } = await supaAdmin
        .from('analysis_history')
        .insert({
          user_id: user.id,
          analysis_result: analysis_result,
          item_name: analysis_result.itemName,
          estimated_value: parseFloat(analysis_result.estimatedValue) || 0,
          thumbnail_url: analysis_result.imageUrls?.[0] || analysis_result.imageUrl || null,
          category: analysis_result.category || 'uncategorized',
          confidence: analysis_result.confidenceScore || analysis_result.confidence,
          decision: analysis_result.decision,
          consensus_data: analysis_result.hydraConsensus || null,
          authority_data: analysis_result.authorityData || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return res.status(201).json(newEntry);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'id is required.' });
      }

      const { error } = await supaAdmin
        .from('analysis_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      return res.status(204).send('');
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error in analysis history handler:', message);
    return res.status(500).json({ error: message });
  }
}