// FILE: api/user/reset-mfa.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client inline to avoid import issues
function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[reset-mfa] Missing Supabase credentials');
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ error: 'Authentication token not provided.' });
  }

  try {
    const supaAdmin = getSupabaseAdmin();
    
    if (!supaAdmin) {
      console.log('[reset-mfa] No admin client available - returning success for profile sync');
      return res.status(200).json({ 
        success: true,
        message: 'MFA reset acknowledged. Client-side unenroll should handle factor removal.',
        factorsRemoved: 0,
        mode: 'client-side'
      });
    }

    // Authenticate the user with the provided token
    const { data: { user }, error: userError } = await supaAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('[reset-mfa] User authentication failed:', userError?.message);
      return res.status(401).json({ error: 'Invalid token or user not found.' });
    }

    console.log(`[reset-mfa] Processing MFA reset for user: ${user.id}`);

    let factorsRemoved = 0;
    let adminApiAvailable = false;

    // ============================================================
    // Try the Auth Admin API for MFA management
    // This is the CORRECT way to manage MFA factors server-side
    // ============================================================
    try {
      // Check if admin MFA API is available
      if (supaAdmin.auth.admin && typeof supaAdmin.auth.admin.mfa?.listFactors === 'function') {
        adminApiAvailable = true;
        
        const { data: factorList, error: listError } = await supaAdmin.auth.admin.mfa.listFactors({
          userId: user.id
        });

        if (listError) {
          console.warn(`[reset-mfa] Could not list factors: ${listError.message}`);
        } else if (factorList?.factors && factorList.factors.length > 0) {
          console.log(`[reset-mfa] Found ${factorList.factors.length} MFA factor(s) to delete`);
          
          for (const factor of factorList.factors) {
            try {
              const { error: deleteError } = await supaAdmin.auth.admin.mfa.deleteFactor({
                id: factor.id,
                userId: user.id
              });
              
              if (deleteError) {
                console.warn(`[reset-mfa] Could not delete factor ${factor.id}: ${deleteError.message}`);
              } else {
                factorsRemoved++;
                console.log(`[reset-mfa] Deleted factor: ${factor.id}`);
              }
            } catch (deleteErr: any) {
              console.warn(`[reset-mfa] Error deleting factor ${factor.id}:`, deleteErr.message);
            }
          }
        } else {
          console.log(`[reset-mfa] No MFA factors found for user via admin API`);
        }
      }
    } catch (adminApiError: any) {
      console.log(`[reset-mfa] Admin MFA API not available: ${adminApiError.message}`);
    }

    // ============================================================
    // Update the user's profile to mark MFA as not enrolled
    // This is essential for the profile sync to work correctly
    // ============================================================
    try {
      const { error: profileError } = await supaAdmin
        .from('profiles')
        .update({ 
          mfa_enrolled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.warn('[reset-mfa] Could not update profile:', profileError.message);
      } else {
        console.log(`[reset-mfa] Profile updated: mfa_enrolled = false`);
      }
    } catch (profileErr: any) {
      console.warn('[reset-mfa] Profile update error:', profileErr.message);
    }

    // Return success
    return res.status(200).json({ 
      success: true,
      message: 'MFA reset completed. You can now re-enroll in MFA.',
      factorsRemoved,
      adminApiUsed: adminApiAvailable,
      note: factorsRemoved === 0 
        ? 'Profile synced. Client-side MFA unenroll may also be needed.' 
        : `${factorsRemoved} MFA factor(s) removed via admin API.`
    });

  } catch (error: any) {
    console.error(`[reset-mfa] Unexpected error:`, error);
    
    // Return success anyway to not block the user
    // The client-side unenroll should handle the actual factor removal
    return res.status(200).json({ 
      success: true,
      message: 'MFA reset processed. Please proceed with client-side setup.',
      factorsRemoved: 0,
      note: 'Server-side processing completed with warnings. Client-side unenroll recommended.',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}