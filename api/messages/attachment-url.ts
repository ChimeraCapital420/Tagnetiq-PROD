// FILE: api/messages/attachment-url.ts
// Generates signed URLs for private message attachments

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

const BUCKET_NAME = 'message-attachments';

// Extract storage path from full URL or return path as-is
function extractStoragePath(input: string): string {
  if (!input) return '';
  
  // If it's a full Supabase URL, extract just the path
  // Format: https://xxx.supabase.co/storage/v1/object/public/bucket-name/path/to/file.jpg
  // Or: https://xxx.supabase.co/storage/v1/object/sign/bucket-name/path/to/file.jpg
  
  const patterns = [
    /storage\/v1\/object\/public\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/sign\/message-attachments\/(.+)$/,
    /storage\/v1\/object\/message-attachments\/(.+)$/,
    /message-attachments\/(.+)$/,
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      // Remove any query params
      return match[1].split('?')[0];
    }
  }
  
  // If no pattern matched, assume it's already just the path
  // But clean it up - remove leading slashes and bucket name if present
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
    // Verify user
    const user = await verifyUser(req);
    
    const { path: rawPath } = req.body;

    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({ error: 'Attachment path is required' });
    }

    // Extract the actual storage path
    const storagePath = extractStoragePath(rawPath);
    
    if (!storagePath) {
      return res.status(400).json({ error: 'Invalid attachment path' });
    }

    // Extract conversation ID from path (format: {conversation_id}/{filename})
    const pathParts = storagePath.split('/');
    const conversationId = pathParts[0];

    if (!conversationId) {
      return res.status(400).json({ error: 'Invalid attachment path format' });
    }

    // Verify user is a participant in this conversation
    const { data: conversation, error: convError } = await supaAdmin
      .from('conversations')
      .select('id, participant1_id, participant2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('Conversation lookup failed:', convError?.message);
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Check if user is a participant
    const isParticipant = 
      conversation.participant1_id === user.id || 
      conversation.participant2_id === user.id;

    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supaAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      console.error('Signed URL generation failed:', error?.message);
      return res.status(500).json({ 
        error: 'Failed to generate attachment URL',
        details: error?.message 
      });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (error: any) {
    console.error('Attachment URL error:', error.message);
    
    if (error.message?.includes('Authentication') || error.message?.includes('token')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}