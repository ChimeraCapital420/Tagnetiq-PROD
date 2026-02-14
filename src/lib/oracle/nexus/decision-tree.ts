// FILE: src/lib/oracle/nexus/decision-tree.ts
// Nexus Decision Tree — Oracle-guided post-scan decision flow
//
// Sprint M: Replaces dumb "List / Vault / Share" buttons with
// an Oracle-guided conversation that reads the situation.
//
// The Oracle evaluates each scan result and suggests the BEST action:
//   HIGH VALUE + HOT MARKET → "List it now. Here's what I'd write."
//   MODERATE VALUE          → "Add to vault. Want me to watch the price?"
//   LOW VALUE               → "I'd pass. Here's why."
//   COLLECTIBLE             → "Vault this — it's appreciating."
//
// The decision tree is computed SERVER-SIDE and sent with the scan response.
// The client renders it as conversational prompts with tap-to-act options.
//
// Mobile-first: Zero client computation. Client receives structured decision
// with pre-written copy and just renders buttons/cards.

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type NudgeType =
  | 'list_now'       // Hot market, high value — list immediately
  | 'list_consider'  // Good value, worth listing but not urgent
  | 'vault_collect'  // Collectible, appreciating — vault and hold
  | 'vault_insure'   // High value, should document for insurance
  | 'watch_price'    // Moderate — watch for price spikes
  | 'pass'           // Low value, not worth action
  | 'scan_more';     // Need more info — scan from another angle

export type MarketDemand = 'hot' | 'warm' | 'cold' | 'unknown';

export interface NexusDecision {
  /** What Oracle recommends */
  nudge: NudgeType;
  /** Oracle's conversational message */
  message: string;
  /** Brief reason (for logging/analytics) */
  reason: string;
  /** Market demand assessment */
  marketDemand: MarketDemand;
  /** Confidence in this recommendation 0-1 */
  confidence: number;

  /** Pre-filled listing data (if nudge is list_now or list_consider) */
  listingDraft?: ListingDraft;

  /** Available user actions — rendered as tap targets */
  actions: NexusAction[];

  /** Follow-up questions Oracle might ask */
  followUp?: string;
}

export interface ListingDraft {
  /** Suggested title (can be edited) */
  title: string;
  /** Suggested description (Oracle-written) */
  description: string;
  /** Suggested price */
  suggestedPrice: number;
  /** Price range */
  priceRange: { low: number; high: number };
  /** Suggested condition */
  condition: string;
  /** Oracle's improvement suggestions */
  suggestions: string[];
  /** Should this be ghost mode? */
  suggestGhost: boolean;
  ghostReason?: string;
}

export interface NexusAction {
  /** Action ID */
  id: string;
  /** Display label */
  label: string;
  /** Action type — client knows how to handle each */
  type: 'list' | 'vault' | 'watch' | 'dismiss' | 'ghost_list' | 'scan_more';
  /** Which vault? */
  vaultCategory?: 'personal' | 'insurance' | 'investment' | 'for_sale';
  /** Is this the primary (recommended) action? */
  primary: boolean;
  /** Optional icon hint */
  icon?: string;
}

// =============================================================================
// DECISION ENGINE
// =============================================================================

export interface ScanContext {
  itemName: string;
  estimatedValue: number;
  confidence: number;
  category: string;
  condition?: string;
  decision?: string;        // HYDRA's BUY/PASS/HOLD
  authorityData?: any;
  ebayData?: any;
  marketSources?: any[];
  ghostData?: any;
  priceRange?: { low: number; high: number };
}

export interface UserContext {
  userId: string;
  vaultItemCount: number;
  scanCount: number;
  favoriteCategories: string[];
  hasListedBefore: boolean;
  tier: string;
}

/**
 * Evaluate a scan result and build the Oracle's recommendation.
 * This is the brain of the Nexus Decision Tree.
 *
 * Called after HYDRA pipeline completes, before sending response to client.
 * Zero extra API calls — pure logic based on scan data.
 *
 * @param scan - HYDRA scan result data
 * @param user - User context for personalization
 */
