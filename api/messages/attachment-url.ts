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

    // Verify user is part of the conversation
    if (conversationId) {
      const { data: conversation } = await supaAdmin
        .from('conversations')
        .select('id, participant1_id, participant2_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const isParticipant = 
        conversation.participant1_id === user.id || 
        conversation.participant2_id === user.id;

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized to view this attachment' });
      }
    } else {
      // If no conversation ID, verify the path belongs to the user
      const pathUserId = path.split('/')[0];
      if (pathUserId !== user.id) {
        return res.status(403).json({ error: 'Not authorized to view this attachment' });
      }
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supaAdmin.storage
      .from('message-attachments')
      .createSignedUrl(path, 3600);

    if (error || !data) {
      console.error('Signed URL error:', error);
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