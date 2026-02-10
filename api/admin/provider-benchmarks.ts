// FILE: api/admin/provider-benchmarks.ts
// HYDRA v8.0 - Provider Benchmark Admin API
// Triggers weekly aggregation, scorecard emails, and reporting
// Admin-only endpoint (service key or admin user check)
//
// ENDPOINTS (via ?action=):
//   GET  ?action=scorecards&week=2026-02-03          → Get all scorecards for a week
//   GET  ?action=scorecard&provider=openai&week=...   → Get one provider's scorecard
//   GET  ?action=rankings&week=2026-02-03             → Get competitive rankings
//   GET  ?action=investor-report                      → Get investor report data
//   GET  ?action=contacts                             → List all provider contacts
//   POST ?action=aggregate&week=2026-02-03            → Trigger weekly aggregation
//   POST ?action=send-emails&week=2026-02-03          → Send scorecard emails
//   POST ?action=update-contact                       → Update provider contact info
//   GET  ?action=stats                                → Quick benchmark stats

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  aggregateAllProviders,
  buildCompetitiveRankings,
  persistWeeklyAggregates,
  buildInvestorReport,
} from '../src/lib/hydra/benchmarks/aggregator.js';
import { buildScorecardEmail } from '../src/lib/hydra/benchmarks/email-builder.js';
import type { ProviderContact, WeeklyScorecard } from '../src/lib/hydra/benchmarks/types.js';

