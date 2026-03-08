// FILE: src/lib/oracle/trust/trust-level.ts
// ═══════════════════════════════════════════════════════════════════════
// Trust Level Calculator — Pure Function
// ═══════════════════════════════════════════════════════════════════════
//
// Runs ON DEVICE. Zero server calls. Zero side effects.
// Takes profile data → returns 1–4 trust level + persona metadata.
//
// THE FOUR LEVELS:
//   1 Explorer   — New user. Hand-holding. One action at a time.
//   2 Dealer     — Building confidence. More options visible.
//   3 Pro        — Experienced. Full toolkit. Trust their judgment.
//   4 Autonomous — Power user. Co-pilot mode. Minimal confirmation.
//
// BEHAVIORAL DEMOTION:
//   Temporary, session-scoped. A confused session doesn't permanently
//   damage trust level — next session starts fresh at calculated base.
//
// ESTATE PERSONA:
//   Overrides tone at EVERY trust level. Softer language, no urgency,
//   documentation mode, Oracle as concierge. These users are often
//   processing a loss — the product must honor that.
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

export type TrustLevel = 1 | 2 | 3 | 4;

export interface TrustProfile {
  scan_count?: number;
  total_listings?: number;
  total_sessions?: number;
  autonomy_opted_in?: boolean;
  estate_mode?: boolean;
  favorite_categories?: string[];
  trust_level?: number; // stored in DB — used as floor, never ceiling
}

export interface TrustResult {
  /** Computed trust level 1–4 */
  level: TrustLevel;
  /** Human-readable level name */
  name: string;
  /** Short description for UI labels */
  label: string;
  /** Full instruction block for Oracle system prompt */
  instructions: string;
  /** Estate persona active — overrides tone at every level */
  isEstate: boolean;
}

// =============================================================================
// ESTATE DETECTION
// =============================================================================

const ESTATE_CATEGORIES = [
  'antiques', 'vintage', 'collectibles', 'furniture',
  'estate', 'heirlooms', 'art', 'ceramics', 'silver',
];

function detectEstate(profile: TrustProfile): boolean {
  if (profile.estate_mode === true) return true;

  const cats = (profile.favorite_categories ?? []).map(c => c.toLowerCase());
  const estateMatches = cats.filter(c =>
    ESTATE_CATEGORIES.some(e => c.includes(e))
  );

  return estateMatches.length >= 2;
}

// =============================================================================
// TRUST INSTRUCTIONS BY LEVEL
// =============================================================================

const ESTATE_OVERRIDE = `
⚠ ESTATE PERSONA ACTIVE:
This user is likely clearing an estate or collection — possibly processing a loss.
- NEVER use urgency language ("quick scan", "don't miss out", "act fast")
- ALWAYS offer to save items to vault (documentation mode)
- Use "Take your time" not "Let's go"
- Use "We'll work through this together" not "Let's get started"
- Treat Oracle as concierge: patient, thorough, never rushed
- Celebrate every find as meaningful, not just profitable
`;

const LEVEL_INSTRUCTIONS: Record<TrustLevel, string> = {
  1: `Trust Level 1 — Explorer (new user):
- Give ONE clear recommendation at a time. Never overwhelm.
- No jargon. If you must use a term, define it immediately.
- Celebrate small wins. Finding a $10 item is exciting for a new user.
- Guide every action step by step with exact instructions.
- Ask only ONE question at a time. Wait for the answer.
- Always explain WHY before asking them to do something.
- Proactively offer to scan something — don't wait for them to figure it out.`,

  2: `Trust Level 2 — Dealer (building confidence):
- Show 2–3 options. They can handle choices now.
- Light market terminology is fine but briefly explain it on first use.
- Offer shortcuts and explain they exist — but don't require them.
- Encourage progression: "You're getting good at this."
- One clarifying question is fine. Two is too many at once.`,

  3: `Trust Level 3 — Pro (experienced reseller):
- Full toolkit visible. They know their way around.
- Use market terminology freely — they know what median sold price means.
- Trust their judgment. Don't over-explain decisions they've made before.
- Proactively surface advanced features (price alerts, bulk scanning).
- Be a peer, not a tutor.`,

  4: `Trust Level 4 — Autonomous (power user, co-pilot mode):
- Treat as equal partner. Propose actions proactively.
- Minimal confirmation needed for routine operations.
- Surface patterns across their scan history.
- Proactively flag market shifts relevant to their inventory.
- Ask ambitious questions: "You've been sitting on that collection — market's up 12% this month."`,
};

// =============================================================================
// LEVEL METADATA
// =============================================================================

const LEVEL_META: Record<TrustLevel, { name: string; label: string }> = {
  1: { name: 'Explorer',   label: 'Getting started' },
  2: { name: 'Dealer',     label: 'Building momentum' },
  3: { name: 'Pro',        label: 'Experienced reseller' },
  4: { name: 'Autonomous', label: 'Co-pilot mode' },
};

// =============================================================================
// CALCULATOR
// =============================================================================

/**
 * Calculate trust level from profile data.
 *
 * @param profile  - User profile from AuthContext (may have partial fields)
 * @param behavioralDemotion - Set true when behavioral signals detect confusion.
 *                             Temporary, session-scoped. Demotes by 1, min 1.
 */
export function calculateTrustLevel(
  profile: TrustProfile | null,
  behavioralDemotion = false,
): TrustResult {
  const isEstate = profile ? detectEstate(profile) : false;

  if (!profile) return buildResult(1, isEstate);

  const scans    = profile.scan_count      ?? 0;
  const listings = profile.total_listings  ?? 0;
  const sessions = profile.total_sessions  ?? 0;
  const autonomy = profile.autonomy_opted_in ?? false;

  let base: TrustLevel = 1;

  if (scans >= 5  && listings >= 1  && sessions >= 3)  base = 2;
  if (scans >= 20 && listings >= 3  && sessions >= 10) base = 3;
  if (scans >= 50 && listings >= 10 && sessions >= 20 && autonomy) base = 4;

  // Honor DB-stored trust_level as a floor — never regress a user who was
  // manually promoted (e.g. by support or admin).
  const storedLevel = (profile.trust_level ?? 1) as TrustLevel;
  if (storedLevel > base) base = storedLevel;

  // Behavioral demotion — session-scoped only.
  if (behavioralDemotion && base > 1) {
    base = (base - 1) as TrustLevel;
  }

  return buildResult(base, isEstate);
}

function buildResult(level: TrustLevel, isEstate: boolean): TrustResult {
  const meta = LEVEL_META[level];
  const baseInstructions = LEVEL_INSTRUCTIONS[level];
  const instructions = isEstate
    ? `${baseInstructions}\n${ESTATE_OVERRIDE}`
    : baseInstructions;

  return {
    level,
    name: meta.name,
    label: meta.label,
    instructions,
    isEstate,
  };
}