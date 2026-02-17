// FILE: src/lib/oracle/tier.ts
// Oracle Tier Gating — server-side tier checks + daily message counting
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 1 — THE ORACLE IS NEVER PAYWALLED
// ═══════════════════════════════════════════════════════════════════════
//
// The Oracle's SOUL is the same at every tier:
//   - Same AI model (gpt-4o / claude-sonnet / gemini-pro)
//   - Same personality, memory, concierge, identity
//   - Same voice options (all 6 OpenAI voices)
//   - Same response depth
//
// What changes across tiers is CAPABILITY and VOLUME:
//   Free:  15 messages/day, basic features, daily digest
//   Pro:   Unlimited, live market, proactive alerts, content creation
//   Elite: Everything + multi-model synthesis, hunt mode, autonomy
//
// A user who downgrades from Pro to Free doesn't lose their Oracle.
// They lose capabilities. The Oracle knows this and adapts naturally.
// ═══════════════════════════════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────────────┐
// │ BETA MODE: Set BETA_MODE = true to bypass ALL tier restrictions │
// │ Everyone gets unlimited access during beta testing.             │
// │ When ready to monetize, flip to false. One line. That's it.    │
// └─────────────────────────────────────────────────────────────────┘
//
// Mobile-first: All counting and gating happens server-side.
// The client receives a `tier` object in every response so it can
// render UI (message counter, upgrade prompts) without extra API calls.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// ★ BETA KILL SWITCH ★
// =============================================================================
// true  = Everyone gets unlimited access. No limits. No counting. No gates.
// false = Tier gating is active. Free users hit daily limits.
//
// When you're ready to launch paid tiers:
//   1. Set this to false
//   2. Deploy
//   3. That's it — everything else is already wired up
// =============================================================================

const BETA_MODE = true;

// =============================================================================
// TYPES
// =============================================================================

export type UserTier = 'free' | 'pro' | 'elite';

export interface TierConfig {
  /** Maximum Oracle messages per day (Infinity = unlimited) */
  dailyMessageLimit: number;
  /** Available base voice IDs for this tier (OpenAI TTS) */
  voices: string[];
  /** Feature flags unlocked at this tier */
  features: TierFeature[];
  /** Monthly price in USD (0 = free) */
  priceUsd: number;
  /** Display name */
  displayName: string;
}

export type TierFeature =
  // ── Available to ALL tiers (including free) ───────────
  | 'identity'             // Oracle names itself, personality, AI DNA
  | 'memory'               // Compressed conversation memory
  | 'concierge'            // Remembers birthdays, family, preferences
  | 'daily_digest'         // Daily summary email/push
  | 'basic_vision'         // Camera glances (capped for free)
  | 'basic_scans'          // HYDRA scans (capped for free)
  // ── Pro tier ──────────────────────────────────────────
  | 'unlimited_messages'   // No daily message cap
  | 'premium_voices'       // Curated ElevenLabs voices
  | 'priority_response'    // Faster queue priority
  | 'live_market'          // Mid-conversation market data fetches
  | 'proactive_alerts'     // Real-time push from Argos in Oracle's voice
  | 'emotional_memory'     // Remembers moments, not just facts
  | 'content_creation'     // Listings, video scripts, brag cards
  | 'unlimited_vision'     // Unlimited camera usage
  | 'unlimited_scans'      // Unlimited HYDRA scans
  // ── Elite tier ────────────────────────────────────────
  | 'conversational_hydra' // Multi-model synthesis on deep questions
  | 'hunt_mode'            // Real-time camera triage with personality
  | 'argos_engine'         // Full Argos watchlist + alert engine
  | 'community_matchmaking'// Oracle-powered buyer/seller matching
  | 'autonomy'             // Inventory management with guardrails
  | 'elevenlabs_full';     // Full ElevenLabs voice library

export interface TierInfo {
  /** Current active tier */
  current: UserTier;
  /** Is the tier currently active (not expired) */
  isActive: boolean;
  /** When the tier started */
  startedAt: string | null;
  /** When the tier expires (null = never) */
  expiresAt: string | null;
}

export interface UsageInfo {
  /** Messages sent today */
  messagesUsed: number;
  /** Daily limit for current tier */
  messagesLimit: number;
  /** Messages remaining today (-1 = unlimited) */
  messagesRemaining: number;
}

export interface AccessResult {
  /** Whether this message is allowed */
  allowed: boolean;
  /** Tier info for the response payload */
  tier: TierInfo;
  /** Usage info for the response payload */
  usage: UsageInfo;
  /** If blocked, the reason to show the user */
  blockedReason?: string;
  /** If blocked, the upgrade CTA */
  upgradeCta?: string;
}

// =============================================================================
// TIER CONFIGURATION
// =============================================================================

