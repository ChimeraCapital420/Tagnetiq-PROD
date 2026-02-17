// FILE: src/lib/oracle/memory/personal-details.ts
// Personal Concierge — the Oracle listens and remembers what matters
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 4 — THE PERSONAL CONCIERGE
// ═══════════════════════════════════════════════════════════════════════
//
// A wealthy person's concierge doesn't just know their schedule. They know
// the spouse's name, the kids' birthdays, that they hate cilantro, that
// their anniversary is March 14th, and that they collect first-edition
// Hemingway. The Oracle should be this — not because the user is wealthy,
// but because every person deserves a partner that actually knows them.
//
// The Oracle extracts personal details from conversations AUTOMATICALLY.
// Not by asking "what's your birthday?" — by LISTENING.
//
// Available at ALL tiers. The relationship is real — the capability is gated.
// Free tier: Oracle remembers and references in conversation.
// Pro/Elite: Oracle sends proactive push reminders for upcoming dates.
//
// Runs AFTER conversation persistence, alongside memory compression.
// Uses gpt-4o-mini — ~$0.001 per extraction. Cheap. High impact.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// TYPES
// =============================================================================

export interface PersonalDetail {
  id?: string;
  user_id: string;
  detail_type: PersonalDetailType;
  key: string;
  value: string;
  context?: string;
  confidence: number;
  source: 'conversation' | 'profile' | 'inferred';
  first_mentioned_at?: string;
  last_referenced_at?: string;
  times_referenced: number;
  is_private: boolean;
}

export type PersonalDetailType =
  | 'birthday'
  | 'family_member'
  | 'anniversary'
  | 'preference'
  | 'allergy'
  | 'pet'
  | 'hobby'
  | 'important_date'
  | 'address'
  | 'favorite'
  | 'dislike'
  | 'routine'
  | 'goal'
  | 'milestone'
  | 'location';

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const EXTRACTION_PROMPT = `Analyze this conversation and extract any personal details the user revealed. Only extract what they EXPLICITLY mentioned or strongly implied. Never guess ages from context. Never assume family structures.

Look for:
- Names (spouse, kids, parents, pets, business partners, friends)
- Dates (birthdays, anniversaries, important events)
- Preferences (favorite foods, drinks, colors, brands, stores, restaurants)
- Dislikes (allergies, things they avoid, pet peeves)
- Routines (when they go sourcing, market days, work schedule, gym routine)
- Goals (financial targets, collection goals, business milestones)
- Locations (home city, state, favorite sourcing spots, vacation spots, stores they frequent)
- Milestones (biggest sale, first rare find, business founding date, personal achievements)
- Pets (names, types, breeds)
- Hobbies (beyond collecting — sports they play, games, activities)

Return ONLY a JSON array. Empty array [] if nothing personal was revealed.
Each item must have ALL of these fields:
[{
  "key": "spouse_name",
  "value": "Sarah",
  "detail_type": "family_member",
  "confidence": 1.0,
  "context": "User said 'my wife Sarah loves when I bring home vintage Pyrex'"
}]

CONFIDENCE LEVELS:
- 1.0 = Explicitly stated ("My birthday is March 14th")
- 0.8 = Strongly implied ("Sarah and I just celebrated 10 years" → anniversary)
- 0.6 = Reasonably inferred ("picking the kids up from school" → has children)
- Do NOT extract anything below 0.6 confidence

KEY NAMING RULES:
- Use snake_case: "spouse_name", "child_name_1", "birthday", "favorite_food"
- For multiple children: "child_name_1", "child_name_2"
- For dates: include the date format when possible ("birthday": "1985-03-14" or "birthday_month": "March")
- Be specific: "favorite_sourcing_store" not just "favorite"

DETAIL TYPES: birthday, family_member, anniversary, preference, allergy, pet, hobby, important_date, address, favorite, dislike, routine, goal, milestone, location`;

// =============================================================================
// EXTRACT PERSONAL DETAILS FROM CONVERSATION
// =============================================================================

/**
 * Extract personal details from a conversation transcript.
 * Runs as a background task after conversation persistence.
 * Uses gpt-4o-mini — ~$0.001 per call.
 */
