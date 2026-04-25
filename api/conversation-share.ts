// FILE: api/conversation-share.ts
// RH-012 — Conversation Sharing
// Lets users share Oracle scan conversations publicly via a short link.
// Shared conversations show the scan result + Oracle commentary.
//
// POST /api/conversation-share  { action: 'create', userId, analysisId, conversationId? }
// GET  /api/conversation-share?shareId=xxx  → fetch shared conversation
// POST /api/conversation-share  { action: 'delete', userId, shareId }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 15 };

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function generateShareId(): string {
  // 8-char alphanumeric — readable and short enough for social sharing
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: fetch a shared conversation ─────────────────────────────────
  if (req.method === 'GET') {
    const { shareId } = req.query;
    if (!shareId || typeof shareId !== 'string') {
      return res.status(400).json({ error: 'shareId required' });
    }

    const { data, error } = await supabase
      .from('shared_conversations')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }

    // Increment view count (fire and forget)
    supabase
      .from('shared_conversations')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('share_id', shareId)
      .then(() => {}).catch(() => {});

    return res.status(200).json({
      success: true,
      share: {
        shareId:       data.share_id,
        itemName:      data.item_name,
        estimatedValue: data.estimated_value,
        decision:      data.decision,
        category:      data.category,
        confidence:    data.confidence,
        messages:      data.messages || [],
        imageUrl:      data.image_url,
        createdAt:     data.created_at,
        viewCount:     (data.view_count || 0) + 1,
      },
    });
  }

  // ── POST: create or delete a share ───────────────────────────────────
  if (req.method === 'POST') {
    const { action, userId, analysisId, shareId, messages, itemData } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    if (action === 'create') {
      if (!analysisId) return res.status(400).json({ error: 'analysisId required' });

      // Get the analysis result from Supabase
      const { data: analysisData } = await supabase
        .from('consensus_results')
        .select('final_item_name, final_value, final_decision, consensus_confidence')
        .eq('analysis_id', analysisId)
        .single();

      const newShareId = generateShareId();

      const { data, error } = await supabase
        .from('shared_conversations')
        .insert({
          share_id:        newShareId,
          user_id:         userId,
          analysis_id:     analysisId,
          item_name:       analysisData?.final_item_name || itemData?.itemName || 'Unknown Item',
          estimated_value: analysisData?.final_value || itemData?.estimatedValue || 0,
          decision:        analysisData?.final_decision || itemData?.decision || 'SELL',
          category:        itemData?.category || 'general',
          confidence:      analysisData?.consensus_confidence || itemData?.confidence || 0,
          messages:        messages || [],
          image_url:       itemData?.imageUrl || null,
          is_active:       true,
          view_count:      0,
          // Auto-expire after 30 days
          expires_at:      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });

      return res.status(201).json({
        success: true,
        shareId:  newShareId,
        shareUrl: `https://tagnetiq.com/share/${newShareId}`,
      });
    }

    if (action === 'delete') {
      if (!shareId) return res.status(400).json({ error: 'shareId required' });

      const { error } = await supabase
        .from('shared_conversations')
        .update({ is_active: false })
        .eq('share_id', shareId)
        .eq('user_id', userId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}