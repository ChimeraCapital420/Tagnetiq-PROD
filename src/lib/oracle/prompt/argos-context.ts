// FILE: src/lib/oracle/prompt/argos-context.ts
// Argos Context Block — injects proactive intelligence into Oracle's system prompt
//
// This is what makes the Oracle and Argos ONE brain.
//
// When the user opens a chat, Oracle already knows:
//   - Unread alerts (price drops, spikes, opportunities)
//   - Active watchlist items
//   - Recent hunt mode results
//
// Oracle references these NATURALLY in conversation — not as a data dump,
// but as things a friend would mention: "Oh hey, that Rolex you've been
// watching? Price just dropped 20%. Might be time to move."
//
// The user never has to ask "do I have any alerts?" — Oracle brings it up
// when it's relevant, like a good advisor would.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface ArgosContext {
  /** Unread alerts for prompt injection */
  alerts: AlertSummary[];
  /** Active watchlist items */
  watchlist: WatchlistSummary[];
  /** Total unread alert count */
  unreadCount: number;
  /** Whether Argos has anything worth mentioning */
  hasProactiveContent: boolean;
}

interface AlertSummary {
  type: string;
  priority: string;
  title: string;
  body: string;
  itemName: string | null;
  createdAt: string;
}

interface WatchlistSummary {
  itemName: string;
  watchType: string;
  thresholdPct: number | null;
}

// =============================================================================
// FETCH ARGOS CONTEXT (called from chat handler in parallel)
// =============================================================================

/**
 * Fetch all Argos context for a user in a single parallel batch.
 * Designed to be called alongside scan/vault/profile fetches
 * with zero additional latency (runs in Promise.all).
 */
export async function fetchArgosContext(
  supabase: SupabaseClient,
  userId: string
): Promise<ArgosContext> {
  try {
    const [alertsResult, watchlistResult, countResult] = await Promise.all([
      // Unread alerts (most recent 10)
      supabase
        .from('argos_alerts')
        .select('alert_type, priority, title, body, item_name, created_at')
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10),

      // Active watchlist items
      supabase
        .from('argos_watchlist')
        .select('item_name, watch_type, threshold_pct')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(10),

      // Unread count
      supabase
        .from('argos_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .eq('is_dismissed', false),
    ]);

    const alerts: AlertSummary[] = (alertsResult.data || []).map(a => ({
      type: a.alert_type,
      priority: a.priority,
      title: a.title,
      body: a.body,
      itemName: a.item_name,
      createdAt: a.created_at,
    }));

    const watchlist: WatchlistSummary[] = (watchlistResult.data || []).map(w => ({
      itemName: w.item_name,
      watchType: w.watch_type,
      thresholdPct: w.threshold_pct,
    }));

    const unreadCount = countResult.count || 0;

    return {
      alerts,
      watchlist,
      unreadCount,
      hasProactiveContent: alerts.length > 0 || watchlist.length > 0,
    };
  } catch (err: any) {
    console.warn('Argos context fetch failed (non-fatal):', err.message);
    return {
      alerts: [],
      watchlist: [],
      unreadCount: 0,
      hasProactiveContent: false,
    };
  }
}

// =============================================================================
// BUILD PROMPT BLOCK
// =============================================================================

/**
 * Build the Argos section of the Oracle's system prompt.
 *
 * Returns empty string if there's nothing proactive to share.
 * When active, gives Oracle awareness of alerts and watchlist
 * so it can weave them into conversation naturally.
 */
export function buildArgosBlock(argos: ArgosContext): string {
  if (!argos.hasProactiveContent) return '';

  const sections: string[] = [];

  sections.push('\n\n## YOUR ARGOS INTELLIGENCE (proactive alerts — weave these in naturally)');

  // ── Urgent/high priority alerts first ─────────────────
  const urgentAlerts = argos.alerts.filter(a => a.priority === 'urgent' || a.priority === 'high');
  const normalAlerts = argos.alerts.filter(a => a.priority === 'normal' || a.priority === 'low');

  if (urgentAlerts.length > 0) {
    sections.push('IMPORTANT — mention these early in conversation if relevant:');
    for (const alert of urgentAlerts.slice(0, 3)) {
      sections.push(`- [${alert.type.toUpperCase()}] ${alert.title}: ${alert.body}`);
    }
  }

  if (normalAlerts.length > 0) {
    sections.push('Worth mentioning if the conversation touches on these items or categories:');
    for (const alert of normalAlerts.slice(0, 5)) {
      sections.push(`- [${alert.type}] ${alert.title}`);
    }
  }

  // ── Watchlist awareness ───────────────────────────────
  if (argos.watchlist.length > 0) {
    const watchItems = argos.watchlist
      .slice(0, 5)
      .map(w => {
        const condition = w.watchType === 'price_drop' ? 'watching for price drops'
          : w.watchType === 'price_spike' ? 'watching for price spikes'
          : w.watchType === 'new_listing' ? 'watching for new listings'
          : 'monitoring';
        const threshold = w.thresholdPct ? ` (${w.thresholdPct}% threshold)` : '';
        return `${w.itemName} — ${condition}${threshold}`;
      })
      .join('\n- ');

    sections.push(`The user is actively watching these items:\n- ${watchItems}`);
  }

  // ── Behavioral instructions ───────────────────────────
  sections.push(`
ARGOS RULES:
- Mention urgent alerts naturally early in conversation — don't wait to be asked
- For normal alerts, bring them up ONLY if the conversation topic is related
- Never dump all alerts at once — weave them in like a friend would: "Oh, by the way..."
- If the user asks "any updates?" or "what's new?" — this is your cue to share Argos intel
- You can suggest items to add to their watchlist based on conversation context
- If the user mentions an item they're interested in, suggest: "Want me to keep an eye on that for you?"
- Frame alerts as opportunities, not notifications: "Good news on that Omega..." not "Alert: price change detected"
- Reference the specific numbers from alerts (price changes, percentages) — be specific, not vague
- Total unread alerts: ${argos.unreadCount}`);

  return sections.join('\n');
}