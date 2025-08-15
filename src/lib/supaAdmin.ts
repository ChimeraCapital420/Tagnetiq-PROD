// FILE: src/lib/supaAdmin.ts (CORRECTED)

import { createClient } from '@supabase/supabase-js';

// CORRECTED: Use the correct environment variable names to match your .env file.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !serviceRoleKey) {
  // This warning will now only appear if the variables are truly missing from your .env file.
  console.warn("Supabase admin credentials are not set. API endpoints will fail.");
}

export const supaAdmin = createClient(supabaseUrl, serviceRoleKey);