export function evaluateScan(scan: ScanContext, user: UserContext): NexusDecision {
  const value = scan.estimatedValue || 0;
  const confidence = scan.confidence || 0;
  const hasAuthority = !!scan.authorityData;
  const isVerified = hasAuthority && confidence > 70;
  const demand = assessMarketDemand(scan);
  const isGhostCandidate = !!scan.ghostData;

  // ── HIGH VALUE + HOT MARKET → List Now ────────────────
  if (value >= 100 && demand === 'hot' && confidence >= 60) {
    const draft = buildListingDraft(scan, user);
    return {
      nudge: 'list_now',
      message: buildNudgeMessage('list_now', scan, demand),
      reason: `High value ($${value}), hot demand, ${confidence}% confidence`,
      marketDemand: demand,
      confidence: Math.min(confidence / 100, 0.95),
      listingDraft: draft,
      actions: [
        {
          id: 'list_now',
          label: isGhostCandidate ? '👻 Ghost List' : '🚀 List Now',
          type: isGhostCandidate ? 'ghost_list' : 'list',
          primary: true,
          icon: isGhostCandidate ? 'ghost' : 'zap',
        },
        {
          id: 'vault_for_sale',
          label: 'Vault First',
          type: 'vault',
          vaultCategory: 'for_sale',
          primary: false,
          icon: 'shield',
        },
        {
          id: 'watch',
          label: 'Watch Price',
          type: 'watch',
          primary: false,
          icon: 'eye',
        },
      ],
      followUp: isGhostCandidate
        ? 'Going ghost mode? I can handle the listing anonymously.'
        : 'Want me to tweak the description before listing?',
    };
  }

  // ── GOOD VALUE → Consider Listing ─────────────────────
  if (value >= 50 && (demand === 'hot' || demand === 'warm') && confidence >= 50) {
    const draft = buildListingDraft(scan, user);
    return {
      nudge: 'list_consider',
      message: buildNudgeMessage('list_consider', scan, demand),
      reason: `Good value ($${value}), ${demand} demand`,
      marketDemand: demand,
      confidence: Math.min(confidence / 100, 0.85),
      listingDraft: draft,
      actions: [
        {
          id: 'list',
          label: '📦 List It',
          type: 'list',
          primary: true,
          icon: 'package',
        },
        {
          id: 'vault_personal',
          label: 'Add to Vault',
          type: 'vault',
          vaultCategory: 'personal',
          primary: false,
          icon: 'shield',
        },
        {
          id: 'dismiss',
          label: 'Not Now',
          type: 'dismiss',
          primary: false,
        },
      ],
    };
  }

  // ── HIGH VALUE + APPRECIATING → Vault & Hold ──────────
  if (value >= 200 && isAppreciatingCategory(scan.category)) {
    return {
      nudge: 'vault_collect',
      message: buildNudgeMessage('vault_collect', scan, demand),
      reason: `Collectible ($${value}), ${scan.category} is appreciating`,
      marketDemand: demand,
      confidence: Math.min(confidence / 100, 0.8),
      actions: [
        {
          id: 'vault_investment',
          label: '💎 Vault (Investment)',
          type: 'vault',
          vaultCategory: 'investment',
          primary: true,
          icon: 'gem',
        },
        {
          id: 'watch',
          label: '👁️ Watch Price',
          type: 'watch',
          primary: false,
          icon: 'eye',
        },
        {
          id: 'list',
          label: 'List Anyway',
          type: 'list',
          primary: false,
          icon: 'package',
        },
      ],
      followUp: 'Want me to track this category for you? I\'ll alert you if prices spike.',
    };
  }

  // ── HIGH VALUE → Vault for Insurance ──────────────────
  if (value >= 500) {
    return {
      nudge: 'vault_insure',
      message: buildNudgeMessage('vault_insure', scan, demand),
      reason: `High value ($${value}), should document`,
      marketDemand: demand,
      confidence: Math.min(confidence / 100, 0.75),
      actions: [
        {
          id: 'vault_insurance',
          label: '🔒 Vault (Insurance)',
          type: 'vault',
          vaultCategory: 'insurance',
          primary: true,
          icon: 'lock',
        },
        {
          id: 'list',
          label: 'List It',
          type: 'list',
          primary: false,
          icon: 'package',
        },
        {
          id: 'dismiss',
          label: 'Skip',
          type: 'dismiss',
          primary: false,
        },
      ],
    };
  }

  // ── MODERATE VALUE → Watch ────────────────────────────
  if (value >= 20 && value < 100) {
    return {
      nudge: 'watch_price',
      message: buildNudgeMessage('watch_price', scan, demand),
      reason: `Moderate value ($${value}), worth tracking`,
      marketDemand: demand,
      confidence: Math.min(confidence / 100, 0.7),
      actions: [
        {
          id: 'watch',
          label: '👁️ Watch Price',
          type: 'watch',
          primary: true,
          icon: 'eye',
        },
        {
          id: 'vault_personal',
          label: 'Add to Vault',
          type: 'vault',
          vaultCategory: 'personal',
          primary: false,
          icon: 'shield',
        },
        {
          id: 'dismiss',
          label: 'Pass',
          type: 'dismiss',
          primary: false,
        },
      ],
    };
  }

  // ── LOW CONFIDENCE → Scan More ────────────────────────
  if (confidence < 40 && value > 10) {
    return {
      nudge: 'scan_more',
      message: buildNudgeMessage('scan_more', scan, demand),
      reason: `Low confidence (${confidence}%), needs better image`,
      marketDemand: 'unknown',
      confidence: confidence / 100,
      actions: [
        {
          id: 'scan_more',
          label: '📷 Scan Again',
          type: 'scan_more',
          primary: true,
          icon: 'camera',
        },
        {
          id: 'vault_personal',
          label: 'Vault Anyway',
          type: 'vault',
          vaultCategory: 'personal',
          primary: false,
          icon: 'shield',
        },
      ],
      followUp: 'Try getting a clearer angle or scan the back/bottom.',
    };
  }

  // ── DEFAULT: Pass ─────────────────────────────────────
  return {
    nudge: 'pass',
    message: buildNudgeMessage('pass', scan, demand),
    reason: `Low value ($${value}) or low demand`,
    marketDemand: demand,
    confidence: Math.min(confidence / 100, 0.6),
    actions: [
      {
        id: 'dismiss',
        label: 'Got It',
        type: 'dismiss',
        primary: true,
      },
      {
        id: 'vault_personal',
        label: 'Vault Anyway',
        type: 'vault',
        vaultCategory: 'personal',
        primary: false,
        icon: 'shield',
      },
    ],
  };
}

