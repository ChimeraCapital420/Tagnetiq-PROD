// FILE: api/beta/pixel.ts
// Tracking pixel for beta invite email opens.

import { supaAdmin } from '../../src/lib/supaAdmin';
import { verifySignature } from '../../src/lib/crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { i: inviteId, sig: signature } = req.query;

  if (!inviteId || typeof inviteId !== 'string' || !signature || typeof signature !== 'string' || !verifySignature(inviteId, signature)) {
    return res.status(403).end();
  }

  // Log event without waiting
  supaAdmin.from('beta_events').insert({
    tester_id: null, // We don't know the user_id yet
    event_type: 'email_open',
    properties: { inviteId }
  }).catch(console.error);
  
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.status(200).send(pixel);
}