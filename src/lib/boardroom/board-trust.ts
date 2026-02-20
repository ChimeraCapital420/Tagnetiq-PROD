// FILE: src/lib/boardroom/board-trust.ts
// Sprint 8: Board Trust Calibration
//
// The Oracle has trust/tracker.ts for per-user trust.
// Board members have trust that gates their AUTONOMY.
// This file bridges Oracle's trust signal detection into the board context.
//
// Trust tiers (matching Sprint 7 frontend):
//   0-39  Observer   — analysis only, all actions need approval
//   40-59 Advisor    — minor decisions in domain, major needs approval
//   60-79 Trusted    — act in domain with post-hoc review
//   80-89 Autonomous — full authority in domain
//   90-100 Executive — can delegate and coordinate other members
//
// Trust changes through SIGNALS detected in interactions,
// not arbitrary increments. Every trust change has a reason.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type TrustTier = 'observer' | 'advisor' | 'trusted' | 'autonomous' | 'executive';

export interface TrustSignal {
  type: TrustSignalType;
  weight: number;
  reason: string;
  memberSlug: string;
  detectedAt: string;
}

export type TrustSignalType =
  | 'accurate_analysis'      // Prediction or analysis proved correct
  | 'fast_response'          // Responded quickly without errors
  | 'cross_domain_success'   // Helped outside primary domain effectively
  | 'user_accepted'          // User followed the member's recommendation
  | 'user_rejected'          // User explicitly disagreed/rejected advice
  | 'action_succeeded'       // Autonomous action completed successfully
  | 'action_failed'          // Autonomous action failed or was rolled back
  | 'consistency'            // Maintained consistent quality over time
  | 'hallucination'          // Gave incorrect or fabricated information
  | 'missed_context'         // Failed to consider relevant context
  | 'overstepped'            // Acted beyond trust level boundaries
  | 'proactive_value'        // Provided valuable unsolicited insight
  | 'team_alignment'         // Good collaboration with other members
  | 'cost_efficient';        // Achieved goal under cost estimate

export interface TrustCalibration {
  slug: string;
  currentTrust: number;
  tier: TrustTier;
  signals: TrustSignal[];
  trustDelta: number;
  newTrust: number;
  newTier: TrustTier;
  tierChanged: boolean;
  reason: string;
}

export interface MemberTrustProfile {
  slug: string;
  trust: number;
  tier: TrustTier;
  recentSignals: TrustSignal[];
  strengths: string[];
  risks: string[];
  /** How many interactions since last trust change */
  stabilityStreak: number;
  /** Recommended: should trust go up, down, or hold? */
  recommendation: 'increase' | 'decrease' | 'hold';
}

// =============================================================================
// TRUST TIER CLASSIFICATION
// =============================================================================

export function getTrustTier(trust: number): TrustTier {
  if (trust >= 90) return 'executive';
  if (trust >= 80) return 'autonomous';
  if (trust >= 60) return 'trusted';
  if (trust >= 40) return 'advisor';
  return 'observer';
}

export function getTrustTierLabel(tier: TrustTier): string {
  const labels: Record<TrustTier, string> = {
    observer: 'Observer (0-39)',
    advisor: 'Advisor (40-59)',
    trusted: 'Trusted (60-79)',
    autonomous: 'Autonomous (80-89)',
    executive: 'Executive (90-100)',
  };
  return labels[tier];
}

// =============================================================================
// TRUST SIGNAL DETECTION
// =============================================================================

/** Signal weights — how much each signal moves trust */
const SIGNAL_WEIGHTS: Record<TrustSignalType, number> = {
  accurate_analysis: +3,
  fast_response: +1,
  cross_domain_success: +4,
  user_accepted: +2,
  user_rejected: -1,
  action_succeeded: +5,
  action_failed: -8,
  consistency: +2,
  hallucination: -10,
  missed_context: -3,
  overstepped: -6,
  proactive_value: +3,
  team_alignment: +2,
  cost_efficient: +2,
};

