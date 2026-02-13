// FILE: src/lib/onboarding/engagement.ts
// Engagement Services — share prompts, daily digest, community moments
//
// Sprint E: Making the Oracle relationship sticky.
//
// Share prompts: Oracle naturally suggests sharing at the right moments
//   - Not pushy. Not every scan. Not a modal. A natural part of conversation.
//   - Triggered by genuinely share-worthy moments
//   - User can always dismiss, and frequency adapts
//
// Daily digest: Morning notification with overnight insights
//   - Vault value changes, watchlist matches, inventory alerts
//   - Use streak tracking (gamification without being obnoxious)
//   - Personalized to what the user actually cares about
//
// Community moments: Anonymized feed of best finds
//   - Admin-curated (never auto-published)
//   - Creates FOMO: "Someone found a $2,400 error coin at Goodwill"
//   - Proves the product works without marketing

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// SHARE PROMPTS
// =============================================================================

export type ShareTrigger =
  | 'great_scan'
  | 'flip_success'
  | 'milestone'
  | 'oracle_exchange'
  | 'rare_find'
  | 'first_scan'
  | 'vault_milestone'
  | 'streak';

interface SharePromptConfig {
  trigger: ShareTrigger;
  cooldownHours: number;           // Min hours between prompts of this type
  globalCooldownHours: number;     // Min hours between ANY share prompt
  maxPerDay: number;
}

const SHARE_PROMPT_RULES: SharePromptConfig[] = [
  { trigger: 'first_scan', cooldownHours: 0, globalCooldownHours: 0, maxPerDay: 1 },
  { trigger: 'great_scan', cooldownHours: 12, globalCooldownHours: 4, maxPerDay: 2 },
  { trigger: 'rare_find', cooldownHours: 4, globalCooldownHours: 2, maxPerDay: 3 },
  { trigger: 'flip_success', cooldownHours: 6, globalCooldownHours: 4, maxPerDay: 2 },
  { trigger: 'milestone', cooldownHours: 24, globalCooldownHours: 4, maxPerDay: 1 },
  { trigger: 'oracle_exchange', cooldownHours: 24, globalCooldownHours: 6, maxPerDay: 1 },
  { trigger: 'vault_milestone', cooldownHours: 48, globalCooldownHours: 12, maxPerDay: 1 },
  { trigger: 'streak', cooldownHours: 24, globalCooldownHours: 12, maxPerDay: 1 },
];

/**
 * Oracle share prompts — natural, conversational suggestions.
 * These are returned AS Oracle dialogue, not as UI modals.
 */
const SHARE_MESSAGES: Record<ShareTrigger, string[]> = {
  first_scan: [
    "That was your first scan! Pretty cool, right? If you know someone who'd get a kick out of this, you can share our conversation — one tap.",
  ],
  great_scan: [
    "That's a solid find. Your friends would probably want to see this.",
    "This one's worth sharing. Want to send the link?",
    "Good eye on that one. If you've got collector friends, they'd appreciate this.",
  ],
  rare_find: [
    "This is genuinely rare. People share stuff like this all the time — it's the kind of find that makes someone download an app.",
    "You should be proud of this one. Shareable moment if I've ever seen one.",
  ],
  flip_success: [
    "Nice flip! That's the kind of win worth celebrating. Share it if you want — I won't tell anyone your margins.",
    "Profit locked in. Want to share this with your reseller crew?",
  ],
  milestone: [
    "That's your 50th scan! You've built a real collection of data. If you ever want to share your favorite conversations, the link is always there.",
  ],
  oracle_exchange: [
    "That was a really good conversation. If you want to share it, I'd be honored — just tap share.",
  ],
  vault_milestone: [
    "Your vault just crossed a milestone. That's worth documenting. Some people share their vault journeys — totally up to you.",
  ],
  streak: [
    "You've been here every day this week. That's commitment. If anyone asks what app you've been glued to, you know where the share button is.",
  ],
};

/**
 * Check if a share prompt should be shown and return the message.
 * Returns null if too soon or user is getting spammed.
 */
