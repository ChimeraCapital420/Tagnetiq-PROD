// FILE: api/oracle/feedback.ts
// Thumbs up/down on Oracle responses → trust calibration + gamification
// POST: { messageIndex, conversationId, rating: 'up' | 'down', reason? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { conversationId, messageIndex, rating, reason, messageContent } = req.body;

    if (!rating || !['up', 'down'].includes(rating)) {
      return res.status(400).json({ error: 'Rating must be "up" or "down"' });
    }

    // Store feedback
    await supabaseAdmin.from('oracle_feedback').insert({
      user_id: user.id,
      conversation_id: conversationId || null,
      message_index: messageIndex || null,
      message_excerpt: (messageContent || '').substring(0, 300),
      rating,
      reason: reason || null,
    });

    // Update trust metrics on oracle_identity
    const { data: identity } = await supabaseAdmin
      .from('oracle_identity')
      .select('trust_metrics')
      .eq('user_id', user.id)
      .single();

    if (identity) {
      const metrics = identity.trust_metrics || {
        total_ratings: 0,
        positive_ratings: 0,
        negative_ratings: 0,
        feedback_score: 50,
      };

      metrics.total_ratings = (metrics.total_ratings || 0) + 1;
      if (rating === 'up') {
        metrics.positive_ratings = (metrics.positive_ratings || 0) + 1;
      } else {
        metrics.negative_ratings = (metrics.negative_ratings || 0) + 1;
      }

      // Weighted feedback score (0-100)
      if (metrics.total_ratings > 0) {
        metrics.feedback_score = Math.round(
          (metrics.positive_ratings / metrics.total_ratings) * 100
        );
      }

      await supabaseAdmin
        .from('oracle_identity')
        .update({ trust_metrics: metrics })
        .eq('user_id', user.id);
    }

    // Award gamification points for giving feedback
    try {
      const { awardPoints } = await import(
        '../../src/lib/oracle/gamification/index.js'
      );
      await awardPoints(supabaseAdmin, user.id, 'feedback_given');
    } catch {
      // Non-critical
    }

    return res.status(200).json({ success: true, rating });
  } catch (error) {
    console.error('[Feedback] Error:', error);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
}
