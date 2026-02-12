// FILE: api/oracle/conversations.ts
// Oracle Sprint B — Conversation persistence endpoints
// GET: Load recent conversations or a specific conversation
// DELETE: Clear a conversation
// FIXED: VITE_PUBLIC_SUPABASE_URL → SUPABASE_URL

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 10,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // ── GET: List conversations or load specific one ──────
    if (req.method === 'GET') {
      const { id } = req.query;

      if (id && typeof id === 'string') {
        const { data, error } = await supabaseAdmin
          .from('oracle_conversations')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          return res.status(404).json({ error: 'Conversation not found' });
        }

        return res.status(200).json({ conversation: data });
      }

      const { data: conversations, error } = await supabaseAdmin
        .from('oracle_conversations')
        .select('id, title, created_at, updated_at, scan_count_at_creation')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to fetch conversations:', error);
        return res.status(500).json({ error: 'Failed to load conversations' });
      }

      return res.status(200).json({ conversations: conversations || [] });
    }

    // ── DELETE: Remove a conversation ─────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Conversation ID required' });
      }

      await supabaseAdmin
        .from('oracle_conversations')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Oracle conversations error:', errMsg);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}