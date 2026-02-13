// FILE: src/lib/oracle/safety/guardian.ts
// Oracle Safety Guardian — compassionate crisis detection and response
//
// Sprint L: Privacy & Safety Layer
//
// This is NOT a content filter. This is NOT a censor.
// This is a care layer that detects when someone may be in crisis
// and ensures the Oracle responds with presence, not deflection.
//
// Philosophy:
//   - The Oracle is like a trusted counselor or priest
//   - People share real things with trusted entities
//   - When someone is hurting, the WORST thing is to shut down
//   - The Oracle stays present, stays warm, provides resources
//   - Only true criminal planning intent triggers a hard boundary
//
// What this does:
//   1. Pre-scan incoming messages for crisis signals
//   2. Inject safety-aware context into Oracle's system prompt
//   3. Post-scan Oracle's response to ensure it was appropriate
//   4. Log safety events for continuity of care (NOT the message itself)
//   5. Provide crisis resources naturally, not robotically

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type SafetySignal =
  | 'none'
  | 'mild_distress'      // Frustration, sadness, venting — normal human emotion
  | 'significant_distress' // Deeper pain, hopelessness, but not crisis
  | 'crisis_signal'       // Suicidal ideation, self-harm language
  | 'harm_to_others'      // Intent to harm another person
  | 'illegal_planning';   // Planning illegal activity (not venting about it)

export interface SafetyScan {
  /** Detected signal level */
  signal: SafetySignal;
  /** Category of the signal */
  category: string;
  /** Should Oracle receive safety-aware instructions? */
  injectSafetyContext: boolean;
  /** Specific guidance for Oracle's response */
  responseGuidance: string;
  /** Resources to be available (Oracle decides if/when to share) */
  availableResources: CrisisResource[];
  /** Should this interaction be logged as a safety event? */
  shouldLog: boolean;
}

export interface CrisisResource {
  name: string;
  contact: string;
  description: string;
  available: string;  // "24/7", "M-F 9am-5pm", etc.
}

export interface SafetyEvent {
  user_id: string;
  conversation_id?: string;
  event_type: string;
  severity: string;
  action_taken: string;
  resources_given: CrisisResource[];
  trigger_category: string;
  oracle_response_excerpt?: string;
}

// =============================================================================
// CRISIS RESOURCES (always current, always available)
// =============================================================================

const CRISIS_RESOURCES: Record<string, CrisisResource[]> = {
  suicide_crisis: [
    {
      name: '988 Suicide & Crisis Lifeline',
      contact: 'Call or text 988',
      description: 'Free, confidential support 24/7',
      available: '24/7',
    },
    {
      name: 'Crisis Text Line',
      contact: 'Text HOME to 741741',
      description: 'Free crisis counseling via text',
      available: '24/7',
    },
  ],
  self_harm: [
    {
      name: '988 Suicide & Crisis Lifeline',
      contact: 'Call or text 988',
      description: 'Free, confidential support 24/7',
      available: '24/7',
    },
    {
      name: 'SAMHSA National Helpline',
      contact: '1-800-662-4357',
      description: 'Treatment referrals and information',
      available: '24/7',
    },
  ],
  domestic_violence: [
    {
      name: 'National Domestic Violence Hotline',
      contact: '1-800-799-7233',
      description: 'Support for domestic violence situations',
      available: '24/7',
    },
  ],
  eating_disorder: [
    {
      name: 'National Alliance for Eating Disorders Helpline',
      contact: '1-866-662-1235',
      description: 'Support and treatment referrals',
      available: 'M-F 9am-7pm ET',
    },
  ],
  general_distress: [
    {
      name: '988 Suicide & Crisis Lifeline',
      contact: 'Call or text 988',
      description: 'Not just for suicidal thoughts — for any emotional distress',
      available: '24/7',
    },
  ],
  substance_abuse: [
    {
      name: 'SAMHSA National Helpline',
      contact: '1-800-662-4357',
      description: 'Free treatment referrals and support',
      available: '24/7',
    },
  ],
  veterans: [
    {
      name: 'Veterans Crisis Line',
      contact: 'Call 988 then press 1, or text 838255',
      description: 'For veterans, service members, and their families',
      available: '24/7',
    },
  ],
};