export async function extractPersonalDetails(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<PersonalDetail[]> {
  // Need meaningful user messages to extract from
  const userMessages = messages.filter(m =>
    m.role === 'user' && m.content.trim().length > 10
  );
  if (userMessages.length < 2) return [];

  // Build transcript (user messages only — we're extracting THEIR details)
  const transcript = messages
    .filter(m => m.role !== 'system')
    .slice(-30) // Last 30 messages max
    .map(m => `${m.role === 'user' ? 'USER' : 'ORACLE'}: ${m.content.substring(0, 400)}`)
    .join('\n');

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
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: `CONVERSATION:\n${transcript}` },
        ],
        max_tokens: 600,
        temperature: 0.2, // Low temp for accurate extraction
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[Concierge] Extraction API error:', response.status);
      return [];
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return [];

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error('[Concierge] Failed to parse extraction JSON');
      return [];
    }

    // Handle both array and object-with-array responses
    const details: any[] = Array.isArray(parsed)
      ? parsed
      : (parsed.details || parsed.personal_details || []);

    if (!Array.isArray(details) || details.length === 0) return [];

    // Validate and store each detail
    const stored: PersonalDetail[] = [];

    for (const detail of details) {
      if (!detail.key || !detail.value || !detail.detail_type) continue;
      if ((detail.confidence || 0) < 0.6) continue;

      const personalDetail: PersonalDetail = {
        user_id: userId,
        detail_type: detail.detail_type,
        key: String(detail.key).substring(0, 100),
        value: String(detail.value).substring(0, 500),
        context: detail.context ? String(detail.context).substring(0, 500) : undefined,
        confidence: Math.min(1.0, Math.max(0, detail.confidence || 0.8)),
        source: 'conversation',
        times_referenced: 0,
        is_private: true,
      };

      // Upsert — update if key already exists for this user
      const { error } = await supabaseAdmin
        .from('oracle_personal_details')
        .upsert(
          {
            user_id: personalDetail.user_id,
            key: personalDetail.key,
            detail_type: personalDetail.detail_type,
            value: personalDetail.value,
            context: personalDetail.context,
            confidence: personalDetail.confidence,
            source: personalDetail.source,
            last_referenced_at: new Date().toISOString(),
            is_private: true,
          },
          { onConflict: 'user_id,key' }
        );

      if (error) {
        console.error(`[Concierge] Storage error for key "${personalDetail.key}":`, error.message);
        continue;
      }

      stored.push(personalDetail);
    }

    if (stored.length > 0) {
      console.log(`[Concierge] Extracted ${stored.length} personal details for user ${userId.substring(0, 8)}...`);
    }

    return stored;

  } catch (err) {
    console.error('[Concierge] Extraction failed:', err);
    return [];
  }
}

// =============================================================================
// RETRIEVE PERSONAL DETAILS
// =============================================================================

/**
 * Get all personal details for a user.
 * Ordered by confidence (highest first) then recency.
 * Returns max 30 details — enough for a rich concierge block
 * without bloating the system prompt.
 */
export async function getPersonalDetails(
  userId: string,
  limit = 30,
): Promise<PersonalDetail[]> {
  const { data, error } = await supabaseAdmin
    .from('oracle_personal_details')
    .select('*')
    .eq('user_id', userId)
    .order('confidence', { ascending: false })
    .order('last_referenced_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Concierge] Retrieval error:', error.message);
    return [];
  }

  return (data || []) as PersonalDetail[];
}

// =============================================================================
// CONCIERGE PROMPT BLOCK BUILDER
// =============================================================================

/**
 * Build the "PERSONAL KNOWLEDGE" system prompt section.
 * Groups details by type, flags upcoming dates.
 * Available at ALL tiers — this is what makes the Oracle feel like a partner.
 */
