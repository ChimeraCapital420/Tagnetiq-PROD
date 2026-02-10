// FILE: api/cron/weekly-benchmarks.ts
// HYDRA v8.0 - Weekly Benchmark Cron Job
// Triggered by Vercel Cron every Monday at 9:00 AM UTC
//
// vercel.json config:
//   "crons": [{ "path": "/api/cron/weekly-benchmarks", "schedule": "0 9 * * 1" }]
//
// What it does:
//   1. Aggregates last week's benchmarks into provider scorecards
//   2. Builds competitive rankings
//   3. Persists to provider_benchmark_weekly table
//   4. Sends scorecard emails to all configured contacts
//   5. Logs everything to provider_email_log

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  aggregateAllProviders,
  buildCompetitiveRankings,
  persistWeeklyAggregates,
} from '../src/lib/hydra/benchmarks/aggregator.js';
import { buildScorecardEmail } from '../src/lib/hydra/benchmarks/email-builder.js';
import { createClient } from '@supabase/supabase-js';
import type { ProviderContact } from '../src/lib/hydra/benchmarks/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel sends this automatically)
  const cronSecret = req.headers['authorization'];
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;
  
  // Allow manual trigger from admin or Vercel cron
  if (cronSecret !== expectedSecret && req.headers['x-vercel-cron'] !== '1') {
    // Check if admin user
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const authToken = (req.headers.authorization || '').replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(authToken);
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin required' });
    }
  }
  
  console.log('📊 === WEEKLY BENCHMARK CRON START ===');
  const startTime = Date.now();
  
  try {
    // Calculate last week's range (Monday to Sunday)
    const now = new Date();
    const weekEnd = new Date(now);
    const dayOfWeek = weekEnd.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekEnd.setDate(weekEnd.getDate() - diffToMonday);
    weekEnd.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const weekLabel = weekStart.toISOString().split('T')[0];
    console.log(`📅 Processing week: ${weekLabel} → ${weekEnd.toISOString().split('T')[0]}`);
    
    // Step 1: Aggregate all providers
    const scorecards = await aggregateAllProviders(weekStart, weekEnd);
    console.log(`📊 Aggregated ${scorecards.length} provider scorecards`);
    
    if (scorecards.length === 0) {
      console.log('⚠️ No benchmark data for last week, skipping');
      return res.status(200).json({ message: 'No data for last week', week: weekLabel });
    }
    
    // Step 2: Build rankings (need 2+ providers)
    let rankings = undefined;
    if (scorecards.length >= 2) {
      rankings = buildCompetitiveRankings(scorecards);
      console.log(`🏆 Rankings built: ${rankings.overall.map(r => `#${r.rank} ${r.provider_id}`).join(', ')}`);
    }
    
    // Step 3: Persist to weekly table
    await persistWeeklyAggregates(scorecards);
    console.log('💾 Weekly aggregates persisted');
    
    // Step 4: Send emails
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
    
    const { data: contacts } = await supabase
      .from('provider_contacts')
      .select('*')
      .neq('email_frequency', 'paused');
    
    const emailResults: any[] = [];
    
    for (const contact of (contacts || []) as ProviderContact[]) {
      const scorecard = scorecards.find(s => s.provider_id === contact.provider_id);
      if (!scorecard || !contact.primary_email) {
        emailResults.push({ provider: contact.provider_id, status: 'skipped' });
        continue;
      }
      
      const email = buildScorecardEmail(
        scorecard,
        contact,
        contact.include_rankings ? rankings : undefined
      );
      
      if (!email) {
        emailResults.push({ provider: contact.provider_id, status: 'no_email' });
        continue;
      }
      
      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      let sent = false;
      
      if (resendKey) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'TagnetIQ Benchmarks <benchmarks@tagnetiq.com>',
              to: [email.to],
              subject: email.subject,
              html: email.html,
            }),
          });
          sent = response.ok;
        } catch (err: any) {
          console.error(`❌ Email failed for ${contact.provider_id}:`, err.message);
        }
      }
      
      // Log
      await supabase.from('provider_email_log').upsert({
        provider_id: contact.provider_id,
        week_start: weekLabel,
        recipient_email: email.to,
        recipient_name: contact.contact_name,
        subject: email.subject,
        scorecard_data: scorecard,
        includes_rankings: email.includes_rankings,
        status: sent ? 'sent' : (resendKey ? 'failed' : 'no_api_key'),
        sent_at: sent ? new Date().toISOString() : null,
      }, { onConflict: 'provider_id,week_start' });
      
      emailResults.push({
        provider: contact.provider_id,
        status: sent ? 'sent' : 'pending',
        to: email.to,
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Weekly benchmark cron complete in ${duration}ms`);
    
    return res.status(200).json({
      success: true,
      week: weekLabel,
      providers_aggregated: scorecards.length,
      rankings_built: !!rankings,
      emails: emailResults,
      duration_ms: duration,
    });
    
  } catch (error: any) {
    console.error('❌ Weekly benchmark cron failed:', error);
    return res.status(500).json({
      error: 'Cron job failed',
      details: error.message,
    });
  }
}