export const TIER_CONFIG: Record<UserTier, TierConfig> = {
  // ── FREE — The Apprentice Oracle ──────────────────────
  // Same brain. Same soul. Same voice quality. Limited volume + features.
  // 15 messages = enough for a real conversation where the bond forms.
  free: {
    dailyMessageLimit: 15,
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'],
    features: [
      'identity',
      'memory',
      'concierge',
      'daily_digest',
      'basic_vision',
      'basic_scans',
    ],
    priceUsd: 0,
    displayName: 'Free',
  },

  // ── PRO — The Full Oracle ─────────────────────────────
  // Unlimited conversations + live market + proactive alerts +
  // content creation. This is where Oracle becomes a business partner.
  pro: {
    dailyMessageLimit: Infinity,
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'],
    features: [
      'identity',
      'memory',
      'concierge',
      'daily_digest',
      'basic_vision',
      'basic_scans',
      'unlimited_messages',
      'premium_voices',
      'priority_response',
      'live_market',
      'proactive_alerts',
      'emotional_memory',
      'content_creation',
      'unlimited_vision',
      'unlimited_scans',
    ],
    priceUsd: 9.99,
    displayName: 'Pro',
  },

  // ── ELITE — The Oracle Unleashed ──────────────────────
  // Multi-model synthesis, hunt mode, full Argos, autonomy.
  // For serious resellers, dealers, and businesses.
  elite: {
    dailyMessageLimit: Infinity,
    voices: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer'],
    features: [
      'identity',
      'memory',
      'concierge',
      'daily_digest',
      'basic_vision',
      'basic_scans',
      'unlimited_messages',
      'premium_voices',
      'priority_response',
      'live_market',
      'proactive_alerts',
      'emotional_memory',
      'content_creation',
      'unlimited_vision',
      'unlimited_scans',
      'conversational_hydra',
      'hunt_mode',
      'argos_engine',
      'community_matchmaking',
      'autonomy',
      'elevenlabs_full',
    ],
    priceUsd: 19.99,
    displayName: 'Elite',
  },
};

// =============================================================================
// BETA MODE RESPONSE (used when BETA_MODE = true)
// =============================================================================