// =============================================================================
// SUPABASE + AUTH
// =============================================================================

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Simple admin check — expand with proper auth as needed
async function isAdmin(req: VercelRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  const supabase = getSupabase();
  
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  return profile?.role === 'admin';
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Admin check
  const admin = await isAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const action = (req.query.action as string) || '';
  
  try {
    switch (action) {
      // ========================
      // READ OPERATIONS
      // ========================
      
      case 'stats':
        return await handleStats(res);
      
      case 'scorecards':
        return await handleGetScorecards(req, res);
      
      case 'scorecard':
        return await handleGetScorecard(req, res);
      
      case 'rankings':
        return await handleGetRankings(req, res);
      
      case 'investor-report':
        return await handleInvestorReport(res);
      
      case 'contacts':
        return await handleGetContacts(res);
      
      // ========================
      // WRITE OPERATIONS
      // ========================
      
      case 'aggregate':
        return await handleAggregate(req, res);
      
      case 'send-emails':
        return await handleSendEmails(req, res);
      
      case 'update-contact':
        return await handleUpdateContact(req, res);
      
      default:
        return res.status(400).json({ 
          error: 'Invalid action',
          valid_actions: [
            'stats', 'scorecards', 'scorecard', 'rankings',
            'investor-report', 'contacts',
            'aggregate', 'send-emails', 'update-contact',
          ],
        });
    }
  } catch (error: any) {
    console.error(`❌ Benchmark API error (${action}):`, error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
    });
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

// --- Quick stats ---
async function handleStats(res: VercelResponse) {
  const supabase = getSupabase();
  
  const [
    { count: totalBenchmarks },
    { count: totalAnalyses },
    { data: providers },
    { data: recentBenchmarks },
  ] = await Promise.all([
    supabase.from('provider_benchmarks').select('*', { count: 'exact', head: true }),
    supabase.from('provider_benchmarks').select('analysis_id', { count: 'exact', head: true }),
    supabase.from('provider_benchmarks').select('provider_id').limit(10000),
    supabase.from('provider_benchmarks').select('*').order('created_at', { ascending: false }).limit(5),
  ]);
  
  const uniqueProviders = [...new Set(providers?.map((p: any) => p.provider_id) || [])];
  
  return res.status(200).json({
    total_benchmark_records: totalBenchmarks || 0,
    providers_tracked: uniqueProviders,
    provider_count: uniqueProviders.length,
    recent_benchmarks: recentBenchmarks || [],
  });
}

// --- Get all scorecards for a week ---
async function handleGetScorecards(req: VercelRequest, res: VercelResponse) {
  const weekParam = req.query.week as string;
  const { weekStart, weekEnd } = parseWeekParam(weekParam);
  
  // Try cached first
  const supabase = getSupabase();
  const { data: cached } = await supabase
    .from('provider_benchmark_weekly')
    .select('*')
    .eq('week_start', weekStart.toISOString().split('T')[0]);
  
  if (cached && cached.length > 0) {
    return res.status(200).json({ source: 'cached', scorecards: cached });
  }
  
  // Compute fresh
  const scorecards = await aggregateAllProviders(weekStart, weekEnd);
  
  return res.status(200).json({ source: 'computed', scorecards });
}

// --- Get one provider's scorecard ---
async function handleGetScorecard(req: VercelRequest, res: VercelResponse) {
  const provider = req.query.provider as string;
  if (!provider) return res.status(400).json({ error: 'provider param required' });
  
  const weekParam = req.query.week as string;
  const { weekStart, weekEnd } = parseWeekParam(weekParam);
  
  const { aggregateProviderWeek } = await import('../src/lib/hydra/benchmarks/aggregator.js');
  const scorecard = await aggregateProviderWeek(provider, weekStart, weekEnd);
  
  if (!scorecard) {
    return res.status(404).json({ error: `No data for ${provider} in week ${weekParam}` });
  }
  
  return res.status(200).json(scorecard);
}

// --- Get competitive rankings ---
async function handleGetRankings(req: VercelRequest, res: VercelResponse) {
  const weekParam = req.query.week as string;
  const { weekStart, weekEnd } = parseWeekParam(weekParam);
  
  const scorecards = await aggregateAllProviders(weekStart, weekEnd);
  
  if (scorecards.length < 2) {
    return res.status(200).json({ 
      message: 'Need at least 2 providers with data for rankings',
      providers_with_data: scorecards.map(s => s.provider_id),
    });
  }
  
  const rankings = buildCompetitiveRankings(scorecards);
  
  return res.status(200).json({ rankings, scorecards });
}

// --- Investor report data ---
async function handleInvestorReport(res: VercelResponse) {
  const report = await buildInvestorReport(4);
  
  return res.status(200).json(report);
}

// --- List contacts ---
async function handleGetContacts(res: VercelResponse) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('provider_contacts')
    .select('*')
    .order('provider_id');
  
  if (error) return res.status(500).json({ error: error.message });
  
  return res.status(200).json(data);
}

// --- Trigger aggregation ---
async function handleAggregate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  
  const weekParam = (req.query.week || req.body?.week) as string;
  const { weekStart, weekEnd } = parseWeekParam(weekParam);
  
  console.log(`📊 Aggregating benchmarks for week ${weekStart.toISOString().split('T')[0]}`);
  
  const scorecards = await aggregateAllProviders(weekStart, weekEnd);
  
  if (scorecards.length >= 2) {
    buildCompetitiveRankings(scorecards);
  }
  
  await persistWeeklyAggregates(scorecards);
  
  return res.status(200).json({
    message: `Aggregated ${scorecards.length} provider scorecards`,
    week: weekStart.toISOString().split('T')[0],
    providers: scorecards.map(s => ({
      id: s.provider_id,
      name: s.provider_display_name,
      composite: s.composite_score,
      votes: s.total_votes,
      rank: s.overall_rank,
    })),
  });
}

