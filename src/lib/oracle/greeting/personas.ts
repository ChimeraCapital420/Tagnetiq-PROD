// FILE: src/lib/oracle/greeting/personas.ts
// Oracle Greeting — Persona Detection Engine
//
// ═══════════════════════════════════════════════════════════════════════
// MOBILE-FIRST: This runs ENTIRELY on the client device.
// No server calls. No API hits. No latency.
//
// The user's device already has their profile cached in AuthContext.
// We read it, classify them, and return a persona — instantly.
//
// PERSONAS are not permanent labels — they're the Oracle's best guess
// at what the user needs RIGHT NOW. A flipper opening the app at 6am
// on a Saturday is probably heading to garage sales. The same user
// at 10pm is probably listing what they found.
//
// The Oracle adapts. That's the whole point.
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// TYPES
// =============================================================================

/**
 * Primary persona — what kind of user is this?
 * Detected from profile stats + interests + vault composition.
 */
export type UserPersona =
  | 'flipper'          // Power reseller — scans a lot, logs sales, resale vaults
  | 'collector'        // Collects for love, not money — personal vaults, low sales
  | 'insurance'        // Insurance documentation focus — insurance vault type
  | 'estate'           // Working with family estate — estate-related interests/context
  | 'casual'           // Light user — browses, scans occasionally
  | 'power_user'       // High engagement across all features
  | 'new_user';        // Just completed onboarding, still exploring

/**
 * Session context — what's the user likely doing RIGHT NOW?
 * Combines persona + time-of-day + day-of-week.
 */
export type SessionIntent =
  | 'morning_sourcing'      // Weekend AM — heading out to source
  | 'evening_listing'       // Weeknight PM — listing what they found
  | 'quick_check'           // Brief visit — vault check, notification follow-up
  | 'deep_session'          // Extended use — research, chatting with Oracle
  | 'first_visit'           // Brand new user
  | 'returning_after_break' // Haven't been here in a while
  | 'daily_routine';        // Regular daily check-in

/**
 * Contextual service suggestions the Oracle can offer.
 */
export interface ServiceSuggestion {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: 'navigate' | 'oracle_chat' | 'external';
  navigateTo?: string;
  oraclePrompt?: string;
  externalUrl?: string;
  personas: UserPersona[];  // Which personas see this suggestion
}

/**
 * Complete persona analysis — everything the greeting system needs.
 */
export interface PersonaAnalysis {
  persona: UserPersona;
  intent: SessionIntent;
  confidence: number;          // 0-1 — how sure are we?
  suggestedServices: ServiceSuggestion[];
  engagementLevel: 'new' | 'casual' | 'regular' | 'power';
  daysSinceLastVisit: number;
  streak: number;
}

// =============================================================================
// PROFILE SHAPE (what we read from cached AuthContext)
// =============================================================================

export interface GreetingProfile {
  screen_name?: string;
  full_name?: string;
  interests?: string[];
  total_scans?: number;
  successful_finds?: number;
  subscription_tier?: string;
  onboarding_complete?: boolean;
  last_active_at?: string;       // ISO timestamp
  streak_count?: number;
  vault_stats?: {
    resale_count?: number;
    personal_count?: number;
    insurance_count?: number;
    inventory_count?: number;
  };
  sales_logged?: number;
  conversations_count?: number;
  settings?: Record<string, any>;
}

// =============================================================================
// PERSONA DETECTION — pure function, no side effects
// =============================================================================

/**
 * Classify the user's persona from their cached profile.
 *
 * MOBILE-FIRST: This is a pure function — no network, no async.
 * Runs in <1ms on any device. The device does the thinking.
 */
