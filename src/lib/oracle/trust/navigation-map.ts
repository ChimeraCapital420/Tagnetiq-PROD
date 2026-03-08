// FILE: src/lib/oracle/trust/navigation-map.ts
// ═══════════════════════════════════════════════════════════════════════
// Navigation Map — Static Data
// ═══════════════════════════════════════════════════════════════════════
//
// Maps app destinations to step-by-step instructions at each trust level.
// Used by GuidedOverlay to tell Oracle HOW to guide a user to a destination.
//
// TRUST LEVEL 1–2: Step-by-step with exact UI element descriptions.
// TRUST LEVEL 3–4: Short path description (they know their way).
//
// Oracle reads this when a user asks "how do I get to X?" and adapts
// its response to their experience level automatically.
// ═══════════════════════════════════════════════════════════════════════

import type { TrustLevel } from './trust-level';

export interface NavDestination {
  id: string;
  label: string;
  path: string;
  /** Brief path for experienced users */
  shortPath: string;
  /** Step-by-step for new users */
  steps: string[];
  /** Icon or element description for GuidedOverlay spotlight */
  spotlightTarget?: string;
}

type NavMap = Record<string, NavDestination>;

export const NAVIGATION_MAP: NavMap = {
  scan: {
    id: 'scan',
    label: 'Scan an item',
    path: '/',
    shortPath: 'Dashboard → Scan button (camera icon)',
    steps: [
      "See the camera icon in the middle of the top bar? Tap that.",
      "Point your camera at the item. Try to get good lighting.",
      "Tap the big circle button at the bottom to take the photo.",
      "Wait a few seconds — your Oracle is analyzing it.",
    ],
    spotlightTarget: '[data-tour="scanner-button"]',
  },
  vault: {
    id: 'vault',
    label: 'View your vault',
    path: '/vault',
    shortPath: 'Vault icon in top nav',
    steps: [
      "See the shield icon at the top of the screen? That's your Vault.",
      "Tap it — it shows everything you've saved.",
    ],
    spotlightTarget: '[data-tour="vault-nav"]',
  },
  oracle: {
    id: 'oracle',
    label: 'Chat with your Oracle',
    path: '/oracle',
    shortPath: 'Zap/lightning icon in top nav or Oracle bar at bottom',
    steps: [
      "See the lightning bolt icon (⚡) at the top? Tap that.",
      "Or tap the slim bar at the very bottom of your screen — that's your Oracle, always ready.",
    ],
    spotlightTarget: '[data-tour="oracle-nav"]',
  },
  marketplace: {
    id: 'marketplace',
    label: 'Browse the marketplace',
    path: '/arena/marketplace',
    shortPath: 'Arena → Marketplace',
    steps: [
      "Tap the shopping bag icon at the top right.",
      "This is the Marketplace — items listed by other TagnetIQ users.",
    ],
    spotlightTarget: '[data-tour="marketplace-nav"]',
  },
  profile: {
    id: 'profile',
    label: 'View your profile',
    path: '/profile',
    shortPath: 'Profile → top right avatar',
    steps: [
      "See the person icon at the top right? Tap that — that's your profile.",
    ],
    spotlightTarget: '[data-tour="profile-nav"]',
  },
  voices: {
    id: 'voices',
    label: 'Change Oracle voice',
    path: '/voices',
    shortPath: 'Profile → Settings → Voice Selection',
    steps: [
      "Tap the person icon at the top right — that's your profile.",
      "Tap Settings — it's the gear icon.",
      "Scroll down and you'll see Voice Selection.",
    ],
    spotlightTarget: '[data-tour="profile-nav"]',
  },
  hunt: {
    id: 'hunt',
    label: 'Start Hunt Mode',
    path: '/hunt',
    shortPath: 'Glasses icon in top nav',
    steps: [
      "See the glasses icon at the top? That's Hunt Mode.",
      "It's designed for scanning lots of items quickly — great for estate sales and thrift stores.",
      "Tap it to start.",
    ],
    spotlightTarget: '[data-tour="hunt-nav"]',
  },
};

/**
 * Get navigation instructions appropriate for the user's trust level.
 */
export function getNavInstructions(
  destinationId: string,
  trustLevel: TrustLevel,
): string {
  const dest = NAVIGATION_MAP[destinationId];
  if (!dest) return `Navigate to ${destinationId}.`;

  if (trustLevel >= 3) {
    return `${dest.label}: ${dest.shortPath}`;
  }

  const numberedSteps = dest.steps
    .map((step, i) => `${i + 1}. ${step}`)
    .join('\n');

  return `Here's how to get to ${dest.label}:\n${numberedSteps}`;
}