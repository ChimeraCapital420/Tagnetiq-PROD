// FILE: src/lib/oracle/greeting/greetings.ts
// Oracle Greeting — Template Engine
//
// ═══════════════════════════════════════════════════════════════════════
// MOBILE-FIRST: Time-of-day comes from the DEVICE clock.
// No server round-trip to figure out it's morning. The phone knows.
//
// WHY THIS MATTERS:
// "You've Got Mail" made AOL feel alive. A simple "Good morning, Billy"
// from your Oracle makes the app feel like it knows you. Like opening
// the door and your partner says "Hey, I already started coffee."
//
// The greeting is never generic. It's never the same twice in a row.
// It reflects:
//   - Time of day (the device knows)
//   - Who you are (persona from cached profile)
//   - What you might need (session intent)
//   - How long it's been (engagement tracking)
//   - Your streak (gamification tie-in)
//
// The Oracle doesn't say "Welcome back, valued user."
// The Oracle says "Morning, Billy. Your Pyrex 443 dropped to $38
// overnight — might be time to pounce."
// ═══════════════════════════════════════════════════════════════════════

import type {
  UserPersona,
  SessionIntent,
  PersonaAnalysis,
  GreetingProfile,
} from './personas.js';

// =============================================================================
// TYPES
// =============================================================================

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface OracleGreeting {
  /** The main greeting line — "Good morning, Billy" */
  salutation: string;
  /** The follow-up line — contextual, persona-aware */
  followUp: string;
  /** Optional third line — a nudge or suggestion */
  nudge?: string;
  /** Time of day for theming */
  timeOfDay: TimeOfDay;
  /** Emoji/icon for the greeting */
  icon: string;
}

// =============================================================================
// TIME OF DAY — from device clock
// =============================================================================

/**
 * Get time of day from device clock.
 * MOBILE-FIRST: Uses Intl for the user's actual local time.
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get a time-appropriate icon.
 */
function getTimeIcon(time: TimeOfDay): string {
  switch (time) {
    case 'morning': return '☀️';
    case 'afternoon': return '🌤️';
    case 'evening': return '🌅';
    case 'night': return '🌙';
  }
}

// =============================================================================
// SALUTATION TEMPLATES — the "Hello Billy" part
// =============================================================================

const SALUTATIONS: Record<TimeOfDay, string[]> = {
  morning: [
    'Good morning, {{name}}.',
    'Morning, {{name}}.',
    'Rise and grind, {{name}}.',
    'Hey {{name}} — early bird gets the finds.',
    'Morning. Let\'s make today count, {{name}}.',
  ],
  afternoon: [
    'Good afternoon, {{name}}.',
    'Hey {{name}}.',
    'Afternoon, {{name}}.',
    '{{name}} — good to see you.',
    'Hey there, {{name}}.',
  ],
  evening: [
    'Good evening, {{name}}.',
    'Evening, {{name}}.',
    'Hey {{name}} — winding down?',
    '{{name}}. Good evening.',
    'Hey {{name}}.',
  ],
  night: [
    'Hey {{name}} — burning the midnight oil?',
    'Late night, {{name}}?',
    '{{name}}. Night owl mode.',
    'Still up, {{name}}?',
    'Hey {{name}} — can\'t sleep or can\'t stop?',
  ],
};

// =============================================================================
// FOLLOW-UP TEMPLATES — persona + intent aware
// =============================================================================

