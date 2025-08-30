// FILE: api/user/reset-mfa.ts

import { supaAdmin } from '../_lib/supaAdmin'; // Corrected relative path to your admin client
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token not provided.' });
  }

  // Authenticate the user with the provided token using the admin client
  const { data: { user }, error: userError } = await supaAdmin.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token or user not found.' });
  }

  try {
    // Use the admin client to list all factors for the authenticated user
    const { data: factors, error: listError } = await supaAdmin.auth.mfa.listFactors({
        userId: user.id
    });

    if (listError) throw listError;
    
    // Unenroll all existing TOTP factors for this user
    const unenrollPromises = factors.totp.map(factor => 
        supaAdmin.auth.mfa.unenroll({ userId: user.id, factorId: factor.id })
    );

    await Promise.all(unenrollPromises);

    // Also, ensure the user's profile is updated to reflect the change
    await supaAdmin
      .from('profiles')
      .update({ mfa_enrolled: false })
      .eq('id', user.id);

    return res.status(200).json({ message: 'All existing MFA factors have been reset.' });

  } catch (error: any) {
    console.error(`[API /user/reset-mfa] Error for user ${user.id}:`, error);
    return res.status(500).json({ error: error.message || 'An internal server error occurred.' });
  }
}