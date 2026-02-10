// FILE: src/lib/hydra/benchmarks/email-builder.ts
// HYDRA v8.0 - Provider Scorecard Email Builder
// Generates polished HTML emails for each AI provider
// Free tier: own performance data only
// Paid tier: competitive rankings included

import type { WeeklyScorecard, CompetitiveRanking, ScorecardEmail, ProviderContact } from './types.js';

// =============================================================================
// BUILD SCORECARD EMAIL
// =============================================================================

/**
 * Build a complete scorecard email for one provider
 */
export function buildScorecardEmail(
  scorecard: WeeklyScorecard,
  contact: ProviderContact,
  rankings?: CompetitiveRanking
): ScorecardEmail | null {
  if (!contact.primary_email) return null;
  
  const includeRankings = contact.include_rankings && !!rankings;
  
  const subject = `TagnetIQ Ground Truth Report — ${scorecard.provider_display_name} Week of ${scorecard.week_start}`;
  
  const html = buildEmailHTML(scorecard, contact, includeRankings ? rankings : undefined);
  
  return {
    to: contact.primary_email,
    subject,
    html,
    scorecard,
    includes_rankings: includeRankings,
    provider_id: scorecard.provider_id,
    week_start: scorecard.week_start,
  };
}

// =============================================================================
// HTML TEMPLATE
// =============================================================================

