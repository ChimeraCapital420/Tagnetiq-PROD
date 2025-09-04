// FILE: api/_lib/supaAdmin.ts

import { createClient } from '@supabase/supabase-js';

// Using standard Supabase environment variable names
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[supaAdmin] CRITICAL: Supabase admin credentials are not set!");
  console.error("[supaAdmin] Required environment variables:");
  console.error("  - SUPABASE_URL");
  console.error("  - SUPABASE_SERVICE_ROLE_KEY");
}

// This creates the powerful "Admin" client that can bypass Row Level Security.
// It should ONLY EVER be used in server-side code (like in this /api folder).
export const supaAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export a verification function to test the connection
export async function verifyAdminConnection() {
  try {
    const { data, error } = await supaAdmin.from('profiles').select('count').limit(1);
    if (error) throw error;
    return { success: true, message: 'Admin connection verified' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}