export function buildConciergeBlock(details: PersonalDetail[]): string {
  if (!details || details.length === 0) return '';

  const sections: string[] = [];

  sections.push('\n═══════════════════════════════════════════════════════');
  sections.push('PERSONAL KNOWLEDGE — YOUR CONCIERGE MEMORY');
  sections.push('═══════════════════════════════════════════════════════');
  sections.push('You know these things about this person. Reference them NATURALLY.');
  sections.push('Never say "according to my records" — say it like a friend would.');
  sections.push('Don\'t force personal references. Only mention when relevant to the conversation.');
  sections.push('');

  // Group by type
  const family = details.filter(d => d.detail_type === 'family_member');
  const pets = details.filter(d => d.detail_type === 'pet');
  const dates = details.filter(d =>
    ['birthday', 'anniversary', 'important_date'].includes(d.detail_type)
  );
  const prefs = details.filter(d =>
    ['preference', 'favorite', 'dislike', 'allergy'].includes(d.detail_type)
  );
  const locations = details.filter(d =>
    ['location', 'address'].includes(d.detail_type)
  );
  const routines = details.filter(d => d.detail_type === 'routine');
  const goals = details.filter(d => d.detail_type === 'goal');
  const milestones = details.filter(d => d.detail_type === 'milestone');
  const hobbies = details.filter(d => d.detail_type === 'hobby');

  if (family.length) {
    sections.push('PEOPLE IN THEIR LIFE:');
    family.forEach(f => sections.push(`  - ${formatKey(f.key)}: ${f.value}`));
    sections.push('');
  }

  if (pets.length) {
    sections.push('PETS:');
    pets.forEach(p => sections.push(`  - ${formatKey(p.key)}: ${p.value}`));
    sections.push('');
  }

  if (dates.length) {
    sections.push('IMPORTANT DATES:');
    dates.forEach(d => {
      const upcoming = isDateUpcoming(d.value, 14);
      const soon = isDateUpcoming(d.value, 3);
      const suffix = soon ? ' ⚡ THIS WEEK!' : upcoming ? ' ⚡ COMING UP SOON' : '';
      sections.push(`  - ${formatKey(d.key)}: ${d.value}${suffix}`);
    });
    sections.push('');
  }

  if (prefs.length) {
    sections.push('PREFERENCES & TASTES:');
    prefs.forEach(p => sections.push(`  - ${formatKey(p.key)}: ${p.value}`));
    sections.push('');
  }

  if (locations.length) {
    sections.push('LOCATIONS:');
    locations.forEach(l => sections.push(`  - ${formatKey(l.key)}: ${l.value}`));
    sections.push('');
  }

  if (routines.length) {
    sections.push('ROUTINES:');
    routines.forEach(r => sections.push(`  - ${formatKey(r.key)}: ${r.value}`));
    sections.push('');
  }

  if (hobbies.length) {
    sections.push('HOBBIES & INTERESTS:');
    hobbies.forEach(h => sections.push(`  - ${formatKey(h.key)}: ${h.value}`));
    sections.push('');
  }

  if (goals.length) {
    sections.push('THEIR GOALS:');
    goals.forEach(g => sections.push(`  - ${g.value}`));
    sections.push('');
  }

  if (milestones.length) {
    sections.push('MILESTONES YOU\'VE SHARED:');
    milestones.forEach(m => {
      const ctx = m.context ? ` (${m.context})` : '';
      sections.push(`  - ${m.value}${ctx}`);
    });
    sections.push('');
  }

  // Date awareness
  sections.push('DATE AWARENESS:');
  const today = new Date();
  sections.push(`Today is ${today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })}.`);

  if (dates.some(d => isDateUpcoming(d.value, 7))) {
    sections.push('An important date is coming up within 7 days.');
    sections.push('Naturally mention it when appropriate — "Oh hey, isn\'t Sarah\'s birthday this Saturday?"');
    sections.push('But ONLY if it fits the conversation. Don\'t force it.');
  }

  return sections.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format a snake_case key into a readable label.
 * "spouse_name" → "Spouse name", "child_name_1" → "Child name 1"
 */
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Check if a date string represents a date coming up within N days.
 * Handles "YYYY-MM-DD", "March 14", "03/14", month names, etc.
 * Only checks month+day (ignores year — birthdays repeat).
 */
function isDateUpcoming(dateStr: string, withinDays: number): boolean {
  if (!dateStr) return false;

  const now = new Date();
  const currentYear = now.getFullYear();

  // Try to parse various date formats
  let month: number | null = null;
  let day: number | null = null;

  // "YYYY-MM-DD" or "MM-DD" or "MM/DD"
  const numericMatch = dateStr.match(/(?:\d{4}[-/])?(\d{1,2})[-/](\d{1,2})/);
  if (numericMatch) {
    month = parseInt(numericMatch[1], 10) - 1; // 0-indexed
    day = parseInt(numericMatch[2], 10);
  }

  // "March 14" or "March 14th" or "14 March"
  if (month === null) {
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const lower = dateStr.toLowerCase();
    for (const [name, idx] of Object.entries(months)) {
      if (lower.includes(name)) {
        month = idx;
        const dayMatch = lower.match(/(\d{1,2})/);
        if (dayMatch) day = parseInt(dayMatch[1], 10);
        break;
      }
    }
  }

  if (month === null || day === null) return false;

  // Build this year's occurrence of the date
  const thisYearDate = new Date(currentYear, month, day);

  // If already passed this year, check next year
  if (thisYearDate < now) {
    thisYearDate.setFullYear(currentYear + 1);
  }

  const daysUntil = Math.floor((thisYearDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntil >= 0 && daysUntil <= withinDays;
}

/**
 * Get the number of days until a date (for push notification scheduling).
 * Returns -1 if date can't be parsed.
 */
export function getDaysUntilDate(dateStr: string): number {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Simple YYYY-MM-DD or MM-DD parse
  const match = dateStr.match(/(?:\d{4}[-/])?(\d{1,2})[-/](\d{1,2})/);
  if (!match) return -1;

  const month = parseInt(match[1], 10) - 1;
  const day = parseInt(match[2], 10);

  const thisYearDate = new Date(currentYear, month, day);
  if (thisYearDate < now) {
    thisYearDate.setFullYear(currentYear + 1);
  }

  return Math.floor((thisYearDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}