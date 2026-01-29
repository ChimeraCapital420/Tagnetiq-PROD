// FILE: api/arena/messages.ts
// Updated to support P2P conversations + blocked user filtering

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // GET - Fetch messages for a conversation
    if (req.method === 'GET') {
      const { conversationId, limit = '50', before } = req.query;

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

      // Get blocked status
      const otherUserId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
      const { data: blocked } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`)
        .limit(1);

      if (blocked && blocked.length > 0) {
        return res.status(403).json({ error: 'This conversation is no longer available.' });
      }

      // Fetch messages
      let query = supaAdmin
        .from('secure_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string) || 50);

      if (before && typeof before === 'string') {
        query = query.lt('created_at', before);
      }

      const { data: messages, error: messagesError } = await query;

      if (messagesError) throw messagesError;

      // Fetch sender profiles
      const senderIds = [...new Set((messages || []).map(m => m.sender_id))];
      const { data: profiles } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Enrich messages with sender info
      const enrichedMessages = (messages || []).map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || { 
          id: msg.sender_id, 
          screen_name: 'Unknown' 
        },
        is_own_message: msg.sender_id === user.id,
      }));

      // Mark unread messages as read
      const unreadIds = (messages || [])
        .filter(m => m.sender_id !== user.id && !m.read)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        await supaAdmin
          .from('secure_messages')
          .update({ read: true })
          .in('id', unreadIds);
      }

      // Reverse to chronological order for display
      return res.status(200).json({
        messages: enrichedMessages.reverse(),
        marked_read: unreadIds.length,
        has_more: (messages || []).length === (parseInt(limit as string) || 50),
      });
    }

    // POST - Send a message
    if (req.method === 'POST') {
      const { conversationId, content, attachment_url, attachment_type, attachment_name } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: 'conversationId is required.' });
      }

      if (!content && !attachment_url) {
        return res.status(400).json({ error: 'Message content or attachment is required.' });
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

      // Check if blocked
      const otherUserId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
      const { data: blocked } = await supaAdmin
        .from('blocked_users')
        .select('id')
        .or(`and(user_id.eq.${user.id},blocked_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},blocked_user_id.eq.${user.id})`)
        .limit(1);

      if (blocked && blocked.length > 0) {
        return res.status(403).json({ error: 'Cannot send messages in this conversation.' });
      }

      // Create message
      const { data: message, error: messageError } = await supaAdmin
        .from('secure_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          encrypted_content: content || '',
          attachment_url: attachment_url || null,
          attachment_type: attachment_type || null,
          attachment_name: attachment_name || null,
          read: false,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Update conversation's updated_at (trigger should do this, but just in case)
      await supaAdmin
        .from('secure_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Get sender profile
      const { data: senderProfile } = await supaAdmin
        .from('profiles')
        .select('id, screen_name, avatar_url')
        .eq('id', user.id)
        .single();

      return res.status(201).json({
        ...message,
        sender: senderProfile,
        is_own_message: true,
      });
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