export function detectPersona(profile: GreetingProfile): UserPersona {
  const scans = profile.total_scans || 0;
  const sales = profile.sales_logged || 0;
  const convos = profile.conversations_count || 0;
  const resaleVault = profile.vault_stats?.resale_count || 0;
  const personalVault = profile.vault_stats?.personal_count || 0;
  const insuranceVault = profile.vault_stats?.insurance_count || 0;
  const interests = profile.interests || [];

  // ── New user: just completed onboarding ─────────────────
  if (scans < 3 && convos < 2) {
    return 'new_user';
  }

  // ── Insurance: has insurance vault items or interest ─────
  if (
    insuranceVault > 0 ||
    interests.some(i => /insurance|documentation|appraisal|coverage/i.test(i))
  ) {
    return 'insurance';
  }

  // ── Estate: estate-related signals ──────────────────────
  if (
    interests.some(i => /estate|inheritance|family.*collection|passed.*away|memorial/i.test(i))
  ) {
    return 'estate';
  }

  // ── Power user: high engagement across the board ────────
  if (scans > 100 && convos > 50 && sales > 10) {
    return 'power_user';
  }

  // ── Flipper: resale focused ─────────────────────────────
  if (
    (resaleVault > personalVault && resaleVault > 3) ||
    sales > 3 ||
    interests.some(i => /flip|resale|resell|thrift|arbitrage|sourcing/i.test(i))
  ) {
    return 'flipper';
  }

  // ── Collector: personal vault dominant ──────────────────
  if (
    personalVault > resaleVault ||
    interests.some(i => /collect|vintage|antique|hobby|memorabilia/i.test(i))
  ) {
    return 'collector';
  }

  // ── Default: casual user ────────────────────────────────
  return 'casual';
}

// =============================================================================
// SESSION INTENT — what are they doing RIGHT NOW?
// =============================================================================

/**
 * Infer what the user is likely doing this session.
 *
 * Uses device clock (mobile-first: no server timezone lookup).
 * The Intl API gives us their local time automatically.
 */
export function detectSessionIntent(
  persona: UserPersona,
  profile: GreetingProfile,
): SessionIntent {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // ── First visit ever ────────────────────────────────────
  if (persona === 'new_user') {
    return 'first_visit';
  }

  // ── Returning after a break (3+ days) ───────────────────
  const lastActive = profile.last_active_at
    ? new Date(profile.last_active_at)
    : null;

  if (lastActive) {
    const daysSince = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= 3) {
      return 'returning_after_break';
    }
  }

  // ── Weekend morning + flipper = sourcing ────────────────
  if (isWeekend && hour >= 5 && hour < 12 && persona === 'flipper') {
    return 'morning_sourcing';
  }

  // ── Evening + flipper = listing time ────────────────────
  if (hour >= 18 && hour < 23 && persona === 'flipper') {
    return 'evening_listing';
  }

  // ── Quick check: off-hours or brief pattern ─────────────
  if (hour < 6 || (hour >= 12 && hour < 14)) {
    return 'quick_check';
  }

  // ── Regular daily check-in ──────────────────────────────
  return 'daily_routine';
}

// =============================================================================
// ENGAGEMENT LEVEL
// =============================================================================

export function detectEngagementLevel(
  profile: GreetingProfile,
): 'new' | 'casual' | 'regular' | 'power' {
  const scans = profile.total_scans || 0;
  const streak = profile.streak_count || 0;
  const convos = profile.conversations_count || 0;

  if (scans < 3) return 'new';
  if (scans > 50 && streak > 5 && convos > 20) return 'power';
  if (scans > 10 || streak > 2) return 'regular';
  return 'casual';
}

// =============================================================================
// SERVICE SUGGESTIONS — contextual offers by persona
// =============================================================================