// =============================================================================
// MARKET DEMAND ASSESSMENT
// =============================================================================

function assessMarketDemand(scan: ScanContext): MarketDemand {
  const ebay = scan.ebayData;
  const sources = scan.marketSources || [];

  // If we have eBay data with recent sales, that's our best signal
  if (ebay) {
    const totalListings = ebay.totalListings || 0;
    const soldCount = ebay.soldCount || 0;
    const sellThrough = totalListings > 0 ? soldCount / totalListings : 0;

    if (sellThrough > 0.3 && soldCount > 5) return 'hot';
    if (sellThrough > 0.15 || soldCount > 3) return 'warm';
    if (totalListings > 0) return 'cold';
  }

  // Multiple market sources = at least warm demand
  if (sources.length >= 3) return 'warm';
  if (sources.length >= 1) return 'cold';

  return 'unknown';
}

// =============================================================================
// LISTING DRAFT BUILDER
// =============================================================================

function buildListingDraft(scan: ScanContext, user: UserContext): ListingDraft {
  const value = scan.estimatedValue || 0;
  const range = scan.priceRange || { low: value * 0.8, high: value * 1.2 };

  // Price strategy: slightly above median for hot market, at median for warm
  const suggestedPrice = Math.round(value * 1.05);

  // Build description
  const descParts: string[] = [];
  descParts.push(scan.itemName);
  if (scan.condition) descParts.push(`Condition: ${scan.condition}`);
  if (scan.authorityData?.source) {
    descParts.push(`Verified by ${scan.authorityData.source}`);
  }
  descParts.push('AI-analyzed and authenticated by TagnetIQ HYDRA');

  // Improvement suggestions
  const suggestions: string[] = [];
  if (!scan.condition || scan.condition === 'good') {
    suggestions.push('Add specific condition details (any flaws, original packaging?)');
  }
  if (scan.category === 'coins' || scan.category === 'trading_cards') {
    suggestions.push('Mention the grade or certification if available');
  }
  if (!scan.ghostData) {
    suggestions.push('Consider Ghost Mode for anonymous listing');
  }
  if (scan.authorityData) {
    suggestions.push(`Highlight the ${scan.authorityData.source} verification in your listing`);
  }

  // Ghost recommendation
  const suggestGhost = !!(scan.ghostData && scan.ghostData.kpis?.estimated_margin > 20);

  return {
    title: scan.itemName,
    description: descParts.join('. ') + '.',
    suggestedPrice,
    priceRange: { low: Math.round(range.low), high: Math.round(range.high) },
    condition: scan.condition || 'good',
    suggestions,
    suggestGhost,
    ghostReason: suggestGhost
      ? `Margin of $${scan.ghostData?.kpis?.estimated_margin?.toFixed(0)} — Ghost Mode keeps the source private.`
      : undefined,
  };
}

