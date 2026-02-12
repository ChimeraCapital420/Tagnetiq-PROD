// FILE: src/lib/oracle/prompt/scan-context.ts
// Builds the scan history + stats + behavioral patterns section of the system prompt.
// This gives the Oracle real data about the user's scanning behavior.

// =============================================================================
// SCAN HISTORY
// =============================================================================

export function buildScanContext(scanHistory: any[]): string {
  let context = '\n\n## USER SCAN HISTORY\n';

  if (scanHistory.length === 0) {
    context += 'No scans yet. The user is new — warm welcome. Let them know TagnetIQ covers the entire resale market. Suggest they scan their first item.';
    return context;
  }

  context += `${scanHistory.length} total scans. Most recent first:\n\n`;

  // ── Individual scans (most recent 25) ───────────────────
  for (const scan of scanHistory.slice(0, 25)) {
    const result = scan.analysis_result || {};

    context += `---\n`;
    context += `ITEM: ${scan.item_name || result.itemName || 'Unknown'}\n`;
    context += `SCANNED: ${new Date(scan.created_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })}\n`;
    context += `VALUE: ${result.estimatedValue || scan.estimated_value || 'Unknown'}\n`;
    context += `DECISION: ${result.decision || scan.decision || 'N/A'}\n`;
    context += `CONFIDENCE: ${result.confidence || scan.confidence || 'N/A'}\n`;
    context += `CATEGORY: ${result.category || scan.category || 'general'}\n`;

    if (result.summary_reasoning) {
      context += `SUMMARY: ${result.summary_reasoning.substring(0, 250)}\n`;
    }

    if (result.valuation_factors && result.valuation_factors.length > 0) {
      context += `FACTORS: ${result.valuation_factors.slice(0, 4).join('; ')}\n`;
    }

    if (result.consensusRatio) {
      context += `AI CONSENSUS: ${result.consensusRatio}\n`;
    }

    context += '\n';
  }

  if (scanHistory.length > 25) {
    context += `... and ${scanHistory.length - 25} older scans not shown.\n`;
  }

  // ── Aggregate stats ─────────────────────────────────────
  context += buildScanStats(scanHistory);

  // ── Behavioral patterns ─────────────────────────────────
  if (scanHistory.length >= 5) {
    context += buildScanPatterns(scanHistory);
  }

  return context;
}

// =============================================================================
// STATS
// =============================================================================

function buildScanStats(scanHistory: any[]): string {
  const categories = [...new Set(
    scanHistory.map((s: any) => s.category || s.analysis_result?.category || 'general')
  )];

  const buyCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'BUY'
  ).length;

  const passCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'PASS'
  ).length;

  let totalValue = 0;
  for (const scan of scanHistory) {
    const val = scan.estimated_value
      || parseFloat(String(scan.analysis_result?.estimatedValue || '0').replace(/[^0-9.]/g, ''));
    if (!isNaN(val)) totalValue += val;
  }

  let stats = `\n## SCAN STATS\n`;
  stats += `Total scans: ${scanHistory.length}\n`;
  stats += `BUY recommendations: ${buyCount}\n`;
  stats += `PASS recommendations: ${passCount}\n`;
  stats += `Categories explored: ${categories.join(', ')}\n`;
  stats += `Total estimated value scanned: $${totalValue.toLocaleString()}\n`;

  return stats;
}

// =============================================================================
// PATTERNS (reference naturally, don't list robotically)
// =============================================================================

function buildScanPatterns(scanHistory: any[]): string {
  let patterns = '\n## PATTERNS (reference naturally, don\'t list robotically)\n';

  const categories = [...new Set(
    scanHistory.map((s: any) => s.category || s.analysis_result?.category || 'general')
  )];

  const buyCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'BUY'
  ).length;

  const passCount = scanHistory.filter(
    (s: any) => (s.decision || s.analysis_result?.decision) === 'PASS'
  ).length;

  // Category focus
  if (categories.length === 1) {
    patterns += `User is focused on ${categories[0]} — they clearly have a passion here. Acknowledge it.\n`;
  } else if (categories.length >= 4) {
    patterns += `User explores many categories — they're curious and versatile.\n`;
  }

  // Win/loss ratio
  if (buyCount > passCount * 2) {
    patterns += `User scans a lot of winners — they have a good eye. Let them know.\n`;
  } else if (passCount > buyCount * 2) {
    patterns += `User gets a lot of PASS results — they might be learning. Be encouraging.\n`;
  }

  // Activity recency
  const lastScanDate = new Date(scanHistory[0].created_at);
  const daysSinceLastScan = Math.floor(
    (Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastScan === 0) {
    patterns += `User scanned today — they're active right now.\n`;
  } else if (daysSinceLastScan >= 7) {
    patterns += `It's been ${daysSinceLastScan} days since their last scan. Warm "good to see you" vibe if natural.\n`;
  }

  return patterns;
}