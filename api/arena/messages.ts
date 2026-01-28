// FILE: api/arena/messages.ts
// Fixed to fetch sender profiles separately (no join)

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    if (req.method === 'GET') {
      const { conversationId } = req.query;
      
      if (!conversationId || typeof conversationId !== 'string') {
        return res.status(400).json({ error: 'conversationId is required.' });
      }

      // Verify user is part of this conversation
      const { data: convo, error: convoError } = await supaAdmin
        .from('secure_conversations')
        .select('buyer_id, seller_id')
        .eq('id', conversationId)
        .single();

      if (convoError || !convo) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (convo.buyer_id !== user.id && convo.seller_id !== user.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      // Fetch messages without join
      const { data: messages, error } = await supaAdmin
        .from('secure_messages')
        .select('id, conversation_id, sender_id, encrypted_content, read, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
      const { data: profiles } = await supaAdmin
        .from('profiles')
        .select('id, screen_name')
        .in('id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Attach sender info to messages
      const enrichedMessages = (messages || []).map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || { id: msg.sender_id, screen_name: 'Unknown' }
      }));

      // Mark messages as read (ones not sent by current user)
      await supaAdmin
        .from('secure_messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('read', false);

      return res.status(200).json(enrichedMessages);
    }

    if (req.method === 'POST') {
      const { conversationId, content } = req.body;
      
      if (!conversationId || !content) {
        return res.status(400).json({ error: 'conversationId and content are required.' });
      }

      // Verify user is part of this conversation
      const { data: convo, error: convoError } = await supaAdmin
        .from('secure_conversations')
        .select('buyer_id, seller_id')
        .eq('id', conversationId)
        .single();

      if (convoError || !convo) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      if (convo.buyer_id !== user.id && convo.seller_id !== user.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      // Insert message
      const { data, error } = await supaAdmin
        .from('secure_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          encrypted_content: content.trim(),
          read: false,
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
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in messages handler:', message);
    return res.status(500).json({ error: message });
  }
}