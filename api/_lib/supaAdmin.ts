// FILE: api/_lib/supaAdmin.ts (CORRECTED)

import { createClient } from '@supabase/supabase-js';

// CORRECTED: These now match the variable names in your .env file.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("Supabase admin credentials are not set. API endpoints will fail.");
}

export const supaAdmin = createClient(supabaseUrl, serviceRoleKey);