// --- Send scorecard emails ---
async function handleSendEmails(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  
  const weekParam = (req.query.week || req.body?.week) as string;
  const dryRun = req.query.dry_run === 'true' || req.body?.dry_run === true;
  const { weekStart, weekEnd } = parseWeekParam(weekParam);
  
  const supabase = getSupabase();
  
  // Get scorecards
  const scorecards = await aggregateAllProviders(weekStart, weekEnd);
  
  if (scorecards.length < 2) {
    return res.status(200).json({ message: 'Not enough data for scorecards' });
  }
  
  // Build rankings
  const rankings = buildCompetitiveRankings(scorecards);
  
  // Get contacts
  const { data: contacts } = await supabase
    .from('provider_contacts')
    .select('*')
    .neq('email_frequency', 'paused');
  
  if (!contacts || contacts.length === 0) {
    return res.status(200).json({ message: 'No contacts configured' });
  }
  
  const results: any[] = [];
  
  for (const contact of contacts as ProviderContact[]) {
    const scorecard = scorecards.find(s => s.provider_id === contact.provider_id);
    if (!scorecard) {
      results.push({ provider: contact.provider_id, status: 'no_data' });
      continue;
    }
    
    // Build email (with or without rankings based on tier)
    const email = buildScorecardEmail(
      scorecard,
      contact,
      contact.include_rankings ? rankings : undefined
    );
    
    if (!email) {
      results.push({ provider: contact.provider_id, status: 'no_email_configured' });
      continue;
    }
    
    if (dryRun) {
      results.push({
        provider: contact.provider_id,
        status: 'dry_run',
        subject: email.subject,
        to: email.to,
        includes_rankings: email.includes_rankings,
        html_length: email.html.length,
      });
      continue;
    }
    
    // Send via Resend (or your email service)
    try {
      const sent = await sendEmail(email.to, email.subject, email.html);
      
      // Log the send
      await supabase.from('provider_email_log').upsert({
        provider_id: contact.provider_id,
        week_start: weekStart.toISOString().split('T')[0],
        recipient_email: email.to,
        subject: email.subject,
        scorecard_data: scorecard,
        includes_rankings: email.includes_rankings,
        status: sent ? 'sent' : 'failed',
        sent_at: sent ? new Date().toISOString() : null,
      }, { onConflict: 'provider_id,week_start' });
      
      results.push({
        provider: contact.provider_id,
        status: sent ? 'sent' : 'failed',
        to: email.to,
      });
    } catch (err: any) {
      results.push({
        provider: contact.provider_id,
        status: 'error',
        error: err.message,
      });
    }
  }
  
  return res.status(200).json({
    week: weekStart.toISOString().split('T')[0],
    dry_run: dryRun,
    results,
  });
}

// --- Update provider contact ---
async function handleUpdateContact(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  
  const body = req.body;
  if (!body?.provider_id) {
    return res.status(400).json({ error: 'provider_id required' });
  }
  
  const supabase = getSupabase();
  
  const updateFields: any = {};
  const allowedFields = [
    'primary_email', 'secondary_email', 'contact_name', 'contact_title',
    'relationship_status', 'email_frequency', 'include_rankings', 'notes',
    'models_tracked', 'provider_display_name',
  ];
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateFields[field] = body[field];
    }
  }
  
  updateFields.updated_at = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('provider_contacts')
    .update(updateFields)
    .eq('provider_id', body.provider_id)
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  return res.status(200).json(data);
}

// =============================================================================
// HELPERS
// =============================================================================

function parseWeekParam(weekParam?: string): { weekStart: Date; weekEnd: Date } {
  let weekStart: Date;
  
  if (weekParam) {
    weekStart = new Date(weekParam + 'T00:00:00Z');
  } else {
    // Default to current week (Monday start)
    weekStart = new Date();
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday = 0
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
  }
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  return { weekStart, weekEnd };
}

/**
 * Send email via Resend API
 * Replace with your preferred email service
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  
  if (!resendKey) {
    console.warn('⚠️ RESEND_API_KEY not configured, skipping email send');
    return false;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TagnetIQ Benchmarks <benchmarks@tagnetiq.com>',
        to: [to],
        subject,
        html,
      }),
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error('❌ Resend error:', err);
      return false;
    }
    
    return true;
  } catch (err: any) {
    console.error('❌ Email send failed:', err.message);
    return false;
  }
}