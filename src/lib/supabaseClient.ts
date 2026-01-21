// FILE: src/lib/supabaseClient.ts
// 
// IMPORTANT: This file re-exports from supabase.ts to avoid duplicate clients.
// The warning "Multiple GoTrueClient instances detected" occurs when multiple
// Supabase clients are created. By re-exporting, we ensure a single instance.
//
// If you need the Supabase client, import from either file:
//   import { supabase } from '@/lib/supabase';
//   import { supabase } from '@/lib/supabaseClient';
// Both will use the same client instance.

export { supabase, DatabaseHelper } from './supabase';