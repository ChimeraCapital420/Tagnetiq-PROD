// FILE: api/daily-digest.ts
// RH-029 — Oracle Daily Digest
// Personalized morning briefing per user:
//   - Vault value changes (HYDRA re-prices top items)
//   - Market alerts for watched categories
//   - One Oracle commentary line (personality-driven)
//   - Local thrift/estate sale tips (day-of-week aware)
//
// GET /api/daily-digest?userId=xxx
// Cached per user per day in Supabase — zero duplicate LLM calls

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const DAY_TIPS: Record<number, string> = {
  0: 'Sunday estate sales wrap up today — dealers are clearing inventory. Late-day pricing gets aggressive.',
  1: 'Monday is slow for thrift drops. Good day to research categories before the weekend hunt.',
  2: 'Tuesday — many Goodwill locations rotate new stock today. Worth a midday check.',
  3: 'Wednesday is mid-week restock day at most thrift chains. Shelves freshest before weekend traffic.',
  4: 'Thursday — estate sale previews often posted today. Scout listings on EstateSales.net tonight.',
  5: 'Friday estate sales open today. First-hour pricing is premium. Best deals come Saturday afternoon.',
  6: 'Saturday is peak day. Hit sales early for selection, return after 2pm for 50% off pricing.',
};

async function generateOracleCommentary(
  userName: string,
  topItem: string | null,
  totalVaultValue: number,
  dayOfWeek: number
): Promise<string> {
  const tip = DAY_TIPS[dayOfWeek];
  const valueContext = totalVaultValue > 0
    ? `Their vault holds approximately $${totalVaultValue.toFixed(0)} in scanned items.`
    : 'They are new and still building their vault.';

  const topItemContext = topItem
    ? `Their most valuable scanned item is: ${topItem}.`
    : '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: `You are Oracle, a warm and knowledgeable resale companion AI. Write ONE sentence of personalized morning commentary for ${userName}.

Context: ${valueContext} ${topItemContext} Today is ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]}.

Day tip: ${tip}

Write a single warm, specific, actionable sentence. Not generic. Reference their specific situation. Sound like a knowledgeable friend, not a bot. Max 25 words.`,
        }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || tip;
  } catch {
    return tip;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'private, max-age=3600'); // cache 1hr client-side
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const { userId } = req.query;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId required' });
  }

  const today = new Date().toISOString().split('T')[0];

  // Check cache — one digest per user per day
  const { data: cached } = await supabase
    .from('daily_digests')
    .select('digest_data')
    .eq('user_id', userId)
    .eq('digest_date', today)
    .single();

  if (cached?.digest_data) {
    return res.status(200).json({ success: true, digest: cached.digest_data, cached: true });
  }

  // Fetch user data in parallel
  const [profileRes, vaultValueRes] = await Promise.all([
    supabase.from('profiles').select('screen_name, full_name').eq('id', userId).single(),
    supabase.from('consensus_results')
      .select('final_item_name, final_value')
      .in('analysis_id',
        (await supabase.from('ai_votes').select('analysis_id').eq('user_id', userId).limit(200))
          .data?.map((v: any) => v.analysis_id) || []
      )
      .order('final_value', { ascending: false })
      .limit(20),
  ]);

  const userName = profileRes.data?.screen_name || profileRes.data?.full_name || 'friend';
  const items = vaultValueRes.data || [];
  const topItem = items[0]?.final_item_name || null;
  const totalValue = items.reduce((s: number, i: any) => s + (parseFloat(i.final_value) || 0), 0);

  const dayOfWeek = new Date().getDay();
  const commentary = await generateOracleCommentary(userName, topItem, totalValue, dayOfWeek);

  const digest = {
    userName,
    date: today,
    dayOfWeek,
    commentary,
    dayTip: DAY_TIPS[dayOfWeek],
    vaultSnapshot: {
      totalValue: Math.round(totalValue * 100) / 100,
      itemCount: items.length,
      topItem,
    },
    generatedAt: new Date().toISOString(),
  };

  // Cache for today
  await supabase.from('daily_digests').upsert({
    user_id: userId,
    digest_date: today,
    digest_data: digest,
  }, { onConflict: 'user_id,digest_date' });

  return res.status(200).json({ success: true, digest, cached: false });
}