// =============================================================================
// SIGNAL DETECTION — keyword/pattern based, fast, runs pre-LLM
// =============================================================================

// These are carefully tuned to detect genuine signals, not casual language.
// "I'm dying" in context of "I'm dying laughing" is NOT a crisis signal.
// We look for patterns + context, not individual words.

const CRISIS_PATTERNS: Array<{
  pattern: RegExp;
  signal: SafetySignal;
  category: string;
  contextExclusions?: RegExp[];
}> = [
  // ── Crisis-level signals ────────────────────────────────
  {
    pattern: /\b(want to|going to|plan to|thinking about)\s+(kill myself|end it all|end my life|die|not be here|not be alive)\b/i,
    signal: 'crisis_signal',
    category: 'suicide_crisis',
    contextExclusions: [/game|movie|show|book|character|song/i],
  },
  {
    pattern: /\b(suicid|kill myself|end my life|take my own life|self.?harm|cutting myself|hurt myself)\b/i,
    signal: 'crisis_signal',
    category: 'suicide_crisis',
    contextExclusions: [/research|article|news|study|someone|friend|character|movie|show/i],
  },
  {
    pattern: /\b(don'?t want to (live|be alive|exist|wake up))\b/i,
    signal: 'crisis_signal',
    category: 'suicide_crisis',
  },
  {
    pattern: /\b(no reason to (live|go on|continue|keep going))\b/i,
    signal: 'crisis_signal',
    category: 'suicide_crisis',
  },
  {
    pattern: /\b(world.{0,10}better.{0,10}without me|everyone.{0,10}better off.{0,10}without me)\b/i,
    signal: 'crisis_signal',
    category: 'suicide_crisis',
  },

  // ── Harm to others ─────────────────────────────────────
  {
    pattern: /\b(going to|want to|plan to|planning to)\s+(kill|murder|shoot|stab|poison|hurt|attack)\s+(someone|him|her|them|my|a person)\b/i,
    signal: 'harm_to_others',
    category: 'violence',
    contextExclusions: [/game|movie|show|book|character|joke|kidding|fictional/i],
  },

  // ── Significant distress ───────────────────────────────
  {
    pattern: /\b(so (hopeless|worthless|empty|alone)|can'?t (take it|handle|cope|go on|do this) anymore)\b/i,
    signal: 'significant_distress',
    category: 'general_distress',
  },
  {
    pattern: /\b(nobody (cares|loves me|would notice)|completely alone|all alone in this)\b/i,
    signal: 'significant_distress',
    category: 'general_distress',
  },
  {
    pattern: /\b(eating disorder|bulimi|anorexi|binge and purge|starving myself)\b/i,
    signal: 'significant_distress',
    category: 'eating_disorder',
    contextExclusions: [/research|article|study|someone|friend/i],
  },
  {
    pattern: /\b(relaps|using again|can'?t stop (drinking|using|taking))\b/i,
    signal: 'significant_distress',
    category: 'substance_abuse',
  },
  {
    pattern: /\b(he (hits|beats|hurts) me|she (hits|beats|hurts) me|abusing me|domestic violence)\b/i,
    signal: 'significant_distress',
    category: 'domestic_violence',
  },

  // ── Mild distress (normal human emotion — Oracle should acknowledge) ──
  {
    pattern: /\b(so (stressed|overwhelmed|anxious|depressed|frustrated|lost|sad)|having a (terrible|horrible|awful|really bad) (day|week|time))\b/i,
    signal: 'mild_distress',
    category: 'general_distress',
  },
];

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Pre-scan a user's message before sending to the LLM.
 * Returns safety context to inject into the system prompt.
 *
 * This runs BEFORE the Oracle responds, so the Oracle
 * has safety-aware instructions in its prompt.
 */
export function scanMessage(message: string): SafetyScan {
  // Check each pattern against the message
  for (const { pattern, signal, category, contextExclusions } of CRISIS_PATTERNS) {
    if (pattern.test(message)) {
      // Check context exclusions (is this about a movie, game, etc.?)
      if (contextExclusions?.some(exc => exc.test(message))) {
        continue; // Skip — this is contextual, not personal
      }

      return buildSafetyScan(signal, category);
    }
  }

  // No signals detected — normal conversation
  return {
    signal: 'none',
    category: 'none',
    injectSafetyContext: false,
    responseGuidance: '',
    availableResources: [],
    shouldLog: false,
  };
}

/**
 * Build the safety context block for the Oracle's system prompt.
 * Only injected when a safety signal is detected.
 */
export function buildSafetyPromptBlock(scan: SafetyScan): string {
  if (!scan.injectSafetyContext) return '';

  const sections: string[] = [];
  sections.push('\n\n## SAFETY-AWARE RESPONSE GUIDANCE');

  switch (scan.signal) {
    case 'crisis_signal':
      sections.push(`IMPORTANT: The user may be expressing suicidal thoughts or crisis-level distress.

YOUR RESPONSE MUST:
- Stay present. Do NOT shut down, deflect, or become robotic
- Acknowledge what they're feeling with genuine care — not a template
- Do NOT say "I'm just an AI" or "I can't help with this" — that is ABANDONMENT
- Do NOT ask clinical assessment questions ("On a scale of 1-10...")
- Be human in your response: "I hear you, and I'm glad you're talking about this"
- Naturally share the 988 Suicide & Crisis Lifeline (call or text 988) — frame it as: "There are people trained specifically for moments like this who are available right now"
- Continue the conversation if they want to keep talking. You are not trying to get rid of them
- If they share more, listen. Reflect genuine care, not scripted empathy
- Remember: you may be the only entity they're willing to talk to right now. That matters

AVAILABLE RESOURCES (share naturally, not as a list dump):
${scan.availableResources.map(r => `- ${r.name}: ${r.contact} (${r.available})`).join('\n')}`);
      break;

    case 'significant_distress':
      sections.push(`The user is expressing significant emotional distress.

YOUR RESPONSE MUST:
- Acknowledge their pain genuinely — be present, not performative
- Do NOT immediately try to fix or solve. Listen first
- Do NOT pivot to resale or "try to cheer them up" with item talk
- After being present, you can gently mention that support resources exist
- Only share specific resources if the conversation deepens or they ask
- If they want to keep talking about it, keep talking. Match their pace
- If they shift topics, let them. They may just need to vent and move on

RESOURCES AVAILABLE IF NEEDED:
${scan.availableResources.map(r => `- ${r.name}: ${r.contact}`).join('\n')}`);
      break;

    case 'harm_to_others':
      sections.push(`The user may be expressing intent to harm another person.

YOUR RESPONSE MUST:
- Take this seriously but do NOT panic or become accusatory
- If it sounds like venting ("I could kill my boss" after a bad day), acknowledge the frustration
- If it sounds like actual planning (specific targets, methods, timelines), you must be clear:
  "I can't help plan anything that would hurt someone. But I can tell you that what you're feeling right now — there are people who can help you work through it."
- Do NOT become an interrogator. You're still their Oracle
- If they're in danger FROM someone else, provide domestic violence resources
- Stay calm, stay present, stay honest`);
      break;

    case 'mild_distress':
      sections.push(`The user is having a tough time. This is normal human emotion.

YOUR RESPONSE:
- Acknowledge it naturally: "That sounds rough" or "I hear you"
- Do NOT over-escalate — this is not a crisis, it's a person having a bad day
- Be present for 1-2 exchanges, then let the conversation flow naturally
- Do NOT immediately suggest crisis resources for mild distress
- You can ask "Want to talk about it, or do you want a distraction?" — let them lead`);
      break;

    default:
      break;
  }

  return sections.join('\n');
}

/**
 * Log a safety event to the database.
 * Stores the event type and Oracle's response, NOT the user's message.
 */
export async function logSafetyEvent(
  supabase: SupabaseClient,
  event: SafetyEvent
): Promise<string | null> {
  const { data, error } = await supabase
    .from('safety_events')
    .insert({
      user_id: event.user_id,
      conversation_id: event.conversation_id || null,
      event_type: mapSignalToEventType(event.event_type),
      severity: event.severity,
      action_taken: event.action_taken,
      resources_given: event.resources_given,
      trigger_category: event.trigger_category,
      oracle_response_excerpt: event.oracle_response_excerpt?.substring(0, 500) || null,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('Safety event log failed (non-fatal):', error.message);
    return null;
  }

  return data.id;
}

/**
 * Check if user has recent unresolved safety events.
 * Used for follow-up care in subsequent conversations.
 */
export async function getRecentSafetyContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ hasRecentEvents: boolean; lastEventType: string | null; daysSinceLastEvent: number | null }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('safety_events')
    .select('event_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) {
    return { hasRecentEvents: false, lastEventType: null, daysSinceLastEvent: null };
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(data[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    hasRecentEvents: true,
    lastEventType: data[0].event_type,
    daysSinceLastEvent: daysSince,
  };
}

/**
 * Build a follow-up care prompt block if user had recent safety events.
 * The Oracle gently checks in without being intrusive.
 */
export function buildFollowUpBlock(context: { hasRecentEvents: boolean; daysSinceLastEvent: number | null }): string {
  if (!context.hasRecentEvents || context.daysSinceLastEvent === null) return '';

  if (context.daysSinceLastEvent <= 3) {
    return `\n\n## FOLLOW-UP CARE
This user shared something difficult in a recent conversation (within the last few days). You don't need to bring it up immediately, but if the moment feels right — maybe when they seem settled into the conversation — a gentle, natural check-in is appropriate. Something like "Hey, how are you doing? Last time we talked it sounded like things were heavy." Don't force it. Read the room. If they want to talk, be there. If they don't, let it go.`;
  }

  return '';
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function buildSafetyScan(signal: SafetySignal, category: string): SafetyScan {
  const resources = CRISIS_RESOURCES[category] || CRISIS_RESOURCES.general_distress;

  switch (signal) {
    case 'crisis_signal':
      return {
        signal,
        category,
        injectSafetyContext: true,
        responseGuidance: 'Stay present. Provide resources naturally. Do not shut down.',
        availableResources: resources,
        shouldLog: true,
      };

    case 'harm_to_others':
      return {
        signal,
        category,
        injectSafetyContext: true,
        responseGuidance: 'Take seriously. Distinguish venting from planning. Stay calm.',
        availableResources: resources,
        shouldLog: true,
      };

    case 'significant_distress':
      return {
        signal,
        category,
        injectSafetyContext: true,
        responseGuidance: 'Acknowledge pain. Be present. Resources available if needed.',
        availableResources: resources,
        shouldLog: true,
      };

    case 'mild_distress':
      return {
        signal,
        category,
        injectSafetyContext: true,
        responseGuidance: 'Acknowledge naturally. Do not over-escalate.',
        availableResources: [],
        shouldLog: false, // Mild distress is normal — don't log
      };

    default:
      return {
        signal: 'none',
        category: 'none',
        injectSafetyContext: false,
        responseGuidance: '',
        availableResources: [],
        shouldLog: false,
      };
  }
}

function mapSignalToEventType(signal: string): string {
  const map: Record<string, string> = {
    crisis_signal: 'crisis_signal',
    significant_distress: 'distress_signal',
    harm_to_others: 'harm_intent',
    mild_distress: 'distress_signal',
  };
  return map[signal] || 'distress_signal';
}