const ALL_SERVICES: ServiceSuggestion[] = [
  // ── Flipper services ────────────────────────────────────
  {
    id: 'hunt_mode',
    label: 'Hunt Mode',
    description: 'Real-time triage while you source',
    icon: '🎯',
    action: 'navigate',
    navigateTo: '/scanner?mode=hunt',
    personas: ['flipper', 'power_user'],
  },
  {
    id: 'listing_assist',
    label: 'Quick Listing',
    description: 'Draft a listing from your last scan',
    icon: '📝',
    action: 'oracle_chat',
    oraclePrompt: 'Help me list my most recent scan on eBay',
    personas: ['flipper', 'power_user'],
  },
  {
    id: 'market_check',
    label: 'Market Pulse',
    description: 'What\'s moving in your categories',
    icon: '📊',
    action: 'oracle_chat',
    oraclePrompt: 'Give me a quick market update on my top categories',
    personas: ['flipper', 'collector', 'power_user'],
  },

  // ── Collector services ──────────────────────────────────
  {
    id: 'vault_review',
    label: 'Collection Review',
    description: 'See what\'s changed in your vault',
    icon: '🏛️',
    action: 'navigate',
    navigateTo: '/vault',
    personas: ['collector'],
  },
  {
    id: 'find_collectors',
    label: 'Find Collectors',
    description: 'Connect with people who share your interests',
    icon: '🤝',
    action: 'oracle_chat',
    oraclePrompt: 'Find collectors with similar interests to mine',
    personas: ['collector'],
  },

  // ── Estate services ─────────────────────────────────────
  {
    id: 'estate_appraisal',
    label: 'Estate Appraisal',
    description: 'Help documenting and valuing estate items',
    icon: '📋',
    action: 'oracle_chat',
    oraclePrompt: 'I need help appraising items from an estate. Walk me through the process.',
    personas: ['estate'],
  },
  {
    id: 'estate_resources',
    label: 'Estate Resources',
    description: 'Moving, counseling, local services',
    icon: '🏠',
    action: 'oracle_chat',
    oraclePrompt: 'What resources are available for managing an estate? I could use help with moving, organizing, or finding local services.',
    personas: ['estate'],
  },
  {
    id: 'estate_documentation',
    label: 'Document Collection',
    description: 'Scan and catalog estate items systematically',
    icon: '📸',
    action: 'navigate',
    navigateTo: '/scanner',
    personas: ['estate'],
  },

  // ── Insurance services ──────────────────────────────────
  {
    id: 'insurance_report',
    label: 'Coverage Report',
    description: 'Generate a valuation report for your insurer',
    icon: '🛡️',
    action: 'oracle_chat',
    oraclePrompt: 'Generate an insurance valuation report for my documented items',
    personas: ['insurance'],
  },
  {
    id: 'add_items',
    label: 'Document Items',
    description: 'Scan items to add to your insurance vault',
    icon: '📷',
    action: 'navigate',
    navigateTo: '/scanner',
    personas: ['insurance'],
  },

  // ── New user services ───────────────────────────────────
  {
    id: 'first_scan',
    label: 'Scan Something',
    description: 'Try scanning an item to see what happens',
    icon: '📱',
    action: 'navigate',
    navigateTo: '/scanner',
    personas: ['new_user', 'casual'],
  },
  {
    id: 'ask_oracle',
    label: 'Chat with Oracle',
    description: 'Ask me anything — I\'m more than a scanner',
    icon: '🔮',
    action: 'navigate',
    navigateTo: '/oracle',
    personas: ['new_user', 'casual'],
  },
];

/**
 * Get service suggestions for a persona + intent combo.
 * Returns max 3 suggestions, prioritized by relevance.
 */
export function getSuggestions(
  persona: UserPersona,
  intent: SessionIntent,
): ServiceSuggestion[] {
  // Filter by persona
  let relevant = ALL_SERVICES.filter(s => s.personas.includes(persona));

  // Boost certain services based on intent
  if (intent === 'morning_sourcing') {
    // Put hunt mode first for Saturday morning flippers
    relevant.sort((a, b) => {
      if (a.id === 'hunt_mode') return -1;
      if (b.id === 'hunt_mode') return 1;
      return 0;
    });
  }

  if (intent === 'evening_listing') {
    // Put listing assist first for evening sessions
    relevant.sort((a, b) => {
      if (a.id === 'listing_assist') return -1;
      if (b.id === 'listing_assist') return 1;
      return 0;
    });
  }

  if (intent === 'returning_after_break') {
    // Put market check first — catch them up
    relevant.sort((a, b) => {
      if (a.id === 'market_check') return -1;
      if (b.id === 'market_check') return 1;
      return 0;
    });
  }

  return relevant.slice(0, 3);
}

// =============================================================================
// FULL ANALYSIS — one call does everything
// =============================================================================

/**
 * Run the complete persona analysis.
 *
 * MOBILE-FIRST: Pure function. No network. No async. <1ms.
 * Everything is computed from the cached profile on the device.
 */
export function analyzeUser(profile: GreetingProfile): PersonaAnalysis {
  const persona = detectPersona(profile);
  const intent = detectSessionIntent(persona, profile);
  const engagementLevel = detectEngagementLevel(profile);
  const suggestions = getSuggestions(persona, intent);

  // Calculate days since last visit
  const lastActive = profile.last_active_at
    ? new Date(profile.last_active_at)
    : null;
  const daysSinceLastVisit = lastActive
    ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Confidence: higher when we have more data points
  const dataPoints = [
    (profile.total_scans || 0) > 0,
    (profile.sales_logged || 0) > 0,
    (profile.interests?.length || 0) > 0,
    (profile.vault_stats?.resale_count || 0) > 0,
    (profile.conversations_count || 0) > 0,
  ].filter(Boolean).length;

  const confidence = Math.min(1, 0.3 + (dataPoints * 0.14));

  return {
    persona,
    intent,
    confidence,
    suggestedServices: suggestions,
    engagementLevel,
    daysSinceLastVisit,
    streak: profile.streak_count || 0,
  };
}