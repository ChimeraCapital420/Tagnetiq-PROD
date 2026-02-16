// FILE: src/lib/oracle/trust/tracker.ts
// Trust Score / Follow-Through Tracking
// Tracks when Dash's advice is followed vs. ignored
// Self-calibrating: Dash adjusts confidence based on earned trust
//
// Signals:
// - Dash says BUY → user buys → trust confirmed
// - Dash says SKIP → user scans anyway → trust gap
// - Dash estimates $X → user sells near $X → accuracy confirmed
// - User follows recommendation → recommendation weight increases

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// TYPES
// =============================================================================

export interface TrustMetrics {
  advice_followed: number;
  advice_ignored: number;
  accurate_estimates: number;
  inaccurate_estimates: number;
  total_interactions: number;
  trust_score: number;        // 0-100
  accuracy_score: number;     // 0-100
  last_updated: string;
}

interface TrustEvent {
  type: 'advice_followed' | 'advice_ignored' | 'estimate_accurate' | 'estimate_inaccurate';
  context: string;
  metadata?: Record<string, any>;
}

// =============================================================================
// RECORD TRUST EVENT
// =============================================================================

/**
 * Record a trust signal when user's behavior confirms or contradicts Oracle's advice.
 * Called from:
 * - hunt.ts when user scans item after receiving BUY/SKIP verdict
 * - log-sale.ts when sale price is close to Oracle's estimate
 * - chat.ts when user references following/ignoring advice
 */
export async function recordTrustEvent(
  userId: string,
  event: TrustEvent,
): Promise<void> {
  try {
    // Get current metrics
    const current = await getTrustMetrics(userId);

    // Update counters
    const updated = { ...current };
    switch (event.type) {
      case 'advice_followed':
        updated.advice_followed++;
        break;
      case 'advice_ignored':
        updated.advice_ignored++;
        break;
      case 'estimate_accurate':
        updated.accurate_estimates++;
        break;
      case 'estimate_inaccurate':
        updated.inaccurate_estimates++;
        break;
    }
    updated.total_interactions++;
    updated.last_updated = new Date().toISOString();

    // Recalculate scores
    const totalAdvice = updated.advice_followed + updated.advice_ignored;
    updated.trust_score = totalAdvice > 0
      ? Math.round((updated.advice_followed / totalAdvice) * 100)
      : 50; // default neutral trust

    const totalEstimates = updated.accurate_estimates + updated.inaccurate_estimates;
    updated.accuracy_score = totalEstimates > 0
      ? Math.round((updated.accurate_estimates / totalEstimates) * 100)
      : 50; // default neutral accuracy

    // Store in oracle_identity (extend existing table)
    await supabaseAdmin
      .from('oracle_identity')
      .upsert({
        user_id: userId,
        trust_metrics: updated,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

  } catch (err) {
    console.error('[Trust] Failed to record event:', err);
  }
}

// =============================================================================
// GET TRUST METRICS
// =============================================================================

export async function getTrustMetrics(userId: string): Promise<TrustMetrics> {
  const { data, error } = await supabaseAdmin
    .from('oracle_identity')
    .select('trust_metrics')
    .eq('user_id', userId)
    .single();

  if (error || !data?.trust_metrics) {
    return defaultMetrics();
  }

  return data.trust_metrics as TrustMetrics;
}

// =============================================================================
// DETECT TRUST SIGNALS FROM CONVERSATION
// =============================================================================

/**
 * Analyze user message for implicit trust signals.
 * Called during chat to passively detect follow-through.
 *
 * Examples:
 * - "I bought that thing you recommended" → advice_followed
 * - "I ignored your advice and bought it anyway" → advice_ignored
 * - "You were right about that price" → estimate_accurate
 * - "Your estimate was way off" → estimate_inaccurate
 */
export function detectTrustSignals(message: string): TrustEvent | null {
  const lower = message.toLowerCase();

  // Followed advice signals
  const followedPatterns = [
    /\b(bought|picked up|grabbed|got|snagged|purchased)\b.*(you|oracle|dash).*(said|recommended|suggested|told)/,
    /\b(you were right|good call|great advice|glad i listened|followed your|took your advice)/,
    /\b(thanks|thank you).*(advice|recommendation|tip|suggestion)/,
    /\b(did what you said|listened to you|went with your)/,
  ];

  for (const pattern of followedPatterns) {
    if (pattern.test(lower)) {
      return { type: 'advice_followed', context: message.substring(0, 200) };
    }
  }

  // Ignored advice signals
  const ignoredPatterns = [
    /\b(bought|got|picked up)\b.*(anyway|despite|even though).*(you said|recommended|told)/,
    /\b(didn't listen|ignored your|went against your|should have listened)/,
    /\b(you said skip|you said pass|you said no)\b.*(but i|and i)/,
  ];

  for (const pattern of ignoredPatterns) {
    if (pattern.test(lower)) {
      return { type: 'advice_ignored', context: message.substring(0, 200) };
    }
  }

  // Accurate estimate signals
  const accuratePatterns = [
    /\b(sold|it sold|got).*(for|at)\b.*\b(close|near|around|about|exactly)\b.*(what you|your estimate|you said)/,
    /\b(you were right|spot on|nailed|accurate|good estimate)\b.*(price|value|worth)/,
    /\b(right on the money|close to what you said)/,
  ];

  for (const pattern of accuratePatterns) {
    if (pattern.test(lower)) {
      return { type: 'estimate_accurate', context: message.substring(0, 200) };
    }
  }

  // Inaccurate estimate signals
  const inaccuratePatterns = [
    /\b(way off|far off|wrong|inaccurate|too high|too low)\b.*(estimate|price|value|worth)/,
    /\b(sold for way|only got|much less|much more)\b.*(than you|than your|expected)/,
    /\b(overestimated|underestimated|missed on|off on the price)/,
  ];

  for (const pattern of inaccuratePatterns) {
    if (pattern.test(lower)) {
      return { type: 'estimate_inaccurate', context: message.substring(0, 200) };
    }
  }

  return null; // No trust signal detected
}

// =============================================================================
// HELPERS
// =============================================================================

function defaultMetrics(): TrustMetrics {
  return {
    advice_followed: 0,
    advice_ignored: 0,
    accurate_estimates: 0,
    inaccurate_estimates: 0,
    total_interactions: 0,
    trust_score: 50,
    accuracy_score: 50,
    last_updated: new Date().toISOString(),
  };
}
