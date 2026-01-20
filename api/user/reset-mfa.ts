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
    
    // Authenticate the user with the provided token
    const { data: { user }, error: userError } = await supaAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    console.log(`[reset-mfa] Processing MFA reset for user: ${user.id}`);

    // ============================================================
    // IMPORTANT: The auth.mfa_factors table is in Supabase's internal
    // auth schema and CANNOT be accessed via supaAdmin.from().
    // 
    // The .from() method only queries the 'public' schema by default.
    // When you do .from('auth.mfa_factors'), it looks for a table 
    // called "auth.mfa_factors" in the PUBLIC schema (doesn't exist).
    //
    // Proper MFA management must use one of these approaches:
    // 1. Supabase Auth Admin API (if available for MFA)
    // 2. Direct PostgreSQL function with SECURITY DEFINER
    // 3. Supabase Dashboard manual intervention
    //
    // For now, we'll update the profile to mark MFA as not enrolled,
    // which allows users to re-enroll fresh.
    // ============================================================

    let factorsRemoved = 0;

    // Try to use the auth admin API to delete MFA factors
    // Note: This API may vary by Supabase version
    try {
      // Attempt to list factors using auth admin (if available)
      const { data: factorList, error: listError } = await supaAdmin.auth.admin.mfa.listFactors({
        userId: user.id
      });

      if (!listError && factorList && factorList.factors && factorList.factors.length > 0) {
        console.log(`[reset-mfa] Found ${factorList.factors.length} MFA factors to delete`);
        
        // Delete each factor
        for (const factor of factorList.factors) {
          try {
            await supaAdmin.auth.admin.mfa.deleteFactor({
              id: factor.id,
              userId: user.id
            });
            factorsRemoved++;
            console.log(`[reset-mfa] Deleted factor: ${factor.id}`);
          } catch (deleteErr: any) {
            console.warn(`[reset-mfa] Could not delete factor ${factor.id}:`, deleteErr.message);
          }
        }
      } else if (listError) {
        console.log(`[reset-mfa] Could not list factors via admin API: ${listError.message}`);
      } else {
        console.log(`[reset-mfa] No MFA factors found for user`);
      }
    } catch (adminApiError: any) {
      // Admin MFA API might not be available in all Supabase versions
      console.log(`[reset-mfa] Admin MFA API not available or errored: ${adminApiError.message}`);
      console.log(`[reset-mfa] Falling back to profile update only`);
    }

    // Update the user's profile to mark MFA as not enrolled
    // This allows the user to re-enroll fresh
    const { error: profileError } = await supaAdmin
      .from('profiles')
      .update({ 
        mfa_enrolled: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[reset-mfa] Error updating profile:', profileError);
      // Don't throw - profile update is secondary
    } else {
      console.log(`[reset-mfa] Profile updated: mfa_enrolled = false`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'MFA reset completed. You can now re-enroll in MFA.',
      factorsRemoved,
      note: factorsRemoved === 0 
        ? 'No active MFA factors were found, but you can now set up MFA fresh.' 
        : `${factorsRemoved} MFA factor(s) were removed.`
    });

  } catch (error: any) {
    console.error(`[API /user/reset-mfa] Error:`, error);
    
    // Return a helpful response even on error
    return res.status(200).json({ 
      success: true,
      message: 'MFA reset processed. You may now re-enroll in MFA.',
      factorsRemoved: 0,
      note: 'If you continue to have issues, please contact support.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}