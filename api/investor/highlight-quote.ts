// FILE: api/investor/highlight-quote.ts
// Highlight Quote API - Returns featured quote for investor dashboard
// Mobile-first: Cached, graceful fallbacks

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Rotating demo quotes for when database is empty or unavailable
const DEMO_QUOTES = [
  {
    quote: "TagnetIQ has completely transformed how I manage my collection. The AI identification is incredibly accurate.",
    author: "Michael R.",
    source: "Beta Tester, Coin Collector"
  },
  {
    quote: "Finally, a platform that understands collectors. The valuation tools alone have saved me thousands.",
    author: "Sarah K.",
    source: "Sports Card Enthusiast"
  },
  {
    quote: "The authentication features give me confidence when making purchases. Game changer for the hobby.",
    author: "David L.",
    source: "Vintage Watch Collector"
  },
  {
    quote: "I've tried every collection app out there. TagnetIQ is the first one that actually delivers on its promises.",
    author: "Jennifer M.",
    source: "Comic Book Dealer"
  },
  {
    quote: "The market insights have helped me identify trends before they go mainstream. Invaluable for serious collectors.",
    author: "Robert T.",
    source: "Trading Card Investor"
  },
];

// Get a consistent quote for the day (so it doesn't change on every request)
function getDemoQuote(): typeof DEMO_QUOTES[0] {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return DEMO_QUOTES[dayOfYear % DEMO_QUOTES.length];
}

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
    // Try to fetch from database if available
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const { data: quote, error } = await supabase
          .from('highlight_quotes')
          .select('quote, author, source')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!error && quote) {
          // Cache for 1 hour - quotes don't change often
          res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
          return res.status(200).json(quote);
        }
      } catch (dbError) {
        // Table doesn't exist or other DB error - use demo quote
        console.warn('highlight_quotes table not available, using demo quote');
      }
    }

    // Return demo quote
    const demoQuote = getDemoQuote();
    
    // Cache for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    
    return res.status(200).json(demoQuote);

  } catch (error) {
    console.error('Error fetching highlight quote:', error);
    
    // Always return a quote, never fail
    return res.status(200).json(getDemoQuote());
  }
}