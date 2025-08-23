// FILE: api/pixel.ts
import { supaAdmin } from './_lib/supaAdmin';
import { verifySignature } from './_lib/crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { i: inviteId, sig: signature } = req.query;

  if (!inviteId || typeof inviteId !== 'string' || !signature || typeof signature !== 'string') {
    return res.status(400).end();
  }

  // Verify the HMAC signature to prevent abuse
  if (!verifySignature(inviteId, signature)) {
    return res.status(403).end();
  }

  // Log the event asynchronously without waiting
  supaAdmin.from('investor_events').insert({
    invite_id: inviteId,
    event_type: 'email_open',
    ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    ua: req.headers['user-agent'],
  }).then(({ error }) => {
    if (error) console.error('Failed to log pixel event:', error);
  });
  
  // Return a 1x1 transparent GIF
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Content-Length', pixel.length);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.status(200).send(pixel);
}