/**
 * Detect trust signals from a board member interaction.
 * Called after each response to evaluate quality.
 */
export function detectTrustSignals(params: {
  memberSlug: string;
  responseTime: number;
  wasFallback: boolean;
  wasCrossDomain: boolean;
  userReaction?: 'accepted' | 'rejected' | 'neutral';
  actionOutcome?: 'succeeded' | 'failed' | null;
  responseQuality?: 'good' | 'hallucination' | 'missed_context' | 'normal';
  costVsEstimate?: 'under' | 'over' | 'on_target';
}): TrustSignal[] {
  const {
    memberSlug,
    responseTime,
    wasFallback,
    wasCrossDomain,
    userReaction = 'neutral',
    actionOutcome = null,
    responseQuality = 'normal',
    costVsEstimate,
  } = params;

  const signals: TrustSignal[] = [];
  const now = new Date().toISOString();

  // Fast, non-fallback response
  if (responseTime < 3000 && !wasFallback) {
    signals.push({
      type: 'fast_response',
      weight: SIGNAL_WEIGHTS.fast_response,
      reason: `Responded in ${Math.round(responseTime)}ms without fallback`,
      memberSlug,
      detectedAt: now,
    });
  }

  // Cross-domain success
  if (wasCrossDomain && responseQuality !== 'hallucination') {
    signals.push({
      type: 'cross_domain_success',
      weight: SIGNAL_WEIGHTS.cross_domain_success,
      reason: 'Successfully helped outside primary domain',
      memberSlug,
      detectedAt: now,
    });
  }

  // User reaction
  if (userReaction === 'accepted') {
    signals.push({
      type: 'user_accepted',
      weight: SIGNAL_WEIGHTS.user_accepted,
      reason: 'User accepted recommendation',
      memberSlug,
      detectedAt: now,
    });
  } else if (userReaction === 'rejected') {
    signals.push({
      type: 'user_rejected',
      weight: SIGNAL_WEIGHTS.user_rejected,
      reason: 'User rejected recommendation',
      memberSlug,
      detectedAt: now,
    });
  }

  // Action outcomes (from execution gateway)
  if (actionOutcome === 'succeeded') {
    signals.push({
      type: 'action_succeeded',
      weight: SIGNAL_WEIGHTS.action_succeeded,
      reason: 'Autonomous action completed successfully',
      memberSlug,
      detectedAt: now,
    });
  } else if (actionOutcome === 'failed') {
    signals.push({
      type: 'action_failed',
      weight: SIGNAL_WEIGHTS.action_failed,
      reason: 'Action failed or was rolled back',
      memberSlug,
      detectedAt: now,
    });
  }

  // Response quality
  if (responseQuality === 'hallucination') {
    signals.push({
      type: 'hallucination',
      weight: SIGNAL_WEIGHTS.hallucination,
      reason: 'Response contained incorrect or fabricated information',
      memberSlug,
      detectedAt: now,
    });
  } else if (responseQuality === 'missed_context') {
    signals.push({
      type: 'missed_context',
      weight: SIGNAL_WEIGHTS.missed_context,
      reason: 'Failed to consider available context',
      memberSlug,
      detectedAt: now,
    });
  } else if (responseQuality === 'good') {
    signals.push({
      type: 'accurate_analysis',
      weight: SIGNAL_WEIGHTS.accurate_analysis,
      reason: 'Provided accurate, valuable analysis',
      memberSlug,
      detectedAt: now,
    });
  }

  // Cost efficiency
  if (costVsEstimate === 'under') {
    signals.push({
      type: 'cost_efficient',
      weight: SIGNAL_WEIGHTS.cost_efficient,
      reason: 'Completed under estimated cost',
      memberSlug,
      detectedAt: now,
    });
  }

  return signals;
}

// =============================================================================
// TRUST CALIBRATION
// =============================================================================

