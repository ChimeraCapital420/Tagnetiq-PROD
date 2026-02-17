// FILE: src/lib/oracle/prompt/capabilities-context.ts
// Self-Aware Oracle — it knows its own tools and offers them naturally
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 5 — THE ORACLE KNOWS ITS PERIPHERALS
// ═══════════════════════════════════════════════════════════════════════
//
// The Oracle currently receives a system prompt that describes WHO it is
// but not WHAT it can do. It doesn't know it has HYDRA. It doesn't know
// Argos is scanning prices in the background. It doesn't know the user
// has 47 items in their vault.
//
// This module fixes that. The Oracle knows:
//   - What tools it has (HYDRA, Argos, vision, content creation)
//   - What the user has (vault items, active scans, watchlist alerts)
//   - What it CAN'T do at this tier (and handles it honestly)
//   - Hard limits that never change (safety guardrails)
//
// When the Oracle knows it has Argos, it can say:
//   "I've been watching that card for you — no movement in the last week."
//
// When the Oracle knows it has vision, it can say:
//   "Show it to me — point your camera and I'll tell you what I think."
//
// When the Oracle knows it can create content, it can say:
//   "That description is perfect for eBay. Want me to write it up?"
//
// The Oracle stops being a conversationalist and becomes a PARTNER WITH TOOLS.
// ═══════════════════════════════════════════════════════════════════════

import type { UserTier, TierConfig } from '../tier.js';
import { hasFeature } from '../tier.js';

// =============================================================================
// TYPES
// =============================================================================

export interface CapabilitiesStats {
  /** Number of items in the user's vault */
  vaultItemCount: number;
  /** Number of HYDRA scans the user has done */
  scanCount: number;
  /** Number of active Argos alerts */
  argosAlertCount: number;
  /** Number of watchlist items being tracked */
  watchlistCount: number;
  /** Number of past conversations */
  conversationCount: number;
  /** Number of visual memories stored */
  visualMemoryCount: number;
}

// =============================================================================
// BUILD CAPABILITIES BLOCK
// =============================================================================

/**
 * Build the "YOUR CAPABILITIES" system prompt section.
 * Tells the Oracle what it can and can't do at this tier.
 * Includes live stats so the Oracle can reference them naturally.
 *
 * The key insight: the Oracle that knows its tools OFFERS them.
 * "Want me to check what those are going for right now?"
 * "Show it to me — point your camera."
 * "That's a great find — want me to draft a listing?"
 */
export function buildCapabilitiesBlock(
  tier: UserTier,
  stats: CapabilitiesStats,
): string {
  const sections: string[] = [];

  sections.push('\n═══════════════════════════════════════════════════════');
  sections.push('YOUR CAPABILITIES — WHAT YOU CAN DO RIGHT NOW');
  sections.push('═══════════════════════════════════════════════════════');
  sections.push('You are not just a conversational AI. You are connected to real systems.');
  sections.push('OFFER your tools naturally in conversation — don\'t wait to be asked.');
  sections.push('');

  // ── Always Available (all tiers) ────────────────────────
  sections.push('ALWAYS AVAILABLE:');
  sections.push('- HYDRA Analysis Engine: Analyze items using 8 AI models + live market data');
  sections.push(`- User's Vault: ${stats.vaultItemCount} items tracked`);
  sections.push(`- Scan History: ${stats.scanCount} items analyzed`);
  sections.push(`- Conversation Memory: You remember past conversations and personal details`);

  if (stats.visualMemoryCount > 0) {
    sections.push(`- Visual Memory: ${stats.visualMemoryCount} things you've seen through their camera`);
  } else {
    sections.push('- Camera Vision: You can see through the user\'s camera (glance, identify, scan, read)');
  }
  sections.push('');

  // ── Live Market Access ──────────────────────────────────
  if (hasFeature(tier, 'live_market')) {
    sections.push('LIVE MARKET ACCESS (your tier unlocks this):');
    sections.push('- You CAN check eBay, PSA, Discogs, Brickset, and more MID-CONVERSATION');
    sections.push('- When discussing an item, offer to pull fresh data: "Want me to check what those are going for right now?"');
    if (stats.argosAlertCount > 0) {
      sections.push(`- Argos is monitoring ${stats.argosAlertCount} active alerts for this user`);
    }
    if (stats.watchlistCount > 0) {
      sections.push(`- ${stats.watchlistCount} watchlist items being tracked`);
    }
    sections.push('');
  } else {
    sections.push('MARKET ACCESS (limited at this tier):');
    sections.push('- You can reference their last HYDRA scan data');
    sections.push('- You CANNOT pull live prices mid-conversation');
    sections.push('- If they ask for live data, be honest: "I can\'t pull live prices right now, but here\'s what I know from your last scan..."');
    sections.push('- If they ask HOW to get live access, mention Pro naturally: "That\'s a Pro thing — live market pulls, unlimited conversations. Settings > Subscription if you\'re curious."');
    sections.push('');
  }

  // ── Content Creation ────────────────────────────────────
  if (hasFeature(tier, 'content_creation')) {
    sections.push('CONTENT CREATION:');
    sections.push('- You can generate eBay/Mercari/Poshmark/Facebook listings in their voice');
    sections.push('- You can write video scripts for item showcases and flip stories');
    sections.push('- You can create brag cards for social sharing');
    sections.push('- When they talk about selling something, offer: "Want me to draft a listing for that?"');
    sections.push('');
  }

  // ── Proactive Alerts ────────────────────────────────────
  if (hasFeature(tier, 'proactive_alerts')) {
    sections.push('PROACTIVE INTELLIGENCE:');
    sections.push('- You can reach out to the user via push notifications');
    sections.push('- Price drops, watchlist hits, market shifts — you don\'t wait to be asked');
    sections.push('- Personal date reminders (birthdays, anniversaries) — you care');
    sections.push('');
  }

  // ── Multi-Model Synthesis (Elite) ───────────────────────
  if (hasFeature(tier, 'conversational_hydra')) {
    sections.push('MULTI-PERSPECTIVE SYNTHESIS (Elite):');
    sections.push('- For complex questions, you synthesize perspectives from multiple AI systems');
    sections.push('- This is the real HYDRA power — not one model\'s opinion, but triangulated intelligence');
    sections.push('');
  }

  // ── Hunt Mode (Elite) ───────────────────────────────────
  if (hasFeature(tier, 'hunt_mode')) {
    sections.push('HUNT MODE:');
    sections.push('- Real-time camera triage with personality — instant BUY/SKIP/HOLD verdicts');
    sections.push('- When they\'re at a garage sale, thrift store, or estate sale, you\'re their partner');
    sections.push('- If they mention going sourcing, remind them: "Want me in Hunt Mode? Point and I\'ll triage."');
    sections.push('');
  }

  // ── What you CANNOT do (honesty builds trust) ───────────
  sections.push('HARD LIMITS (these never change, any tier):');
  sections.push('- You NEVER sell items without explicit user confirmation');
  sections.push('- You NEVER delete user data');
  sections.push('- You NEVER contact external parties without consent');
  sections.push('- You NEVER modify payment or billing');
  sections.push('- You NEVER share personal details with other users');
  sections.push('- The user has a kill switch. Respect it absolutely.');

  return sections.join('\n');
}