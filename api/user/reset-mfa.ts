// FILE: api/user/reset-mfa.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamic import to handle ES module resolution
async function getSupaAdmin() {
  const { supaAdmin } = await import('../_lib/supaAdmin.js');
  return supaAdmin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token not provided.' });
  }

  try {
    // Get the admin client using dynamic import
    const supaAdmin = await getSupaAdmin();
    
    // Authenticate the user with the provided token using the admin client
    const { data: { user }, error: userError } = await supaAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    // Get all MFA factors for this user from auth schema
    const { data: factors, error: factorsError } = await supaAdmin
      .from('auth.mfa_factors')
      .select('*')
      .eq('user_id', user.id);

    if (factorsError) {
      console.error('Error fetching MFA factors:', factorsError);
      throw new Error(`Failed to fetch MFA factors: ${factorsError.message}`);
    }

    // Delete all MFA factors for this user
    if (factors && factors.length > 0) {
      const { error: deleteError } = await supaAdmin
        .from('auth.mfa_factors')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting MFA factors:', deleteError);
        throw new Error(`Failed to delete MFA factors: ${deleteError.message}`);
      }
    }

    // Update the user's profile to reflect the change
    const { error: profileError } = await supaAdmin
      .from('profiles')
      .update({ mfa_enrolled: false })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    return res.status(200).json({ 
      message: 'All existing MFA factors have been reset.',
      factorsRemoved: factors?.length || 0
    });

  } catch (error: any) {
    console.error(`[API /user/reset-mfa] Error:`, error);
    return res.status(500).json({ 
      error: error.message || 'An internal server error occurred.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}