/**
 * Calibrate trust for a board member based on accumulated signals.
 * Returns the trust change and new trust level.
 * Applies dampening at higher trust levels — harder to gain, easier to lose.
 */
export function calibrateTrust(
  currentTrust: number,
  signals: TrustSignal[],
): TrustCalibration {
  const slug = signals[0]?.memberSlug || 'unknown';
  const oldTier = getTrustTier(currentTrust);

  // Calculate raw delta from signals
  let rawDelta = signals.reduce((sum, s) => sum + s.weight, 0);

  // Dampening: harder to gain trust at higher levels
  if (rawDelta > 0) {
    if (currentTrust >= 80) rawDelta *= 0.5;
    else if (currentTrust >= 60) rawDelta *= 0.7;
    else if (currentTrust >= 40) rawDelta *= 0.85;
    // Below 40: full weight — easy to build initial trust
  }

  // Amplify negative signals at high trust — more to lose
  if (rawDelta < 0 && currentTrust >= 60) {
    rawDelta *= 1.3;
  }

  // Round and clamp
  const trustDelta = Math.round(rawDelta * 10) / 10;
  const newTrust = Math.max(0, Math.min(100, currentTrust + trustDelta));
  const newTier = getTrustTier(newTrust);
  const tierChanged = oldTier !== newTier;

  // Build human-readable reason
  const positiveSignals = signals.filter((s) => s.weight > 0);
  const negativeSignals = signals.filter((s) => s.weight < 0);
  let reason = '';
  if (positiveSignals.length > 0 && negativeSignals.length === 0) {
    reason = `+${trustDelta}: ${positiveSignals.map((s) => s.reason).join('; ')}`;
  } else if (negativeSignals.length > 0 && positiveSignals.length === 0) {
    reason = `${trustDelta}: ${negativeSignals.map((s) => s.reason).join('; ')}`;
  } else {
    reason = `Net ${trustDelta > 0 ? '+' : ''}${trustDelta}: Mixed signals`;
  }

  if (tierChanged) {
    reason += ` — TIER CHANGE: ${oldTier} → ${newTier}`;
  }

  return {
    slug,
    currentTrust,
    tier: oldTier,
    signals,
    trustDelta,
    newTrust,
    newTier,
    tierChanged,
    reason,
  };
}

// =============================================================================
// PERSIST TRUST
// =============================================================================

/**
 * Apply trust calibration to the database and log it.
 */
export async function applyTrustCalibration(
  supabase: SupabaseClient,
  calibration: TrustCalibration,
): Promise<void> {
  // Update member trust level
  await supabase
    .from('boardroom_members')
    .update({ trust_level: Math.round(calibration.newTrust) })
    .eq('slug', calibration.slug);

  // Log each signal for audit trail
  const signalRows = calibration.signals.map((s) => ({
    member_slug: s.memberSlug,
    signal_type: s.type,
    weight: s.weight,
    reason: s.reason,
    trust_before: calibration.currentTrust,
    trust_after: calibration.newTrust,
    tier_before: calibration.tier,
    tier_after: calibration.newTier,
    tier_changed: calibration.tierChanged,
  }));

  // Insert to trust_signals log (graceful — don't fail if table missing)
  await supabase
    .from('board_trust_signals')
    .insert(signalRows)
    .then(() => {})
    .catch(() => {
      // Table may not exist yet — log and continue
      console.warn('[board-trust] board_trust_signals table not found, skipping log');
    });
}

// =============================================================================
// TRUST PROFILE (for dashboard/API)
// =============================================================================

/**
 * Build a full trust profile for a member.
 * Used by the cognitive dashboard to show trust health.
 */
