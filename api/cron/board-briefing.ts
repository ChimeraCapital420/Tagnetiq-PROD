// FILE: api/cron/board-briefing.ts
// ═══════════════════════════════════════════════════════════════════════
// THE BUFFETT FEED — Autonomous Board Intelligence Briefing
// ═══════════════════════════════════════════════════════════════════════
//
// Runs daily at 5:00 AM Mountain Time via Vercel cron.
// Each board member gets 2-3 targeted Perplexity sonar-pro searches
// based on their domain expertise and TagnetIQ's strategic context.
//
// Warren Buffett reads 500 pages a day.
// Ray Dalio runs economic simulations on global patterns.
// Larry Ellison bets everything on what he sees coming.
//
// Your board does all three — automatically, every morning,
// before you even open the app.
//
// Domain coverage:
//   CFO        → Cash flow businesses, acquisition multiples, tax code,
//                SBA rates, commercial real estate, boring business deals
//   Legal      → AI platform liability, privacy enforcement, IP filings,
//                resale regulation, tax shelter structures
//   CSO        → eBay/Mercari policy changes, competitor funding,
//                resale market consolidation, strategic opportunities
//   CTO        → New AI models, Vercel/Supabase updates, security threats,
//                HYDRA provider status, open source opportunities
//   COO        → Operational efficiency tools, SaaS pricing trends,
//                supply chain signals, process automation
//   CHRO       → Remote talent market, compensation benchmarks,
//                founder wellness, team scaling patterns
//   CMO        → Resale consumer behavior, social commerce trends,
//                content virality in secondhand markets
//   Research   → Physical asset AI research, economic inequality data,
//                food system disruptions, emerging market signals
//   Psychology → Founder decision fatigue patterns, negotiation psychology,
//                behavioral economics in resale
//   General    → TagnetIQ competitive landscape, platform economy trends
//
// Add Vercel cron in vercel.json:
//   {
//     "crons": [{ "path": "/api/cron/board-briefing", "schedule": "0 12 * * *" }]
//   }
//   (12:00 UTC = 05:00 Mountain Time)
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

const PERPLEXITY_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const RESEARCH_MODEL      = 'sonar-pro';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// =============================================================================
// DOMAIN INTELLIGENCE QUERIES
// Per member — 2-3 searches that matter most for their domain
// =============================================================================

interface DomainQuery {
  query: string;
  label: string;
}

const DOMAIN_QUERIES: Record<string, DomainQuery[]> = {
  CFO: [
    {
      label: 'boring_business_deals',
      query: 'cash flowing small business acquisitions laundromat car wash storage unit vending 2026 for sale cap rate',
    },
    {
      label: 'acquisition_financing',
      query: 'SBA loan rates small business acquisition financing current rates April 2026',
    },
    {
      label: 'tax_structures',
      query: 'tax shelter strategies pass-through entity LLC S-corp 2026 small business acquisition wealth management',
    },
  ],
  Legal: [
    {
      label: 'ai_platform_liability',
      query: 'AI platform liability lawsuits FTC enforcement actions 2026 this week',
    },
    {
      label: 'resale_regulation',
      query: 'resale marketplace regulation privacy data collection enforcement 2026',
    },
    {
      label: 'ip_filings',
      query: 'physical asset AI patent filings computer vision resale valuation 2026',
    },
  ],
  CSO: [
    {
      label: 'marketplace_shifts',
      query: 'eBay Mercari Poshmark marketplace policy changes seller fees 2026',
    },
    {
      label: 'competitor_moves',
      query: 'resale AI startup funding valuation artificial intelligence collectibles 2026',
    },
    {
      label: 'strategic_opportunities',
      query: 'physical asset intelligence platform partnership acquisition opportunity 2026',
    },
  ],
  CTO: [
    {
      label: 'new_ai_models',
      query: 'new AI vision model released multimodal image recognition April 2026',
    },
    {
      label: 'platform_updates',
      query: 'Vercel Supabase platform updates changelog April 2026',
    },
    {
      label: 'open_source_tools',
      query: 'open source AI tools computer vision product recognition 2026',
    },
  ],
  COO: [
    {
      label: 'saas_operations',
      query: 'SaaS operational efficiency tools automation small team 2026',
    },
    {
      label: 'supply_chain',
      query: 'resale supply chain collector market supply demand signals 2026',
    },
  ],
  CHRO: [
    {
      label: 'talent_market',
      query: 'remote developer talent market rates AI startup hiring 2026',
    },
    {
      label: 'founder_wellness',
      query: 'founder burnout prevention early stage startup team culture 2026',
    },
  ],
  CMO: [
    {
      label: 'consumer_behavior',
      query: 'resale secondhand market consumer behavior trends Gen Z millennial 2026',
    },
    {
      label: 'social_commerce',
      query: 'social commerce TikTok Instagram resale collectibles viral 2026',
    },
  ],
  Research: [
    {
      label: 'ai_research',
      query: 'physical asset intelligence AI research paper consensus valuation 2026',
    },
    {
      label: 'economic_signals',
      query: 'economic inequality wealth gap data 2026 trends emerging markets',
    },
    {
      label: 'food_systems',
      query: 'food insecurity economic solutions private capital food system 2026',
    },
  ],
  Psychology: [
    {
      label: 'negotiation_research',
      query: 'negotiation psychology behavioral economics high stakes deals 2026',
    },
    {
      label: 'decision_fatigue',
      query: 'founder decision fatigue cognitive load startup leadership 2026',
    },
  ],
  General: [
    {
      label: 'platform_economy',
      query: 'platform economy marketplace trends gig economy 2026',
    },
    {
      label: 'wealth_management',
      query: 'wealth management family office investment strategy boring business 2026',
    },
  ],
};

