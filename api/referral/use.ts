// FILE: api/referral/use.ts
// Records when a referral code is used.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Referral code is required.' });

  // In a real implementation, you'd validate the code against the beta_testers table
  console.log(`Referral code used: ${code}`);
  
  // Set a cookie to attribute the signup later
  res.setHeader('Set-Cookie', `tq_referral_code=${code}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`); // 7 days
  return res.status(200).json({ success: true });
}