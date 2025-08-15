// FILE: src/lib/supaAdmin.ts
// This helper creates a Supabase client that uses the SERVICE_ROLE_KEY 
// for operations requiring admin privileges on the server side.

import { createClient } from '@supabase/supabase-js';

// These variables must be set in your Vercel/deployment environment
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("Supabase admin credentials are not set. API endpoints will fail.");
}

export const supaAdmin = createClient(supabaseUrl, serviceRoleKey);