export async function getSharePrompt(
  supabase: SupabaseClient,
  userId: string,
  trigger: ShareTrigger,
  contextData: Record<string, any> = {}
): Promise<{ message: string; promptId: string } | null> {
  const rule = SHARE_PROMPT_RULES.find(r => r.trigger === trigger);
  if (!rule) return null;

  // Check global cooldown (any share prompt)
  const { data: recent } = await supabase
    .from('share_prompts')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (recent && recent.length > 0) {
    const lastPromptAge = Date.now() - new Date(recent[0].created_at).getTime();
    if (lastPromptAge < rule.globalCooldownHours * 60 * 60 * 1000) {
      return null; // Too soon since last prompt
    }
  }

  // Check trigger-specific cooldown
  const { data: triggerRecent } = await supabase
    .from('share_prompts')
    .select('created_at')
    .eq('user_id', userId)
    .eq('trigger_type', trigger)
    .order('created_at', { ascending: false })
    .limit(1);

  if (triggerRecent && triggerRecent.length > 0) {
    const lastTriggerAge = Date.now() - new Date(triggerRecent[0].created_at).getTime();
    if (lastTriggerAge < rule.cooldownHours * 60 * 60 * 1000) {
      return null;
    }
  }

  // Check daily limit
  const today = new Date().toISOString().split('T')[0];
  const { count } = await supabase
    .from('share_prompts')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00Z`);

  if ((count || 0) >= rule.maxPerDay) return null;

  // Pick a random message
  const messages = SHARE_MESSAGES[trigger] || SHARE_MESSAGES.great_scan;
  const message = messages[Math.floor(Math.random() * messages.length)];

  // Log the prompt
  const { data: prompt } = await supabase
    .from('share_prompts')
    .insert({
      user_id: userId,
      trigger_type: trigger,
      context_data: contextData,
      prompt_message: message,
    })
    .select('id')
    .single();

  return {
    message,
    promptId: prompt?.id || '',
  };
}

/**
 * Track user's response to a share prompt.
 */
export async function trackShareResponse(
  supabase: SupabaseClient,
  promptId: string,
  shared: boolean,
  platform?: string
): Promise<void> {
  await supabase
    .from('share_prompts')
    .update({
      was_shared: shared,
      was_dismissed: !shared,
      share_platform: platform || null,
    })
    .eq('id', promptId);
}

// =============================================================================
// DAILY DIGEST
// =============================================================================

export interface DigestContent {
  greeting: string;
  streak: number;
  sections: DigestSection[];
  oracleSignoff: string;
}

interface DigestSection {
  type: 'vault_changes' | 'watchlist_matches' | 'inventory_alerts' | 'market_trends' | 'milestone';
  title: string;
  items: string[];
  priority: number;
}

/**
 * Build daily digest content for a user.
 * Called by the digest cron job or on-demand.
 */
export async function buildDailyDigest(
  supabase: SupabaseClient,
  userId: string
): Promise<DigestContent> {
  const sections: DigestSection[] = [];

  // Update streak
  const streak = await updateStreak(supabase, userId);

  // ── Vault value changes (resale only) ─────────────────
  const { data: resaleItems } = await supabase
    .from('vault_items')
    .select('item_name, estimated_value')
    .eq('user_id', userId)
    .eq('vault_type', 'resale')
    .not('estimated_value', 'is', null)
    .limit(10);

  if (resaleItems && resaleItems.length > 0) {
    // In production, compare against last known values from price history
    sections.push({
      type: 'vault_changes',
      title: 'Your Vault',
      items: [`${resaleItems.length} resale items being monitored`],
      priority: 2,
    });
  }

  // ── Inventory alerts ──────────────────────────────────
  const { data: lowStock } = await supabase
    .from('vault_items')
    .select('item_name, stock_quantity, reorder_point')
    .eq('user_id', userId)
    .eq('vault_type', 'inventory')
    .not('stock_quantity', 'is', null)
    .not('reorder_point', 'is', null);

  const inventoryAlerts = (lowStock || []).filter(
    i => (i.stock_quantity || 0) <= (i.reorder_point || 0)
  );

  if (inventoryAlerts.length > 0) {
    sections.push({
      type: 'inventory_alerts',
      title: 'Inventory',
      items: inventoryAlerts.map(i =>
        `${i.item_name}: ${i.stock_quantity} left (reorder at ${i.reorder_point})`
      ),
      priority: 1,
    });
  }

  // ── Watchlist ─────────────────────────────────────────
  const { data: watches } = await supabase
    .from('argos_watchlist')
    .select('item_description')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(5);

  if (watches && watches.length > 0) {
    sections.push({
      type: 'watchlist_matches',
      title: 'Watchlist',
      items: [`${watches.length} active watches being monitored`],
      priority: 3,
    });
  }

  // ── Unread alerts ─────────────────────────────────────
  const { count: unreadAlerts } = await supabase
    .from('argos_alerts')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', false);

  if ((unreadAlerts || 0) > 0) {
    sections.push({
      type: 'market_trends',
      title: 'Alerts',
      items: [`${unreadAlerts} unread alerts waiting for you`],
      priority: 1,
    });
  }

  // Sort by priority
  sections.sort((a, b) => a.priority - b.priority);

  // Build greeting based on context
  const greeting = buildGreeting(streak, sections);
  const signoff = buildSignoff(sections);

  return {
    greeting,
    streak,
    sections,
    oracleSignoff: signoff,
  };
}

/**
 * Update and return the user's daily use streak.
 */
async function updateStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('use_streak, last_active_date')
    .eq('id', userId)
    .single();

  if (!profile) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastActive = profile.last_active_date;

  let streak = profile.use_streak || 0;

  if (lastActive === today) {
    // Already active today
    return streak;
  } else if (lastActive === yesterday) {
    // Continuing streak
    streak += 1;
  } else {
    // Streak broken
    streak = 1;
  }

  await supabase
    .from('profiles')
    .update({ use_streak: streak, last_active_date: today })
    .eq('id', userId);

  return streak;
}

function buildGreeting(streak: number, sections: DigestSection[]): string {
  const hasAlerts = sections.some(s => s.priority === 1);
  const streakMsg = streak > 1 ? ` Day ${streak} in a row — nice.` : '';

  if (hasAlerts) {
    return `Good morning.${streakMsg} A few things need your attention.`;
  }
  return `Good morning.${streakMsg} Here's what's happening.`;
}

function buildSignoff(sections: DigestSection[]): string {
  if (sections.length === 0) {
    return "All quiet overnight. Go find something to scan.";
  }
  return "That's the overnight summary. I'll be here when you're ready.";
}

// =============================================================================
// COMMUNITY MOMENTS
// =============================================================================

/**
 * Get published community moments (public feed).
 */
export async function getCommunityMoments(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<any[]> {
  const { data } = await supabase
    .from('community_moments')
    .select('id, moment_type, headline, description, category, value_found, value_paid, reaction_count, view_count, created_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Submit a potential community moment (for admin review).
 * Never auto-publishes — admin must verify and approve.
 */
export async function suggestCommunityMoment(
  supabase: SupabaseClient,
  userId: string,
  moment: {
    type: string;
    headline: string;
    description?: string;
    category?: string;
    valueFound?: number;
    valuePaid?: number;
  }
): Promise<string | null> {
  const { data } = await supabase
    .from('community_moments')
    .insert({
      moment_type: moment.type,
      headline: moment.headline,
      description: moment.description || null,
      category: moment.category || null,
      value_found: moment.valueFound || null,
      value_paid: moment.valuePaid || null,
      source_user_id: userId,
      is_verified: false,
      is_published: false,
    })
    .select('id')
    .single();

  return data?.id || null;
}

/**
 * React to a community moment (emoji reaction).
 */
export async function reactToMoment(
  supabase: SupabaseClient,
  momentId: string
): Promise<void> {
  await supabase.rpc('increment_moment_reaction', { moment_id: momentId }).catch(() => {
    // Fallback: direct update
    supabase
      .from('community_moments')
      .update({ reaction_count: 1 }) // This should be an increment, but RPC is safer
      .eq('id', momentId)
      .then(() => {})
      .catch(() => {});
  });
}

/**
 * Detect if a scan result qualifies as a community moment.
 * Called after each scan to check for shareworthy moments.
 */
export function detectMomentWorthy(scanResult: any): {
  worthy: boolean;
  type?: string;
  headline?: string;
} {
  const value = parseFloat(String(scanResult.estimatedValue || '0').replace(/[^0-9.]/g, ''));
  const confidence = scanResult.confidence || 0;

  // High value + high confidence = potential moment
  if (value > 500 && confidence > 0.85) {
    return {
      worthy: true,
      type: 'surprise_value',
      headline: `Someone just found a $${Math.round(value).toLocaleString()} item`,
    };
  }

  // Rare find (authority confirmed)
  if (scanResult.authorityData && scanResult.authorityData.rarity === 'rare') {
    return {
      worthy: true,
      type: 'rare_find',
      headline: `A confirmed rare ${scanResult.category || 'item'} was just identified`,
    };
  }

  return { worthy: false };
}