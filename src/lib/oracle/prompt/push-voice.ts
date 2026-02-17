// FILE: src/lib/oracle/prompt/push-voice.ts
// Oracle-Voiced Push Notifications — the Oracle speaks first
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 6 — THE ORACLE SPEAKS FIRST
// ═══════════════════════════════════════════════════════════════════════
//
// Current state: Push notifications say "Price alert: Item X dropped 15%"
// New state:     Push notifications say what the Oracle would say.
//
// "That Pyrex 443 you've been stalking? $45. That's a steal."
// "Heads up — someone just listed a mint Charizard for $200 under market."
// "Price dropped on your Mantle card. $740. You said $800 was your ceiling."
// "Quick heads up — Sarah's birthday is Saturday."
//
// Uses gpt-4o-mini — ~$0.001 per push. Cached per alert type for 1 hour.
//
// Pro/Elite: Real-time alerts in Oracle's voice.
// Free:     Daily digest, also Oracle-voiced (batched).
// ═══════════════════════════════════════════════════════════════════════

import type { OracleIdentity } from '../types.js';

// =============================================================================
// TYPES
// =============================================================================

export interface PushAlertData {
  /** Alert type determines the voice template */
  type: 'price_drop' | 'price_spike' | 'watchlist_hit' | 'market_shift'
      | 'date_reminder' | 'milestone' | 'daily_digest' | 'trend_alert';
  /** Item name (if applicable) */
  itemName?: string;
  /** Category (if applicable) */
  category?: string;
  /** Price data (if applicable) */
  price?: {
    current: number;
    previous?: number;
    changePercent?: number;
    userCeiling?: number;
  };
  /** Personal detail (for date reminders) */
  personalDetail?: {
    key: string;
    value: string;
    detail_type: string;
    daysUntil?: number;
  };
  /** For daily digest: summary of alerts */
  digestItems?: Array<{ type: string; summary: string }>;
  /** Raw data for the LLM to work with */
  rawContext?: string;
}

export interface PushResult {
  /** The Oracle-voiced notification text */
  title: string;
  /** Optional body text (for rich notifications) */
  body?: string;
  /** Whether this was generated or fell back to template */
  isVoiced: boolean;
}

// =============================================================================
// VOICE CACHE — prevent duplicate LLM calls for identical alerts
// =============================================================================

const voiceCache = new Map<string, { text: string; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCacheKey(alertType: string, itemName?: string): string {
  return `${alertType}:${itemName || 'general'}`;
}

// =============================================================================
// BUILD ORACLE-VOICED PUSH NOTIFICATION
// =============================================================================

/**
 * Generate an Oracle-voiced push notification.
 * Uses gpt-4o-mini for generation, falls back to templates on failure.
 *
 * @param identity - The user's Oracle identity (personality, name, traits)
 * @param alert    - The alert data to voice
 * @returns Push notification text in Oracle's voice
 */
export async function buildOracleVoicedPush(
  identity: OracleIdentity,
  alert: PushAlertData,
): Promise<PushResult> {
  // Check cache first
  const cacheKey = getCacheKey(alert.type, alert.itemName);
  const cached = voiceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { title: cached.text, isVoiced: true };
  }

  const name = identity.oracle_name || 'Oracle';
  const style = identity.communication_style || 'balanced';
  const traits = (identity.personality_traits || []).slice(0, 3).join(', ') || 'direct, knowledgeable, warm';

  // Build alert context string
  const alertContext = buildAlertContext(alert);

  const prompt = `You are ${name}, an AI partner with these traits: ${traits}.
Style: ${style}.

Write a SINGLE push notification (max 120 characters) for this alert:
${alertContext}

Sound like yourself. Not like a system notification. Like a friend texting.
Examples of YOUR voice (adapt to your personality):
- "That Pyrex 443 you've been stalking? $45. That's a steal."
- "Heads up — someone just listed a mint Charizard for $200 under market."
- "Price dropped on your Mantle card. $740. You said $800 was your ceiling."
- "Quick heads up — Sarah's birthday is Saturday."

NO emojis. NO exclamation marks unless that's genuinely your personality.
Just the message text, nothing else.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Generate the notification.' },
        ],
        max_tokens: 60,
        temperature: 0.8, // Slightly higher for personality variation
      }),
    });

    if (!response.ok) {
      console.error('[PushVoice] API error:', response.status);
      return buildTemplatePush(alert);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content?.trim();

    if (!text || text.length > 180) {
      return buildTemplatePush(alert);
    }

    // Cache it
    voiceCache.set(cacheKey, { text, expiresAt: Date.now() + CACHE_TTL });

    // Clean old cache entries periodically
    if (voiceCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of voiceCache) {
        if (val.expiresAt < now) voiceCache.delete(key);
      }
    }

    return { title: text, isVoiced: true };

  } catch (err) {
    console.error('[PushVoice] Generation failed:', err);
    return buildTemplatePush(alert);
  }
}

// =============================================================================
// BUILD DAILY DIGEST — batched Oracle voice for free tier
// =============================================================================

/**
 * Generate an Oracle-voiced daily digest from multiple alerts.
 * One LLM call for the entire day's alerts.
 * Used for free tier users who don't get real-time push.
 */
export async function buildOracleVoicedDigest(
  identity: OracleIdentity,
  alerts: PushAlertData[],
): Promise<PushResult> {
  if (alerts.length === 0) {
    return { title: 'Nothing big today. Go find something.', isVoiced: false };
  }

  const name = identity.oracle_name || 'Oracle';
  const style = identity.communication_style || 'balanced';
  const traits = (identity.personality_traits || []).slice(0, 3).join(', ') || 'direct, knowledgeable, warm';

  const alertSummaries = alerts.map((a, i) => `${i + 1}. ${buildAlertContext(a)}`).join('\n');

  const prompt = `You are ${name}, an AI partner with these traits: ${traits}.
Style: ${style}.

Write a brief daily digest notification (max 200 characters) summarizing these ${alerts.length} alerts:
${alertSummaries}

Sound like a friend giving a quick update. One or two sentences max.
Example: "Couple things today — that Charizard dropped to $180 and someone listed a Pyrex 443 for $45. Worth a look."

Just the message text, nothing else.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Generate the digest.' },
        ],
        max_tokens: 80,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      return { title: `You have ${alerts.length} updates today. Open to see what's moving.`, isVoiced: false };
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content?.trim();

    return {
      title: text || `${alerts.length} updates today. Check in when you get a sec.`,
      isVoiced: !!text,
    };

  } catch {
    return { title: `${alerts.length} updates today. Check in when you get a sec.`, isVoiced: false };
  }
}

