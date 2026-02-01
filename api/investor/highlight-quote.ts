// FILE: api/investor/highlight-quote.ts
// Returns highlight quotes for investor dashboard
// Table: highlight_quotes (1 row exists!)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Query highlight_quotes table - you have 1 real row!
    const { data: quotes, error } = await supabase
      .from('highlight_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching quotes:', error);
      // Return a placeholder if table query fails
      return res.status(200).json({
        quote: "Building the future of collectibles valuation.",
        author: "TagnetIQ Team",
        role: "Founders",
        source: "placeholder"
      });
    }

    // If we have real quotes, return one
    if (quotes && quotes.length > 0) {
      // Rotate through quotes based on day of year
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
      const selectedQuote = quotes[dayOfYear % quotes.length];
      
      return res.status(200).json({
        quote: selectedQuote.quote || selectedQuote.text || selectedQuote.content,
        author: selectedQuote.author || selectedQuote.name || 'Anonymous',
        role: selectedQuote.role || selectedQuote.title || 'Collector',
        avatar: selectedQuote.avatar_url || selectedQuote.avatar,
        source: 'database',
        id: selectedQuote.id,
      });
    }

    // No quotes in database - return a simple placeholder
    return res.status(200).json({
      quote: "Building the future of collectibles valuation.",
      author: "TagnetIQ Team", 
      role: "Founders",
      source: "placeholder"
    });

  } catch (error) {
    console.error('Error in highlight-quote:', error);
    return res.status(200).json({
      quote: "Building the future of collectibles valuation.",
      author: "TagnetIQ Team",
      role: "Founders", 
      source: "error_fallback"
    });
  }
}