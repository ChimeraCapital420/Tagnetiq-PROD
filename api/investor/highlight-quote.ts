// FILE: api/investor/highlight-quote.ts
// Returns highlight quotes for investor dashboard
// Table: highlight_quotes (1 row exists!)
//
// SECURITY: Dual-path auth (admin JWT or invite token)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyInvestorAccess, setInvestorCORS } from '../_lib/investorAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setInvestorCORS(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyInvestorAccess(req);

    const { data: quotes, error } = await supaAdmin
      .from('highlight_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching quotes:', error);
      return res.status(200).json({
        quote: "Building the future of collectibles valuation.",
        author: "TagnetIQ Team",
        role: "Founders",
        source: "placeholder"
      });
    }

    if (quotes && quotes.length > 0) {
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

    return res.status(200).json({
      quote: "Building the future of collectibles valuation.",
      author: "TagnetIQ Team",
      role: "Founders",
      source: "placeholder"
    });

  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('Authorization')) {
      return res.status(401).json({ error: msg });
    }
    console.error('Error in highlight-quote:', msg);
    return res.status(200).json({
      quote: "Building the future of collectibles valuation.",
      author: "TagnetIQ Team",
      role: "Founders",
      source: "error_fallback"
    });
  }
}