// =============================================================================
// ALERT CONTEXT BUILDER
// =============================================================================

function buildAlertContext(alert: PushAlertData): string {
  switch (alert.type) {
    case 'price_drop':
      return `Price dropped on "${alert.itemName}". ` +
        `Now $${alert.price?.current}` +
        (alert.price?.previous ? ` (was $${alert.price.previous})` : '') +
        (alert.price?.changePercent ? `, down ${Math.abs(alert.price.changePercent)}%` : '') +
        (alert.price?.userCeiling ? `. User's ceiling: $${alert.price.userCeiling}` : '');

    case 'price_spike':
      return `Price spiked on "${alert.itemName}". ` +
        `Now $${alert.price?.current}` +
        (alert.price?.changePercent ? `, up ${alert.price.changePercent}%` : '');

    case 'watchlist_hit':
      return `Watchlist match: "${alert.itemName}" just listed` +
        (alert.price?.current ? ` at $${alert.price.current}` : '');

    case 'market_shift':
      return `Market shift in ${alert.category || 'a tracked category'}. ` +
        (alert.rawContext || 'Prices moving.');

    case 'date_reminder': {
      const d = alert.personalDetail;
      if (!d) return 'An important date is coming up.';
      const daysText = d.daysUntil === 1 ? 'tomorrow' :
        d.daysUntil === 0 ? 'today' : `in ${d.daysUntil} days`;
      return `${d.key.replace(/_/g, ' ')} (${d.value}) is ${daysText}.`;
    }

    case 'milestone':
      return alert.rawContext || 'User hit a milestone.';

    case 'trend_alert':
      return `Trending: ${alert.category || alert.itemName || 'category shift'} — ${alert.rawContext || 'activity spike'}`;

    case 'daily_digest':
      return alert.rawContext || `${alert.digestItems?.length || 0} updates today.`;

    default:
      return alert.rawContext || 'Alert for your tracked items.';
  }
}

// =============================================================================
// TEMPLATE FALLBACKS — when LLM is unavailable
// =============================================================================

function buildTemplatePush(alert: PushAlertData): PushResult {
  let title: string;

  switch (alert.type) {
    case 'price_drop':
      title = alert.price?.current
        ? `${alert.itemName} dropped to $${alert.price.current}`
        : `Price drop on ${alert.itemName}`;
      break;
    case 'price_spike':
      title = `${alert.itemName} is up ${alert.price?.changePercent || ''}%`;
      break;
    case 'watchlist_hit':
      title = `${alert.itemName} just listed` +
        (alert.price?.current ? ` — $${alert.price.current}` : '');
      break;
    case 'date_reminder':
      title = alert.personalDetail
        ? `${alert.personalDetail.key.replace(/_/g, ' ')} is coming up`
        : 'Important date reminder';
      break;
    default:
      title = alert.rawContext || 'You have a new alert';
  }

  return { title, isVoiced: false };
}