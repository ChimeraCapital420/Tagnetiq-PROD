// api/_lib/supaAdmin.ts
import { createClient } from '@supabase/supabase-js';

// CORRECTED: These now match the variable names in your .env file and Vercel settings.
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_SECRET || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.warn("Supabase admin credentials are not set. API endpoints will fail.");
}

// This creates the powerful "Admin" client that can bypass Row Level Security.
// It should ONLY EVER be used in server-side code (like in this /api folder).
export const supaAdmin = createClient(supabaseUrl, serviceRoleKey);