// =============================================================================
// MEMBER → DOMAIN MAPPING
// =============================================================================

function getDomainForMember(title: string, slug: string): string {
  const t = title.toUpperCase();
  const s = slug.toLowerCase();

  if (t.includes('FINANCIAL') || t.includes('CFO') || s.includes('cfo')) return 'CFO';
  if (t.includes('LEGAL') || t.includes('COUNSEL')) return 'Legal';
  if (t.includes('STRATEGY') || t.includes('CSO') || s.includes('strateg')) return 'CSO';
  if (t.includes('TECHNOLOGY') || t.includes('CTO') || s.includes('tech')) return 'CTO';
  if (t.includes('OPERATIONS') || t.includes('COO') || s.includes('ops')) return 'COO';
  if (t.includes('PEOPLE') || t.includes('HR') || t.includes('CHRO')) return 'CHRO';
  if (t.includes('MARKETING') || t.includes('CMO')) return 'CMO';
  if (t.includes('RESEARCH') || t.includes('INTELLIGENCE')) return 'Research';
  if (t.includes('PSYCHOLOGY') || t.includes('BEHAVIORAL')) return 'Psychology';
  return 'General';
}

// =============================================================================
// SINGLE SEARCH
// =============================================================================

async function runSearch(
  query: string,
  memberName: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(PERPLEXITY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:    RESEARCH_MODEL,
      messages: [
        {
          role:    'system',
          content: `You are a senior intelligence analyst briefing ${memberName}, a board member at TagnetIQ (AI-powered physical asset intelligence platform). Provide a concise, factual, actionable briefing paragraph. Lead with the most important finding. Include specific numbers, dates, and names where available. Maximum 200 words.`,
        },
        { role: 'user', content: query },
      ],
      temperature: 0.1,
      max_tokens:  400,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Perplexity ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// =============================================================================
// BUILD BRIEFING FOR ONE MEMBER
// =============================================================================

async function buildMemberBriefing(
  member: { slug: string; name: string; title: string },
  apiKey: string,
  today: string,
): Promise<{
  memberSlug: string;
  domain: string;
  sections: Array<{ label: string; content: string }>;
  briefingText: string;
}> {
  const domain  = getDomainForMember(member.title, member.slug);
  const queries = DOMAIN_QUERIES[domain] || DOMAIN_QUERIES.General;

  console.log(`[Briefing] ${member.name} (${domain}): running ${queries.length} searches`);

  // Run all searches for this member in parallel
  const results = await Promise.allSettled(
    queries.map(q => runSearch(q.query, member.name, apiKey).then(content => ({
      label: q.label,
      content,
    })))
  );

  const sections = results
    .filter((r): r is PromiseFulfilledResult<{ label: string; content: string }> =>
      r.status === 'fulfilled' && r.value.content.length > 50
    )
    .map(r => r.value);

  // Build single briefing text for prompt injection
  const briefingText = sections.length > 0
    ? `## ${member.name}'s Morning Intelligence Brief — ${today}\n\n` +
      sections.map(s => `**${s.label.replace(/_/g, ' ').toUpperCase()}**\n${s.content}`).join('\n\n')
    : '';

  return { memberSlug: member.slug, domain, sections, briefingText };
}

// =============================================================================
// PERSIST BRIEFING
// =============================================================================

async function persistBriefing(
  memberSlug: string,
  today: string,
  briefingText: string,
  sections: Array<{ label: string; content: string }>,
): Promise<void> {
  await supabaseAdmin
    .from('board_member_briefings')
    .upsert({
      member_slug:   memberSlug,
      briefing_date: today,
      briefing_text: briefingText,
      sections:      sections,
      generated_at:  new Date().toISOString(),
      model:         RESEARCH_MODEL,
    }, { onConflict: 'member_slug,briefing_date' });
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Security — only cron or admin can trigger
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow Vercel cron (no auth header in Vercel cron calls)
    if (authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'Perplexity API key not configured.' });
  }

  const today = new Date().toISOString().split('T')[0];

  console.log(`[Briefing] Starting Buffett Feed for ${today}`);

  try {
    // Load all active board members
    const { data: members, error } = await supabaseAdmin
      .from('boardroom_members')
      .select('slug, name, title')
      .eq('is_active', true)
      .order('display_order');

    if (error || !members || members.length === 0) {
      return res.status(500).json({ error: 'No active board members found.' });
    }

    console.log(`[Briefing] Processing ${members.length} board members`);

    // Process all members — batched in groups of 3 to avoid rate limits
    const batchSize = 3;
    const results: Array<{ member: string; success: boolean; sections: number }> = [];

    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (member) => {
          const briefing = await buildMemberBriefing(member, apiKey, today);
          await persistBriefing(
            briefing.memberSlug,
            today,
            briefing.briefingText,
            briefing.sections,
          );
          return {
            member: member.slug,
            success: true,
            sections: briefing.sections.length,
          };
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          console.log(`[Briefing] ✅ ${result.value.member}: ${result.value.sections} sections`);
        } else {
          console.error(`[Briefing] ❌ Batch member failed:`, result.reason?.message);
          results.push({ member: 'unknown', success: false, sections: 0 });
        }
      }

      // Rate limit pause between batches
      if (i + batchSize < members.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed     = results.filter(r => !r.success).length;

    console.log(`[Briefing] Complete: ${successful} succeeded, ${failed} failed`);

    return res.status(200).json({
      date:       today,
      members:    members.length,
      successful,
      failed,
      results,
      model:      RESEARCH_MODEL,
    });

  } catch (error: any) {
    console.error('[Briefing] Fatal error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}