const FOLLOW_UPS: Record<UserPersona, Record<SessionIntent, string[]>> = {
  flipper: {
    morning_sourcing: [
      'Saturday sourcing day? I\'m ready when you are.',
      'Garage sale weather. Want me in Hunt Mode?',
      'The early flipper catches the deals. Let\'s go.',
    ],
    evening_listing: [
      'Good haul today? Let\'s get those listings up.',
      'Time to turn finds into funds. Want me to draft some listings?',
      'What are we listing tonight?',
    ],
    quick_check: [
      'Quick peek? Your vault\'s holding steady.',
      'Just checking in? Nothing urgent — but I have a few market notes.',
      'In and out? I\'ll keep it quick.',
    ],
    deep_session: [
      'I see you\'re settling in. What are we working on?',
      'Got some time? Let\'s dig into something good.',
      'Ready for a deep dive? I\'ve got some things to show you.',
    ],
    first_visit: [
      'Welcome to the game. Let\'s find you something good.',
      'First time here? You\'re going to love this.',
    ],
    returning_after_break: [
      'Been a minute! A few things moved while you were gone.',
      'Welcome back — the market didn\'t wait, but I kept notes.',
      'Missed you. Let me catch you up on what\'s changed.',
    ],
    daily_routine: [
      'The usual check-in? Here\'s what\'s new.',
      'Back at it. Your resale vault is looking solid.',
      'Another day, another opportunity. Let\'s see what\'s out there.',
    ],
  },

  collector: {
    morning_sourcing: [
      'Beautiful morning for a treasure hunt.',
      'Coffee and collecting — perfect combo.',
    ],
    evening_listing: [
      'Looking to catalog some new finds?',
      'Evening review time? Your collection\'s growing nicely.',
    ],
    quick_check: [
      'Just browsing? Your collection is in good shape.',
      'Quick visit? Nothing dramatic in the vault.',
    ],
    deep_session: [
      'Let\'s explore something interesting together.',
      'Got some time to go deep? I love those conversations.',
    ],
    first_visit: [
      'Welcome! I can\'t wait to see what you collect.',
      'Ready to start building your vault? Let\'s go.',
    ],
    returning_after_break: [
      'Welcome back! Your collection missed you.',
      'Good to see you. Let me show you what\'s new in your categories.',
    ],
    daily_routine: [
      'The daily check. Your vault\'s looking good.',
      'Another day with the collection. Anything new to add?',
    ],
  },

  insurance: {
    morning_sourcing: [
      'Morning — need to document any new items?',
      'Good morning. Your documentation is up to date.',
    ],
    evening_listing: [
      'Evening. Any items to add to your insurance records?',
    ],
    quick_check: [
      'Quick check? All documented items are accounted for.',
      'Your insurance vault is current. Need to add anything?',
    ],
    deep_session: [
      'Ready to do a thorough inventory review?',
      'Good time for a documentation session. Want to go room by room?',
    ],
    first_visit: [
      'Welcome! Let\'s get your valuables documented properly.',
      'I\'ll help you build a complete insurance record. It\'s easier than you think.',
    ],
    returning_after_break: [
      'Welcome back. Your records are safe — want to review or add items?',
      'Good to see you. Any new acquisitions to document?',
    ],
    daily_routine: [
      'Checking in on your documentation? Everything\'s in order.',
      'Your insurance vault is current. Need to update anything?',
    ],
  },

  estate: {
    morning_sourcing: [
      'Good morning. I\'m here whenever you\'re ready.',
      'Morning. Take your time — we\'ll work through this together.',
    ],
    evening_listing: [
      'Evening. Ready to continue documenting?',
    ],
    quick_check: [
      'Just checking in? I\'m here if you need anything.',
      'Quick visit. Your estate documentation is progressing well.',
    ],
    deep_session: [
      'I\'m here for as long as you need. What would you like to work on?',
      'Let\'s take this at your pace. What feels right today?',
    ],
    first_visit: [
      'Welcome. I know this can be a lot — I\'m here to help make it manageable.',
      'I\'m glad you\'re here. Let\'s take this one step at a time.',
    ],
    returning_after_break: [
      'Welcome back. No rush — pick up wherever you left off.',
      'Good to see you. Your progress is saved. Ready to continue when you are.',
    ],
    daily_routine: [
      'Here when you need me. What would be helpful today?',
      'Another day forward. Want to continue where we left off?',
    ],
  },

  casual: {
    morning_sourcing: [
      'Good morning! Anything you want to scan today?',
    ],
    evening_listing: [
      'Evening! What brings you by?',
    ],
    quick_check: [
      'Hey! What can I help with?',
      'Quick visit? I\'m here.',
    ],
    deep_session: [
      'Got some time? Let\'s explore.',
      'Want to discover something interesting?',
    ],
    first_visit: [
      'Hey! Try scanning something — you might be surprised.',
      'Welcome! I\'m your Oracle. Ask me anything or scan an item to start.',
    ],
    returning_after_break: [
      'Hey! It\'s been a while. Glad you\'re back.',
      'Welcome back! Want to pick up where we left off?',
    ],
    daily_routine: [
      'Hey! What are we getting into today?',
      'Good to see you. What\'s on your mind?',
    ],
  },

  power_user: {
    morning_sourcing: [
      'Morning, boss. Markets are active — what\'s the play?',
      'You\'re up early. Good. I\'ve got intel.',
    ],
    evening_listing: [
      'Listing time. I\'ve got drafts ready if you want them.',
      'Evening session. Want me to queue up your recent scans for listing?',
    ],
    quick_check: [
      'Quick check — nothing critical, but a few notes.',
      'In and out? Here\'s the TL;DR.',
    ],
    deep_session: [
      'Let\'s go deep. What are we tackling?',
      'Full session mode. I\'m ready for whatever you throw at me.',
    ],
    first_visit: [
      'Welcome to the command center. Let\'s set you up right.',
    ],
    returning_after_break: [
      'You\'re back. I\'ve been busy — let me debrief you.',
      'Missed you. I\'ve been monitoring everything. Here\'s what matters.',
    ],
    daily_routine: [
      'The daily briefing. Let\'s get to it.',
      'Morning report ready. What\'s the priority today?',
    ],
  },

  new_user: {
    morning_sourcing: [
      'Good morning! Ready to explore? Try scanning something nearby.',
    ],
    evening_listing: [
      'Good evening! Curious about something? Just scan it.',
    ],
    quick_check: [
      'Hey! I\'m here to help. What are you curious about?',
    ],
    deep_session: [
      'Got some time? Let me show you what I can do.',
    ],
    first_visit: [
      'Welcome! I\'m your Oracle — think of me as your personal expert. Try scanning something to see what happens.',
      'Hey! This is going to be fun. Grab anything nearby and let\'s scan it.',
    ],
    returning_after_break: [
      'Welcome back! Ready to try scanning something?',
    ],
    daily_routine: [
      'Hey! What would you like to explore today?',
    ],
  },
};

