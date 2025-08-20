// FILE: api/arena/messages.ts

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUserIsAdmin } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUserIsAdmin(req);
    
    if (req.method === 'GET') {
      const { conversationId } = req.query;
      if (!conversationId || typeof conversationId !== 'string') {
        return res.status(400).json({ error: 'conversationId is required.' });
      }

      const { data, error } = await supaAdmin
        .from('secure_messages')
        .select('*, sender:profiles(id, screen_name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { conversationId, content } = req.body;
      if (!conversationId || !content) {
        return res.status(400).json({ error: 'conversationId and content are required.' });
      }

      // In a real E2EE implementation, content would be encrypted here.
      const { data, error } = await supaAdmin
        .from('secure_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          encrypted_content: content, // Storing plaintext for V1
        })
        .select()
        .single();
      
      if (error) throw error;
      return res.status(201).json(data);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error in messages handler:', message);
    return res.status(500).json({ error: message });
  }
}