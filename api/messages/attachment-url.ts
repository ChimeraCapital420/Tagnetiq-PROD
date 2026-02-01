// FILE: api/messages/attachment-url.ts
// Generate signed URLs for private message attachments

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { path, conversationId } = req.body;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Attachment path is required' });
    }

    let authorized = false;

    // Method 1: Check via provided conversationId
    if (conversationId) {
      const { data: conversation } = await supaAdmin
        .from('conversations')
        .select('id, participant1_id, participant2_id')
        .eq('id', conversationId)
        .single();

      if (conversation) {
        authorized = 
          conversation.participant1_id === user.id || 
          conversation.participant2_id === user.id;
      }
    }

    // Method 2: Look up message containing this attachment, then check conversation
    if (!authorized) {
      const { data: message } = await supaAdmin
        .from('messages')
        .select('conversation_id, sender_id')
        .ilike('attachment_url', `%${path}%`)
        .limit(1)
        .single();

      if (message) {
        // User is the sender
        if (message.sender_id === user.id) {
          authorized = true;
        } else {
          // Check if user is participant in the conversation
          const { data: conversation } = await supaAdmin
            .from('conversations')
            .select('participant1_id, participant2_id')
            .eq('id', message.conversation_id)
            .single();

          if (conversation) {
            authorized = 
              conversation.participant1_id === user.id || 
              conversation.participant2_id === user.id;
          }
        }
      }
    }

    // Method 3: Path belongs to current user (their own uploads)
    if (!authorized) {
      const pathUserId = path.split('/')[0];
      authorized = pathUserId === user.id;
    }

    if (!authorized) {
      console.log('Attachment auth failed:', { userId: user.id, path });
      return res.status(403).json({ error: 'Not authorized to view this attachment' });
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supaAdmin.storage
      .from('message-attachments')
      .createSignedUrl(path, 3600);

    if (error || !data) {
      console.error('Signed URL generation error:', error);
      return res.status(500).json({ error: 'Failed to generate attachment URL' });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Attachment URL error:', message);
    return res.status(500).json({ error: message });
  }
}