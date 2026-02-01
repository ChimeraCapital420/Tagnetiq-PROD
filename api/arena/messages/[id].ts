// FILE: api/arena/messages/[id].ts

import { supaAdmin } from '../../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Message ID required' });
  }

  if (req.method === 'DELETE') {
    return handleDelete(req, res, id);
  }

  if (req.method === 'GET') {
    return handleGet(req, res, id);
  }

  res.setHeader('Allow', ['GET', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req: VercelRequest, res: VercelResponse, messageId: string) {
  try {
    const user = await verifyUser(req);

    const { data: message, error } = await supaAdmin
      .from('secure_messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        attachment_url,
        is_deleted,
        created_at
      `)
      .eq('id', messageId)
      .single();

    if (error || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Verify user is participant
    const { data: conversation } = await supaAdmin
      .from('secure_conversations')
      .select('buyer_id, seller_id')
      .eq('id', message.conversation_id)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isParticipant = 
      conversation.buyer_id === user.id || 
      conversation.seller_id === user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If deleted, mask the content
    if (message.is_deleted) {
      return res.status(200).json({
        ...message,
        content: null,
        attachment_url: null,
        is_deleted: true,
      });
    }

    return res.status(200).json(message);

  } catch (error) {
    console.error('[messages/id] GET error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, messageId: string) {
  try {
    const user = await verifyUser(req);
    const { deleteForEveryone = false } = req.body || {};

    // Get the message
    const { data: message, error: msgError } = await supaAdmin
      .from('secure_messages')
      .select('id, conversation_id, sender_id, attachment_url, is_deleted')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.is_deleted) {
      return res.status(400).json({ error: 'Message already deleted' });
    }

    // Get conversation to verify participant
    const { data: conversation } = await supaAdmin
      .from('secure_conversations')
      .select('buyer_id, seller_id')
      .eq('id', message.conversation_id)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isSender = message.sender_id === user.id;
    const isParticipant = 
      conversation.buyer_id === user.id || 
      conversation.seller_id === user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only sender can delete for everyone
    if (deleteForEveryone && !isSender) {
      return res.status(403).json({ 
        error: 'Only the sender can delete for everyone' 
      });
    }

    // Delete attachment from storage if exists
    if (message.attachment_url && deleteForEveryone) {
      const pathMatch = message.attachment_url.match(
        /message-attachments\/(.+?)(?:\?|$)/
      );
      if (pathMatch?.[1]) {
        const { error: storageError } = await supaAdmin.storage
          .from('message-attachments')
          .remove([pathMatch[1]]);
        
        if (storageError) {
          console.warn('[messages/id] Storage delete failed:', storageError.message);
        }
      }
    }

    // Mark message as deleted
    const { error: updateError } = await supaAdmin
      .from('secure_messages')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        // Clear content and attachment for "delete for everyone"
        ...(deleteForEveryone && {
          content: '[Message deleted]',
          attachment_url: null,
        }),
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('[messages/id] Update failed:', updateError);
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    return res.status(200).json({ 
      success: true,
      messageId,
      deletedForEveryone: deleteForEveryone && isSender,
    });

  } catch (error) {
    const err = error as Error;
    console.error('[messages/id] DELETE error:', err.message);
    
    if (err.message?.includes('Authentication')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}