export async function getMemberTrustProfile(
  supabase: SupabaseClient,
  memberSlug: string,
): Promise<MemberTrustProfile> {
  // Get current member data
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('slug, trust_level, total_interactions, cross_domain_assists')
    .eq('slug', memberSlug)
    .single();

  const trust = member?.trust_level ?? 20;
  const tier = getTrustTier(trust);

  // Try to get recent signals
  const { data: recentSignals } = await supabase
    .from('board_trust_signals')
    .select('signal_type, weight, reason, created_at')
    .eq('member_slug', memberSlug)
    .order('created_at', { ascending: false })
    .limit(20);

  const signals: TrustSignal[] = (recentSignals || []).map((s: any) => ({
    type: s.signal_type,
    weight: s.weight,
    reason: s.reason,
    memberSlug,
    detectedAt: s.created_at,
  }));

  // Analyze strengths and risks
  const positiveTypes = signals
    .filter((s) => s.weight > 0)
    .map((s) => s.type);
  const negativeTypes = signals
    .filter((s) => s.weight < 0)
    .map((s) => s.type);

  const strengths = [...new Set(positiveTypes)].slice(0, 3).map(typeToStrength);
  const risks = [...new Set(negativeTypes)].slice(0, 3).map(typeToRisk);

  // Recommendation
  const recentPositive = signals.filter((s) => s.weight > 0).length;
  const recentNegative = signals.filter((s) => s.weight < 0).length;
  let recommendation: MemberTrustProfile['recommendation'] = 'hold';
  if (recentPositive > recentNegative * 2 && trust < 90) recommendation = 'increase';
  if (recentNegative > recentPositive) recommendation = 'decrease';

  return {
    slug: memberSlug,
    trust,
    tier,
    recentSignals: signals.slice(0, 10),
    strengths,
    risks,
    stabilityStreak: Math.max(0, (member?.total_interactions ?? 0) - signals.length),
    recommendation,
  };
}

// =============================================================================
// TRUST → PROMPT INJECTION
// =============================================================================

/**
 * Build a prompt block informing the member about their trust status.
 * Gives them behavioral boundaries based on tier.
 */
export function buildTrustPromptBlock(trust: number): string {
  const tier = getTrustTier(trust);

  const behaviors: Record<TrustTier, string> = {
    observer:
      'You are in Observer mode. Provide analysis and recommendations only. Flag actions you WOULD take if you had authority — this builds trust.',
    advisor:
      'You are an Advisor. You can make minor decisions within your domain (low-impact, reversible). Major decisions need approval. Demonstrate good judgment consistently.',
    trusted:
      'You are Trusted. Act within your domain — the team reviews post-hoc. If uncertain about impact, flag it rather than proceeding. Your judgment has been validated.',
    autonomous:
      'You have Autonomous authority in your domain. Act decisively. Cross-domain actions still need coordination. Your track record earned this — maintain it.',
    executive:
      'You have Executive authority. You can delegate tasks to other board members and coordinate multi-member efforts. Lead with confidence. The team trusts your judgment.',
  };

  return `\nTRUST STATUS: ${getTrustTierLabel(tier)} (${trust}/100)
${behaviors[tier]}`;
}

// =============================================================================
// HELPERS
// =============================================================================

function typeToStrength(type: TrustSignalType): string {
  const map: Partial<Record<TrustSignalType, string>> = {
    accurate_analysis: 'Accurate analysis',
    fast_response: 'Fast responder',
    cross_domain_success: 'Versatile across domains',
    user_accepted: 'User-aligned recommendations',
    action_succeeded: 'Reliable execution',
    consistency: 'Consistent quality',
    proactive_value: 'Proactive insights',
    team_alignment: 'Good team player',
    cost_efficient: 'Cost conscious',
  };
  return map[type] || type;
}

function typeToRisk(type: TrustSignalType): string {
  const map: Partial<Record<TrustSignalType, string>> = {
    user_rejected: 'Recommendations sometimes rejected',
    action_failed: 'Action failures',
    hallucination: 'Accuracy concerns',
    missed_context: 'Context awareness gaps',
    overstepped: 'Overstepped boundaries',
  };
  return map[type] || type;
}