// FILE: api/arena/log-sale.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';
import { z } from 'zod';

// Define the schema for input validation
const logSaleSchema = z.object({
  challengeId: z.string().uuid(),
  salePrice: z.number().positive(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req); // SECURITY: Verify user authentication

    // VALIDATION: Parse and validate the request body
    const validationResult = logSaleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: 'Invalid input.', details: validationResult.error.flatten() });
    }
    const { challengeId, salePrice } = validationResult.data;

    // 1. Get the original challenge to calculate ROI
    const { data: challenge, error: challengeError } = await supaAdmin
      .from('arena_challenges')
      .select('purchase_price, user_id, status, vault_item_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) return res.status(404).json({ error: 'Challenge not found.' });
    if (challenge.user_id !== user.id) return res.status(403).json({ error: 'You do not own this challenge.' });
    if (challenge.status === 'completed') return res.status(400).json({ error: 'This challenge has already been completed.' });

    // 2. Calculate ROI
    const purchasePrice = Number(challenge.purchase_price);
    const profit = salePrice - purchasePrice;
    const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

    // 3. Update the challenge status and log sale details
    const { data: updatedChallenge, error: updateError } = await supaAdmin
      .from('arena_challenges')
      .update({
        sale_price: salePrice,
        roi,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', challengeId)
      .select('id, vault_item_id')
      .single();

    if (updateError) throw updateError;
    
    // 4. (Optional but recommended) Update the original vault item's sale price
    await supaAdmin.from('vault_items').update({ actual_sale_price: salePrice }).eq('id', updatedChallenge.vault_item_id);

    // 5. Add an entry to the leaderboards table
    const { error: leaderboardError } = await supaAdmin.from('leaderboards').insert({
        user_id: user.id,
        challenge_id: challengeId,
        roi,
        category: 'all-time',
        timeframe: 'all-time',
    });

    if (leaderboardError) throw leaderboardError;

    return res.status(200).json({ success: true, roi: roi.toFixed(2) });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
        return res.status(401).json({ error: message });
    }
    console.error('Error logging sale:', message);
    return res.status(500).json({ error: message });
  }
}