function buildEmailHTML(
  sc: WeeklyScorecard,
  contact: ProviderContact,
  rankings?: CompetitiveRanking
): string {
  const gradeEmoji = sc.composite_score >= 80 ? '🏆' : sc.composite_score >= 60 ? '✅' : sc.composite_score >= 40 ? '⚠️' : '🔴';
  const accuracyBar = Math.min(100, Math.max(0, 100 - sc.mean_absolute_percent_error));
  
  // Category rows
  const categoryRows = Object.entries(sc.category_scores)
    .sort((a, b) => b[1].votes - a[1].votes)
    .map(([cat, data]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">
          ${data.best_category ? '🏆 ' : data.worst_category ? '⚠️ ' : ''}${cat}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${data.votes}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;color:${data.mape <= 15 ? '#16a34a' : data.mape <= 30 ? '#ca8a04' : '#dc2626'}">${data.mape.toFixed(1)}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${(data.accuracy_10 * 100).toFixed(0)}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:14px;">${data.avg_response_ms}ms</td>
      </tr>
    `).join('');
  
  // Rankings section (paid tier only)
  const rankingsSection = rankings ? buildRankingsSection(sc, rankings) : `
    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-top:24px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#6b7280;">
        <strong>Competitive Rankings Available</strong><br/>
        See how ${sc.provider_display_name} ranks against ${rankings ? '' : '7 other'} AI providers across price accuracy, speed, and category expertise.<br/>
        <a href="mailto:partnerships@tagnetiq.com?subject=Competitive%20Rankings%20Access" style="color:#2563eb;">Contact us for access →</a>
      </p>
    </div>
  `;
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:32px 24px;color:white;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;opacity:0.7;margin-bottom:8px;">TagnetIQ HYDRA — Ground Truth Report</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;">${sc.provider_display_name} Performance</h1>
      <p style="margin:4px 0 0;opacity:0.8;font-size:14px;">Week of ${sc.week_start} → ${sc.week_end}</p>
    </div>
    
    <!-- Composite Score -->
    <div style="padding:24px;text-align:center;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:48px;font-weight:800;color:#1e1b4b;">${gradeEmoji} ${sc.composite_score.toFixed(0)}</div>
      <div style="font-size:14px;color:#6b7280;margin-top:4px;">Composite Score (0-100)</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Price Accuracy 40% · Decision 20% · Speed 20% · Coverage 20%</div>
    </div>
    
    <!-- Key Metrics Grid -->
    <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- Price Accuracy -->
      <div style="background:#f0fdf4;border-radius:8px;padding:16px;">
        <div style="font-size:12px;color:#16a34a;text-transform:uppercase;font-weight:600;">Price Accuracy</div>
        <div style="font-size:28px;font-weight:700;color:#15803d;margin-top:4px;">${accuracyBar.toFixed(0)}%</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">Avg error: ${sc.mean_absolute_percent_error.toFixed(1)}%</div>
        <div style="font-size:12px;color:#6b7280;">MAE: $${sc.mean_absolute_error.toFixed(2)}</div>
      </div>
      
      <!-- Decision Accuracy -->
      <div style="background:#eff6ff;border-radius:8px;padding:16px;">
        <div style="font-size:12px;color:#2563eb;text-transform:uppercase;font-weight:600;">Decision Accuracy</div>
        <div style="font-size:28px;font-weight:700;color:#1d4ed8;margin-top:4px;">${(sc.decision_accuracy * 100).toFixed(0)}%</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${sc.correct_decisions}/${sc.successful_votes} correct</div>
      </div>
      
      <!-- Speed -->
      <div style="background:#fefce8;border-radius:8px;padding:16px;">
        <div style="font-size:12px;color:#ca8a04;text-transform:uppercase;font-weight:600;">Response Speed</div>
        <div style="font-size:28px;font-weight:700;color:#a16207;margin-top:4px;">${(sc.avg_response_ms / 1000).toFixed(1)}s</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">p50: ${(sc.p50_response_ms / 1000).toFixed(1)}s · p95: ${(sc.p95_response_ms / 1000).toFixed(1)}s</div>
      </div>
      
      <!-- Volume -->
      <div style="background:#faf5ff;border-radius:8px;padding:16px;">
        <div style="font-size:12px;color:#7c3aed;text-transform:uppercase;font-weight:600;">Analyses</div>
        <div style="font-size:28px;font-weight:700;color:#6d28d9;margin-top:4px;">${sc.total_votes}</div>
        <div style="font-size:12px;color:#6b7280;margin-top:2px;">${sc.successful_votes} with ground truth</div>
      </div>
    </div>
    
    <!-- Accuracy Breakdown -->
    <div style="padding:0 24px 24px;">
      <h3 style="font-size:16px;font-weight:600;margin:0 0 12px;">Prediction Direction</h3>
      <div style="display:flex;gap:8px;">
        <div style="flex:1;text-align:center;background:#f0fdf4;border-radius:6px;padding:12px;">
          <div style="font-size:20px;font-weight:700;color:#16a34a;">✅ ${sc.accurate_predictions}</div>
          <div style="font-size:11px;color:#6b7280;">Within 10%</div>
        </div>
        <div style="flex:1;text-align:center;background:#fef2f2;border-radius:6px;padding:12px;">
          <div style="font-size:20px;font-weight:700;color:#dc2626;">📈 ${sc.over_predictions}</div>
          <div style="font-size:11px;color:#6b7280;">Over-priced</div>
        </div>
        <div style="flex:1;text-align:center;background:#eff6ff;border-radius:6px;padding:12px;">
          <div style="font-size:20px;font-weight:700;color:#2563eb;">📉 ${sc.under_predictions}</div>
          <div style="font-size:11px;color:#6b7280;">Under-priced</div>
        </div>
      </div>
    </div>
    
    <!-- Category Performance -->
    <div style="padding:0 24px 24px;">
      <h3 style="font-size:16px;font-weight:600;margin:0 0 12px;">Category Performance</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;">Category</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Votes</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">MAPE</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">±10%</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase;">Speed</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows || '<tr><td colspan="5" style="padding:12px;text-align:center;color:#9ca3af;">No category data this week</td></tr>'}
        </tbody>
      </table>
    </div>
    
    ${rankingsSection}
    
    <!-- Footer -->
    <div style="padding:24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
        This report is generated from <strong>real-world resale valuations</strong> verified against 11+ authority APIs (eBay, Numista, Brickset, Pokemon TCG, Discogs, PSA, and more).<br/><br/>
        Ground truth = weighted blend of live market prices, authority catalog data, and eBay sold listings.<br/><br/>
        <strong>TagnetIQ HYDRA</strong> — AI-Powered Resale Intelligence · tagnetiq.com<br/>
        <a href="mailto:partnerships@tagnetiq.com" style="color:#2563eb;">partnerships@tagnetiq.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// =============================================================================
// RANKINGS SECTION (PAID TIER)
// =============================================================================

function buildRankingsSection(sc: WeeklyScorecard, rankings: CompetitiveRanking): string {
  const overallEntry = rankings.overall.find(r => r.provider_id === sc.provider_id);
  const priceEntry = rankings.price_accuracy.find(r => r.provider_id === sc.provider_id);
  const speedEntry = rankings.speed.find(r => r.provider_id === sc.provider_id);
  
  const deltaIcon = (delta: number | null) => {
    if (delta === null) return '';
    if (delta > 0) return `<span style="color:#16a34a;">↑${delta}</span>`;
    if (delta < 0) return `<span style="color:#dc2626;">↓${Math.abs(delta)}</span>`;
    return '<span style="color:#6b7280;">—</span>';
  };
  
  return `
    <div style="padding:0 24px 24px;">
      <h3 style="font-size:16px;font-weight:600;margin:0 0 12px;">🏆 Competitive Rankings</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div style="text-align:center;background:#fefce8;border-radius:8px;padding:16px;">
          <div style="font-size:12px;color:#a16207;text-transform:uppercase;font-weight:600;">Overall</div>
          <div style="font-size:32px;font-weight:800;color:#854d0e;">#${overallEntry?.rank || '?'}</div>
          <div style="font-size:12px;color:#6b7280;">of ${rankings.overall.length} ${deltaIcon(overallEntry?.delta_from_last_week ?? null)}</div>
        </div>
        <div style="text-align:center;background:#f0fdf4;border-radius:8px;padding:16px;">
          <div style="font-size:12px;color:#16a34a;text-transform:uppercase;font-weight:600;">Price Accuracy</div>
          <div style="font-size:32px;font-weight:800;color:#15803d;">#${priceEntry?.rank || '?'}</div>
          <div style="font-size:12px;color:#6b7280;">of ${rankings.price_accuracy.length} ${deltaIcon(priceEntry?.delta_from_last_week ?? null)}</div>
        </div>
        <div style="text-align:center;background:#eff6ff;border-radius:8px;padding:16px;">
          <div style="font-size:12px;color:#2563eb;text-transform:uppercase;font-weight:600;">Speed</div>
          <div style="font-size:32px;font-weight:800;color:#1d4ed8;">#${speedEntry?.rank || '?'}</div>
          <div style="font-size:12px;color:#6b7280;">of ${rankings.speed.length} ${deltaIcon(speedEntry?.delta_from_last_week ?? null)}</div>
        </div>
      </div>
    </div>
  `;
}