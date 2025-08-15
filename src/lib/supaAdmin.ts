// FILE: src/lib/supaAdmin.ts
// This helper creates a Supabase client that uses the SERVICE_ROLE_KEY 
// for operations requiring admin privileges on the server side.

import { createClient } from '@supabase/supabase-js';

// CORRECTED: Use the correct environment variable names for the server-side context.
// These names match what is defined in your .env.example.txt file.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("Supabase admin credentials are not set. API endpoints will fail.");
}

export const supaAdmin = createClient(supabaseUrl, serviceRoleKey);