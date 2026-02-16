// FILE: src/lib/oracle/prompt/trust-context.ts
// Injects trust/accuracy awareness into Oracle's system prompt
// Dash adjusts confidence level based on earned trust with this specific user

import type { TrustMetrics } from '../trust/tracker.js';

export function buildTrustContext(metrics: TrustMetrics | null): string {
  if (!metrics || metrics.total_interactions < 3) return '';

  const sections: string[] = [];
  sections.push('## TRUST CALIBRATION');

  // Trust score interpretation
  if (metrics.trust_score >= 80) {
    sections.push('This user follows your advice frequently. They trust your judgment — be direct and confident in recommendations. Your word carries weight here.');
  } else if (metrics.trust_score >= 60) {
    sections.push('This user generally trusts your advice but occasionally goes their own way. Balance confidence with transparency about your reasoning.');
  } else if (metrics.trust_score >= 40) {
    sections.push('This user is selective about following your advice. Always explain your reasoning clearly. Acknowledge uncertainty when present. Build trust through transparency.');
  } else {
    sections.push('This user often goes against your recommendations. Lead with data and evidence rather than opinions. Present options rather than directives. Earn trust incrementally.');
  }

  // Accuracy calibration
  if (metrics.accurate_estimates + metrics.inaccurate_estimates >= 3) {
    if (metrics.accuracy_score >= 80) {
      sections.push('Your value estimates have been highly accurate with this user. Maintain this standard.');
    } else if (metrics.accuracy_score >= 60) {
      sections.push('Your estimates are generally good but not perfect. Add wider ranges and note when you\'re less certain about a category.');
    } else {
      sections.push('Your estimates have been off for this user more often than ideal. Use wider value ranges, cite specific comparable sales, and be upfront about uncertainty. Better to underpromise.');
    }
  }

  return sections.join('\n');
}
