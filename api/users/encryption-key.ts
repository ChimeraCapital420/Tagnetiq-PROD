// FILE: api/users/encryption-key.ts
// Save user's public encryption key

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // GET: Retrieve public key for a user
    if (req.method === 'GET') {
      const { userId } = req.query;
      const targetId = userId || user.id;

      const { data: profile, error } = await supaAdmin
        .from('profiles')
        .select('public_key, key_created_at')
        .eq('id', targetId)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        publicKey: profile.public_key,
        keyCreatedAt: profile.key_created_at,
        hasKey: !!profile.public_key,
      });
    }

    // POST: Save public key
    const { publicKey } = req.body;

    if (!publicKey || typeof publicKey !== 'string') {
      return res.status(400).json({ error: 'Public key is required' });
    }

    // Validate it looks like a base64 key
    if (publicKey.length < 100 || publicKey.length > 2000) {
      return res.status(400).json({ error: 'Invalid public key format' });
    }

    // Check if user already has a key
    const { data: existing } = await supaAdmin
      .from('profiles')
      .select('public_key')
      .eq('id', user.id)
      .single();

    if (existing?.public_key) {
      return res.status(409).json({ 
        error: 'Encryption key already exists',
        message: 'Key rotation is not yet supported'
      });
    }

    // Save public key
    const { error: updateError } = await supaAdmin
      .from('profiles')
      .update({
        public_key: publicKey,
        key_created_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Save key error:', updateError);
      return res.status(500).json({ error: 'Failed to save encryption key' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'Encryption key saved successfully'
    });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Encryption key error:', message);
    return res.status(500).json({ error: message });
  }
}