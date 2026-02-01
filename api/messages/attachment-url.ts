// FILE: api/messages/attachment-url.ts
// Generates signed URLs for private message attachments

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

const BUCKET_NAME = 'message-attachments';

// Extract storage path from full URL or return path as-is
function extractStoragePath(input: string): string {
  if (!input) return '';
  
  const patterns = [
    /storage\/v1\/object\/public\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/sign\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/authenticated\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/message-attachments\/(.+)$/,
    /message-attachments\/(.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1].split('?')[0];
    }
  }
  
  let cleaned = input;
  if (cleaned.startsWith('/')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('message-attachments/')) {
    cleaned = cleaned.replace('message-attachments/', '');
  }
  
  return cleaned;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    
    const { path: rawPath } = req.body;

    // DEBUG LOGGING
    console.log('[attachment-url] === DEBUG ===');
    console.log('[attachment-url] Raw path received:', rawPath);
    console.log('[attachment-url] Raw path type:', typeof rawPath);

    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ error: 'Attachment path is required' });
    }

    const storagePath = extractStoragePath(rawPath);
    console.log('[attachment-url] Extracted storage path:', storagePath);

    if (!storagePath) {
      return res.status(400).json({ error: 'Invalid attachment path' });
    }

    const pathParts = storagePath.split('/');
    const conversationId = pathParts[0];
    const filename = pathParts.slice(1).join('/');

    console.log('[attachment-url] Path parts:', pathParts);
    console.log('[attachment-url] Conversation ID:', conversationId);
    console.log('[attachment-url] Filename:', filename);

    if (!conversationId) {
      return res.status(400).json({ error: 'Invalid attachment path format' });
    }

    // Check if conversationId looks like a UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    console.log('[attachment-url] Is valid UUID:', uuidPattern.test(conversationId));

    const { data: conversation, error: convError } = await supaAdmin
      .from('conversations')
      .select('id, participant1_id, participant2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[attachment-url] Conversation lookup failed:', convError?.message);
      console.error('[attachment-url] Searched for ID:', conversationId);
      return res.status(404).json({ 
        error: 'Conversation not found',
        debug: { conversationId, storagePath }
      });
    }

    console.log('[attachment-url] Found conversation:', conversation.id);
    console.log('[attachment-url] User ID:', user.id);
    console.log('[attachment-url] Participant 1:', conversation.participant1_id);
    console.log('[attachment-url] Participant 2:', conversation.participant2_id);

    const isParticipant = 
      conversation.participant1_id === user.id || 
      conversation.participant2_id === user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await supaAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      console.error('[attachment-url] Signed URL failed:', error?.message);
      return res.status(500).json({ 
        error: 'Failed to generate attachment URL',
        details: error?.message 
      });
    }

    console.log('[attachment-url] Success! URL generated');
    return res.status(200).json({ url: data.signedUrl });

  } catch (error: any) {
    console.error('[attachment-url] Error:', error.message);
    
    if (error.message?.includes('Authentication') || error.message?.includes('token')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}