// =============================================================================
// NUDGE MESSAGE BUILDER — Oracle's conversational voice
// =============================================================================

function buildNudgeMessage(nudge: NudgeType, scan: ScanContext, demand: MarketDemand): string {
  const value = scan.estimatedValue || 0;
  const name = scan.itemName || 'this item';

  switch (nudge) {
    case 'list_now':
      if (demand === 'hot') {
        return `${name} — this is hot right now. $${value.toFixed(0)} estimated, and there's real demand. I'd list this today.`;
      }
      return `${name} is worth about $${value.toFixed(0)} and the market's moving. Want to list it?`;

    case 'list_consider':
      return `Not bad — ${name} at ~$${value.toFixed(0)}. Market's ${demand}. Could be worth listing if you're not attached to it.`;

    case 'vault_collect':
      return `${name} — this is a keeper. ${scan.category} values are trending up. I'd vault this and hold.`;

    case 'vault_insure':
      return `At $${value.toFixed(0)}, you should document this. Vault it for your records — insurance or investment, your call.`;

    case 'watch_price':
      return `${name} at ~$${value.toFixed(0)}. Not a rush to sell, but worth watching. I'll flag it if prices move.`;

    case 'scan_more':
      return `I'm not fully sure about this one — my confidence is low. Can you scan it from another angle? The back or bottom usually helps.`;

    case 'pass':
      if (value < 5) {
        return `Honest take: this one's not worth the listing fee. ${value > 0 ? `~$${value.toFixed(0)}.` : ''} Keep it or pass.`;
      }
      return `${name} at ~$${value.toFixed(0)}. Not seeing much market demand right now. I'd hold off on listing.`;

    default:
      return `Scanned: ${name}. Estimated at $${value.toFixed(0)}.`;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function isAppreciatingCategory(category: string): boolean {
  const appreciating = new Set([
    'coins', 'stamps', 'trading_cards', 'pokemon', 'vintage',
    'vinyl', 'comics', 'watches', 'jewelry', 'art', 'antiques',
    'sneakers', 'lego', 'star_wars', 'first_edition',
  ]);
  return appreciating.has(category?.toLowerCase() || '');
}

// =============================================================================
// DECISION LOGGING — Track for Oracle learning
// =============================================================================

/**
 * Log what Oracle suggested and what the user chose.
 * This data powers future improvements to the decision engine.
 */
export async function logNexusDecision(
  supabase: SupabaseClient,
  userId: string,
  analysisId: string,
  decision: NexusDecision,
  userAction?: string
): Promise<void> {
  try {
    await supabase.from('nexus_decision_log').insert({
      user_id: userId,
      analysis_id: analysisId,
      nudge_type: decision.nudge,
      nudge_reason: decision.reason,
      suggested_price: decision.listingDraft?.suggestedPrice || null,
      market_demand: decision.marketDemand,
      user_action: userAction || null,
      user_chose_at: userAction ? new Date().toISOString() : null,
    });
  } catch (err: any) {
    // Non-critical logging — don't fail the user flow
    console.warn('Nexus decision log failed (non-fatal):', err.message);
  }
}