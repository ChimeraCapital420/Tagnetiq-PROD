// FILE: src/lib/oracle/trust/guidance-config.ts
// ═══════════════════════════════════════════════════════════════════════
// Guidance Config — GuidedOverlay Step Definitions
// ═══════════════════════════════════════════════════════════════════════
//
// Each guidance step maps to:
//   - A spotlight target (CSS selector or data-tour attribute)
//   - An Oracle message (what Dash/Oracle says out loud)
//   - A trigger condition (when this step fires)
//   - A completion signal (what action marks this step done)
//
// Steps only show for Trust Level 1 users.
// After Trust Level 2 is reached, guidance stops automatically.
//
// ESTATE PERSONA: All messages have softer variants for estate users.
// ═══════════════════════════════════════════════════════════════════════

export interface GuidanceStep {
  id: string;
  /** CSS selector or data-tour attribute to spotlight */
  spotlightTarget: string;
  /** Message Oracle speaks/displays */
  message: string;
  /** Softer message for estate users */
  estateMessage?: string;
  /** Route where this step should appear */
  route: string;
  /** Event that triggers this step */
  trigger: 'route_enter' | 'scan_complete' | 'custom';
  /** Event or action that completes this step */
  completedBy: 'tap_target' | 'route_change' | 'scan_submit' | 'timer';
  /** Milliseconds before auto-advancing (for 'timer' completedBy) */
  autoAdvanceMs?: number;
  /** Session storage key to track if this step has been shown */
  shownKey: string;
}

export const GUIDANCE_STEPS: GuidanceStep[] = [
  {
    id: 'welcome_scan',
    spotlightTarget: '[data-tour="scanner-button"]',
    message: "Let's start with a scan. See that camera icon? Tap it and point it at anything nearby — I'll tell you what it's worth.",
    estateMessage: "When you're ready, tap that camera icon and point it at something from the collection. I'll look it up for you — no rush.",
    route: '/dashboard',
    trigger: 'route_enter',
    completedBy: 'tap_target',
    shownKey: 'guidance_welcome_scan_shown',
  },
  {
    id: 'first_result',
    spotlightTarget: '[data-tour="analysis-result"]',
    message: "There's your analysis. See the estimated value? Tap 'Add to Vault' to save it — your vault keeps track of everything you find.",
    estateMessage: "Here's what I found. Take a look at the estimated value. If you'd like to save it, tap 'Add to Vault' — we can build a full record of the collection.",
    route: '/dashboard',
    trigger: 'scan_complete',
    completedBy: 'route_change',
    shownKey: 'guidance_first_result_shown',
  },
  {
    id: 'oracle_intro',
    spotlightTarget: '[data-tour="oracle-bar"]',
    message: "See that slim bar at the bottom? That's me — your Oracle. Tap it anytime you have a question. Try asking 'what's a good item to scan today?'",
    estateMessage: "That slim bar at the bottom is me. I'm always here if you want to ask anything — about an item, about value, about anything at all.",
    route: '/dashboard',
    trigger: 'route_enter',
    completedBy: 'tap_target',
    shownKey: 'guidance_oracle_intro_shown',
    autoAdvanceMs: 15000,
  },
  {
    id: 'vault_intro',
    spotlightTarget: '[data-tour="vault-nav"]',
    message: "You've saved a few items — want to see your vault? Tap the shield icon at the top.",
    estateMessage: "You've started your record. Tap the shield icon at the top to see everything you've documented so far.",
    route: '/dashboard',
    trigger: 'custom', // Triggered after 3+ vault saves
    completedBy: 'tap_target',
    shownKey: 'guidance_vault_intro_shown',
  },
];

/**
 * Get the next unshown guidance step for this route.
 * Checks sessionStorage to avoid re-showing completed steps.
 */
export function getNextGuidanceStep(
  route: string,
  trigger: GuidanceStep['trigger'],
): GuidanceStep | null {
  const steps = GUIDANCE_STEPS.filter(
    s => s.route === route && s.trigger === trigger
  );

  for (const step of steps) {
    const shown = sessionStorage.getItem(step.shownKey);
    if (!shown) return step;
  }

  return null;
}

/** Mark a guidance step as shown for this session */
export function markStepShown(stepId: string): void {
  const step = GUIDANCE_STEPS.find(s => s.id === stepId);
  if (step) sessionStorage.setItem(step.shownKey, '1');
}