const BETA_ACCESS: AccessResult = {
  allowed: true,
  tier: {
    current: 'elite',          // Beta testers get elite-level access
    isActive: true,
    startedAt: null,
    expiresAt: null,
  },
  usage: {
    messagesUsed: 0,
    messagesLimit: -1,          // -1 = unlimited
    messagesRemaining: -1,
  },
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Full access check: gets tier, checks daily usage, increments counter.
 * Call this ONCE at the start of every Oracle message handler.
 *
 * In BETA_MODE: Always returns allowed=true with elite access. Zero DB calls.
 *
 * If `allowed` is false, return the `blockedReason` and `upgradeCta` to the client.
 * If `allowed` is true, proceed with the LLM call.
 */
export async function checkOracleAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<AccessResult> {
  // ── BETA BYPASS — no DB calls, no counting, everyone is elite ──
  if (BETA_MODE) {
    return { ...BETA_ACCESS };
  }

  // ── 1. Get user's tier ──────────────────────────────────
  const tierInfo = await getUserTier(supabase, userId);
  const config = TIER_CONFIG[tierInfo.current];

  // ── 2. Unlimited tier? Skip counting. ───────────────────
  if (config.dailyMessageLimit === Infinity) {
    return {
      allowed: true,
      tier: tierInfo,
      usage: {
        messagesUsed: 0,       // Not tracked for paid tiers (saves DB writes)
        messagesLimit: -1,     // -1 = unlimited
        messagesRemaining: -1,
      },
    };
  }

  // ── 3. Free tier: check + increment daily count ─────────
  const usage = await incrementDailyUsage(supabase, userId);

  if (usage.messagesUsed > config.dailyMessageLimit) {
    return {
      allowed: false,
      tier: tierInfo,
      usage: {
        messagesUsed: usage.messagesUsed - 1, // Undo the increment we just did
        messagesLimit: config.dailyMessageLimit,
        messagesRemaining: 0,
      },
      // Warm, Oracle-voiced — not corporate, not salesy
      blockedReason:
        `That's all ${config.dailyMessageLimit} messages for today. ` +
        `I'm still here — your limit resets at midnight and I'll remember ` +
        `everything we talked about. Pick it up with me tomorrow.`,
      upgradeCta:
        `Want unlimited conversations? Pro is $${config.priceUsd}/month — same me, ` +
        `no daily cap, plus I can pull live market data for you.`,
    };
  }

  return {
    allowed: true,
    tier: tierInfo,
    usage: {
      messagesUsed: usage.messagesUsed,
      messagesLimit: config.dailyMessageLimit,
      messagesRemaining: config.dailyMessageLimit - usage.messagesUsed,
    },
  };
}

/**
 * Get the user's current tier. Returns 'free' if no tier record exists.
 * Handles expired subscriptions gracefully.
 *
 * In BETA_MODE: Not called (bypassed by checkOracleAccess).
 */
export async function getUserTier(
  supabase: SupabaseClient,
  userId: string
): Promise<TierInfo> {
  // Beta safety net — if somehow called directly during beta
  if (BETA_MODE) {
    return BETA_ACCESS.tier;
  }

  const { data, error } = await supabase
    .from('user_tiers')
    .select('tier, is_active, started_at, expires_at')
    .eq('user_id', userId)
    .single();

  // No tier record = free user
  if (error || !data) {
    return {
      current: 'free',
      isActive: true,
      startedAt: null,
      expiresAt: null,
    };
  }

  // Check if tier has expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Auto-downgrade expired tier (non-blocking)
    supabase
      .from('user_tiers')
      .update({ tier: 'free', is_active: false })
      .eq('user_id', userId)
      .then(() => {})
      .catch(() => {});

    return {
      current: 'free',
      isActive: true,
      startedAt: null,
      expiresAt: null,
    };
  }

  // Active check
  if (!data.is_active) {
    return {
      current: 'free',
      isActive: true,
      startedAt: null,
      expiresAt: null,
    };
  }

  return {
    current: data.tier as UserTier,
    isActive: true,
    startedAt: data.started_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Check if a specific feature is available for a tier.
 * In BETA_MODE: Always returns true for all features.
 */
export function hasFeature(tier: UserTier, feature: TierFeature): boolean {
  if (BETA_MODE) return true;
  return TIER_CONFIG[tier].features.includes(feature);
}

/**
 * Check if a voice ID is available for a given tier.
 * In BETA_MODE: All voices allowed.
 *
 * Note: All 6 OpenAI voices are available to ALL tiers post-Liberation 1.
 * Premium curated voices (ElevenLabs) require Pro ('premium_voices' feature).
 * Full ElevenLabs library requires Elite ('elevenlabs_full' feature).
 * This check covers the base OpenAI voices in TIER_CONFIG.
 * Premium voice access is handled separately in api/oracle/voices.ts.
 */
export function isVoiceAllowed(tier: UserTier, voiceId: string): boolean {
  if (BETA_MODE) return true;
  return TIER_CONFIG[tier].voices.includes(voiceId);
}

/**
 * Get the tier config for display purposes (client-safe, no secrets).
 */
export function getTierDisplay(tier: UserTier): {
  name: string;
  price: number;
  messageLimit: number | 'unlimited';
  features: TierFeature[];
} {
  const config = TIER_CONFIG[tier];
  return {
    name: config.displayName,
    price: config.priceUsd,
    messageLimit: config.dailyMessageLimit === Infinity ? 'unlimited' : config.dailyMessageLimit,
    features: config.features,
  };
}

/**
 * Check if tier gating is currently active.
 * Useful for client UI — show/hide upgrade prompts.
 */
export function isTierGatingActive(): boolean {
  return !BETA_MODE;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Increment daily usage counter. Uses UPSERT to auto-create today's row.
 * Returns the UPDATED count (after increment).
 *
 * Not called during BETA_MODE.
 */
async function incrementDailyUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ messagesUsed: number }> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Upsert: create row if it doesn't exist, increment if it does.
  const { data, error } = await supabase.rpc('increment_oracle_usage', {
    p_user_id: userId,
    p_date: today,
  });

  // If RPC doesn't exist yet, fall back to manual upsert
  if (error) {
    return await incrementDailyUsageFallback(supabase, userId, today);
  }

  return { messagesUsed: data as number };
}

/**
 * Fallback increment using manual upsert (works without the RPC function).
 */
async function incrementDailyUsageFallback(
  supabase: SupabaseClient,
  userId: string,
  today: string
): Promise<{ messagesUsed: number }> {
  // Try to get existing row
  const { data: existing } = await supabase
    .from('oracle_daily_usage')
    .select('id, message_count')
    .eq('user_id', userId)
    .eq('usage_date', today)
    .single();

  if (existing) {
    const newCount = existing.message_count + 1;
    await supabase
      .from('oracle_daily_usage')
      .update({ message_count: newCount })
      .eq('id', existing.id);
    return { messagesUsed: newCount };
  }

  // Create new row for today
  const { error: insertError } = await supabase
    .from('oracle_daily_usage')
    .insert({
      user_id: userId,
      usage_date: today,
      message_count: 1,
    });

  // Handle race condition
  if (insertError && insertError.code === '23505') {
    const { data: raceRow } = await supabase
      .from('oracle_daily_usage')
      .select('id, message_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single();

    if (raceRow) {
      const newCount = raceRow.message_count + 1;
      await supabase
        .from('oracle_daily_usage')
        .update({ message_count: newCount })
        .eq('id', raceRow.id);
      return { messagesUsed: newCount };
    }
  }

  return { messagesUsed: 1 };
}