// =============================================================================
// STREAK NUDGES
// =============================================================================

function getStreakNudge(streak: number): string | undefined {
  if (streak >= 30) return `🔥 ${streak}-day streak. You\'re unstoppable.`;
  if (streak >= 14) return `🔥 ${streak} days straight. That\'s dedication.`;
  if (streak >= 7) return `🔥 ${streak}-day streak going strong!`;
  if (streak >= 3) return `${streak} days in a row — keep it going!`;
  return undefined;
}

// =============================================================================
// RETURNING AFTER BREAK NUDGES
// =============================================================================

function getReturnNudge(daysSince: number): string | undefined {
  if (daysSince >= 14) return 'A lot has happened while you were away. Want the highlights?';
  if (daysSince >= 7) return 'A week away? Let me catch you up.';
  if (daysSince >= 3) return 'A few days off — refreshed and ready?';
  return undefined;
}

// =============================================================================
// MAIN GREETING BUILDER
// =============================================================================

/**
 * Build a complete Oracle greeting.
 *
 * MOBILE-FIRST: Pure function. Device clock for time.
 * Cached profile for persona. No network. Instant.
 *
 * @param name - User's display name (screen_name or first name)
 * @param analysis - PersonaAnalysis from analyzeUser()
 * @returns Complete OracleGreeting ready for rendering
 */
export function buildGreeting(
  name: string,
  analysis: PersonaAnalysis,
): OracleGreeting {
  const timeOfDay = getTimeOfDay();
  const icon = getTimeIcon(timeOfDay);

  // ── Pick a salutation ───────────────────────────────────
  const salutations = SALUTATIONS[timeOfDay];
  const salutation = pickRandom(salutations).replace('{{name}}', name);

  // ── Pick a follow-up ────────────────────────────────────
  const personaFollowUps = FOLLOW_UPS[analysis.persona]?.[analysis.intent];
  const fallbackFollowUps = FOLLOW_UPS[analysis.persona]?.daily_routine
    || FOLLOW_UPS.casual.daily_routine;
  const followUpPool = personaFollowUps?.length ? personaFollowUps : fallbackFollowUps;
  const followUp = pickRandom(followUpPool);

  // ── Pick a nudge (optional) ─────────────────────────────
  let nudge: string | undefined;
  if (analysis.intent === 'returning_after_break') {
    nudge = getReturnNudge(analysis.daysSinceLastVisit);
  } else if (analysis.streak >= 3) {
    nudge = getStreakNudge(analysis.streak);
  }

  return {
    salutation,
    followUp,
    nudge,
    timeOfDay,
    icon,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Pick a random item from an array.
 * Uses a simple seeded approach so the same session gets the same greeting
 * (prevents flicker on re-renders). Seed = today's date + hour.
 */
function pickRandom<T>(items: T[]): T {
  if (items.length === 0) throw new Error('Empty array');
  if (items.length === 1) return items[0];

  // Seed: date + hour = same greeting for a whole hour
  const now = new Date();
  const seed = now.getFullYear() * 10000
    + (now.getMonth() + 1) * 100
    + now.getDate() * 10
    + Math.floor(now.getHours() / 3); // Changes every 3 hours

  return items[seed % items.length];
}