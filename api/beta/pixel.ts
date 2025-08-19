// FILE: api/beta/pixel.ts
import { supaAdmin } from '../_lib/supaAdmin';
import { verifySignature } from '../_lib/crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { i: inviteId, sig: signature } = req.query;

  if (!inviteId || typeof inviteId !== 'string' || !signature || typeof signature !== 'string' || !verifySignature(inviteId, signature)) {
    return res.status(403).end();
  }

  // Correct Supabase error handling
  const { error } = await supaAdmin.from('beta_events').insert({
    tester_id: null,
    event_type: 'email_open',
    properties: { inviteId }
  });
  if (error) {
      console.error('Failed to log pixel event:', error);
  }
  
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.status(200).send(pixel);
}