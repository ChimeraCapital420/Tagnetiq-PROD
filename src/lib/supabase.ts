import { createClient } from '@supabase/supabase-js';


// Initialize Supabase client
// Using direct values from project configuration
const supabaseUrl = 'https://vxdtmdpxgepwnmxoxejm.supabase.co';
const supabaseKey = 'sb_publishable_rsJ0yD1t7oakJaEVCPSNng_DeyqELUL';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };