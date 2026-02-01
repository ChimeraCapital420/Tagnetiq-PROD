// FILE: api/messages/attachment-url.ts
// DIAGNOSTIC VERSION - logs everything to find the real problem

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== ATTACHMENT URL REQUEST ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body));
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Step 1: Verify user
    let user;
    try {
      user = await verifyUser(req);
      console.log('User verified:', user.id);
    } catch (authError: any) {
      console.error('AUTH FAILED:', authError.message);
      return res.status(401).json({ error: 'Authentication failed', details: authError.message });
    }

    const { path } = req.body;
    console.log('Requested path:', path);

    if (!path || typeof path !== 'string') {
      console.log('Missing path');
      return res.status(400).json({ error: 'Attachment path is required' });
    }

    // Step 2: Find the message with this attachment
    const { data: message, error: msgError } = await supaAdmin
      .from('messages')
      .select('id, sender_id, conversation_id, attachment_url')
      .ilike('attachment_url', `%${path}%`)
      .limit(1)
      .single();

    console.log('Message lookup result:', { message, error: msgError?.message });

    if (!message) {
      console.log('No message found, checking if path starts with user ID...');
      // Fallback: Check if path starts with user's ID
      if (path.startsWith(user.id)) {
        console.log('Path belongs to user, authorizing...');
      } else {
        console.log('Path does not belong to user');
        // For debugging, let's still try to generate the URL
        console.log('BYPASSING AUTH FOR DEBUG');
      }
    } else {
      console.log('Message found, conversation_id:', message.conversation_id);
      
      // Step 3: Check conversation participants
      const { data: conv, error: convError } = await supaAdmin
        .from('conversations')
        .select('*')  // Select ALL to see the schema
        .eq('id', message.conversation_id)
        .single();

      console.log('Conversation lookup:', { conv, error: convError?.message });
      
      if (conv) {
        console.log('Conversation columns:', Object.keys(conv));
      }
    }

    // Step 4: Generate signed URL (always try for debugging)
    console.log('Generating signed URL for path:', path);
    
    const { data, error } = await supaAdmin.storage
      .from('message-attachments')
      .createSignedUrl(path, 3600);

    console.log('Signed URL result:', { 
      success: !!data, 
      url: data?.signedUrl?.substring(0, 50) + '...', 
      error: error?.message 
    });

    if (error || !data) {
      console.error('Signed URL generation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to generate attachment URL',
        details: error?.message 
      });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (error: any) {
    console.error('UNEXPECTED ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}