// FILE: api/investor/benchmark-report.ts
// HYDRA v8.0 - Investor Benchmark Report PDF
// Generates a polished PDF report with provider performance data
// Available in the Investor Suite at /admin/investors
//
// GET /api/investor/benchmark-report?format=json   → Raw data
// GET /api/investor/benchmark-report?format=pdf    → PDF download
// GET /api/investor/benchmark-report?format=html   → HTML preview

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildInvestorReport } from '../src/lib/hydra/benchmarks/aggregator.js';
import type { InvestorBenchmarkReport } from '../src/lib/hydra/benchmarks/types.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  
  // Auth check: admin or investor token
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const authToken = (req.headers.authorization || '').replace('Bearer ', '');
  const investorToken = req.query.token as string;
  
  let authorized = false;
  
  if (authToken) {
    const { data: { user } } = await supabase.auth.getUser(authToken);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      authorized = profile?.role === 'admin';
    }
  }
  
  if (!authorized && investorToken) {
    const { data: invite } = await supabase
      .from('investor_invites')
      .select('*')
      .eq('token', investorToken)
      .eq('status', 'active')
      .single();
    authorized = !!invite;
  }
  
  if (!authorized) {
    return res.status(403).json({ error: 'Admin or valid investor token required' });
  }
  
  try {
    const weeks = parseInt(req.query.weeks as string) || 4;
    const format = (req.query.format as string) || 'json';
    
    const report = await buildInvestorReport(weeks);
    
    switch (format) {
      case 'json':
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(report);
      
      case 'html':
        const html = buildReportHTML(report);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
      
      case 'pdf':
        // Return HTML that the client can print-to-PDF
        // (Server-side PDF gen requires puppeteer/chrome which is heavy for Vercel)
        const pdfHtml = buildReportHTML(report);
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="tagnetiq-benchmark-report-${report.generated_at.split('T')[0]}.html"`);
        return res.status(200).send(pdfHtml);
      
      default:
        return res.status(400).json({ error: 'format must be json, html, or pdf' });
    }
    
  } catch (error: any) {
    console.error('❌ Investor benchmark report error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// =============================================================================
// REPORT HTML (print-optimized for PDF export)
// =============================================================================

function buildReportHTML(report: InvestorBenchmarkReport): string {
  const providerRows = report.provider_rankings.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${p.rank}`;
    const mapeColor = p.mape <= 15 ? '#16a34a' : p.mape <= 30 ? '#ca8a04' : '#dc2626';
    const decColor = p.decision_accuracy >= 0.8 ? '#16a34a' : p.decision_accuracy >= 0.6 ? '#ca8a04' : '#dc2626';
    
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:16px;font-weight:700;text-align:center;">${medal}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;">${p.provider_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:18px;font-weight:700;color:#1e1b4b;">${p.composite_score.toFixed(0)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;color:${mapeColor};font-weight:600;">${p.mape.toFixed(1)}%</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;color:${decColor};font-weight:600;">${(p.decision_accuracy * 100).toFixed(0)}%</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;">${(p.avg_speed_ms / 1000).toFixed(1)}s</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#16a34a;">${p.strongest_category}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#dc2626;">${p.weakest_category}</td>
      </tr>
    `;
  }).join('');
  
  const trendRows = report.weekly_trends.map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${t.week}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;font-weight:600;color:#16a34a;">${t.avg_platform_accuracy.toFixed(1)}%</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:14px;">${t.total_analyses}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TagnetIQ HYDRA — AI Provider Benchmark Report</title>
  <style>
    @page { margin: 0.75in; size: letter; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
    body {
      margin: 0;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      background: #fff;
      max-width: 1000px;
      margin: 0 auto;
    }
    h1, h2, h3 { color: #1e1b4b; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px 12px; background: #f9fafb; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e1b4b;padding-bottom:16px;margin-bottom:32px;">
    <div>
      <h1 style="margin:0;font-size:28px;">TagnetIQ HYDRA</h1>
      <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">AI Provider Performance Benchmark Report</p>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#6b7280;">Generated</div>
      <div style="font-size:14px;font-weight:600;">${new Date(report.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div style="font-size:12px;color:#6b7280;">${report.period}</div>
    </div>
  </div>
  
  <!-- Executive Summary -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);border-radius:8px;padding:20px;color:white;">
      <div style="font-size:11px;text-transform:uppercase;opacity:0.7;">Total Analyses</div>
      <div style="font-size:32px;font-weight:800;margin-top:4px;">${report.total_analyses.toLocaleString()}</div>
    </div>
    <div style="background:linear-gradient(135deg,#065f46,#047857);border-radius:8px;padding:20px;color:white;">
      <div style="font-size:11px;text-transform:uppercase;opacity:0.7;">AI Votes Tracked</div>
      <div style="font-size:32px;font-weight:800;margin-top:4px;">${report.total_votes_tracked.toLocaleString()}</div>
    </div>
    <div style="background:linear-gradient(135deg,#1e40af,#2563eb);border-radius:8px;padding:20px;color:white;">
      <div style="font-size:11px;text-transform:uppercase;opacity:0.7;">Providers</div>
      <div style="font-size:32px;font-weight:800;margin-top:4px;">${report.providers_tracked}</div>
    </div>
    <div style="background:linear-gradient(135deg,#7c2d12,#c2410c);border-radius:8px;padding:20px;color:white;">
      <div style="font-size:11px;text-transform:uppercase;opacity:0.7;">Categories</div>
      <div style="font-size:32px;font-weight:800;margin-top:4px;">${report.categories_covered}</div>
    </div>
  </div>
  
  <!-- Methodology -->
  <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:32px;border-left:4px solid #1e1b4b;">
    <h3 style="margin:0 0 8px;font-size:14px;">Methodology</h3>
    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6;">
      Every AI model vote is scored against <strong>market-verified ground truth</strong> — 
      a weighted blend of live eBay sold listings, authority catalog APIs (Numista for coins, 
      Brickset for LEGO, Pokemon TCG for cards, Discogs for vinyl, PSA for graded items, 
      Colnect for 40+ collectible categories), and retail price databases. Models are scored on 
      <strong>price accuracy</strong> (MAPE vs ground truth), <strong>decision accuracy</strong> 
      (BUY/SELL correctness), <strong>response speed</strong>, and <strong>vision identification</strong>.
      Composite score weights: Price 40%, Decision 20%, Speed 20%, Coverage 20%.
    </p>
  </div>
  
  <!-- Provider Rankings Table -->
  <h2 style="font-size:20px;margin:0 0 16px;">Provider Rankings</h2>
  <table>
    <thead>
      <tr>
        <th style="text-align:center;">Rank</th>
        <th>Provider</th>
        <th style="text-align:center;">Score</th>
        <th style="text-align:center;">MAPE</th>
        <th style="text-align:center;">Decision</th>
        <th style="text-align:center;">Speed</th>
        <th>Strongest</th>
        <th>Weakest</th>
      </tr>
    </thead>
    <tbody>
      ${providerRows || '<tr><td colspan="8" style="padding:16px;text-align:center;color:#9ca3af;">Accumulating benchmark data...</td></tr>'}
    </tbody>
  </table>
  
  <!-- Weekly Trends -->
  <div class="page-break"></div>
  <h2 style="font-size:20px;margin:32px 0 16px;">Platform Accuracy Trend</h2>
  <table>
    <thead>
      <tr>
        <th>Week</th>
        <th style="text-align:center;">Platform Accuracy</th>
        <th style="text-align:center;">Analyses</th>
      </tr>
    </thead>
    <tbody>
      ${trendRows || '<tr><td colspan="3" style="padding:16px;text-align:center;color:#9ca3af;">Not enough weeks of data yet</td></tr>'}
    </tbody>
  </table>
  
  <!-- Value Proposition -->
  <div style="margin-top:40px;padding:24px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
    <h3 style="margin:0 0 8px;font-size:16px;color:#15803d;">The TagnetIQ Advantage</h3>
    <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
      TagnetIQ HYDRA is the only platform that <strong>benchmarks AI valuation accuracy against real market data 
      in real-time</strong>. Every scan creates ground truth. Every vote is scored. This data is unavailable 
      anywhere else — AI providers cannot test their models against live resale markets without our pipeline. 
      This positions TagnetIQ as both a consumer product and a <strong>data intelligence company</strong> 
      for the AI industry.
    </p>
  </div>
  
  <!-- Footer -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">
      TagnetIQ HYDRA v8.0 — AI-Powered Resale Intelligence<br/>
      Confidential — For authorized investors and partners only<br/>
      partnerships@tagnetiq.com
    </p>
  </div>
  
  <!-- Print button (hidden in print) -->
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="padding:12px 32px;background:#1e1b4b;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;">
      📄 Export as PDF
    </button>
  </div>
</body>
</html>`;
}