// FILE: src/lib/boardroom/memory/meeting-memory.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD MEETING MEMORY — Shared Institutional Memory
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 3: Board Meeting Memory
//
// After a full board meeting (@all), 15 members respond in parallel.
// This module compresses ALL responses into a single meeting summary
// that gets injected into every future conversation (Layer 9).
//
// When you talk to Griffin 1:1 next week, he remembers what Athena
// said in last Tuesday's board meeting. Not because Griffin saw
// Athena's response — but because the MEETING was compressed into
// shared institutional memory that all members access.
//
// ARCHITECTURE:
//   compressBoardMeeting() — called by background-tasks.ts after @all
//     → Sends all member responses to gpt-4o-mini for synthesis
//     → Extracts: topics, positions, decisions, disagreements, action items
//     → Writes to boardroom_meeting_summaries table
//
//   getRecentMeetingSummaries() — called by prompt-builder.ts Layer 9
//     → Returns last N meeting summaries for a user
//     → Formatted for natural injection into system prompts
//
// Pipeline:
//   @all meeting completes → runMeetingCompressionTask (background-tasks.ts)
//     → compressBoardMeeting (this file) → AI summarization → DB insert
//   Next 1:1 chat → getRecentMeetingSummaries (this file) → prompt Layer 9
//
// FOLLOWS: founder-memory.ts pattern
//   → Direct OpenAI fetch (bypasses gateway — cheap background work)
//   → getOpenAIKey() multi-variant lookup
//   → JSON extraction with regex fallback
//   → Non-blocking, fire-and-forget safe
//
// COST: ~$0.002 per meeting compression (gpt-4o-mini, ~2K input tokens)
// The value of institutional memory compounds over decades.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single member's response from a board meeting.
 * Compatible with MemberResponse from chat/types.ts.
 */
export interface MeetingResponse {
  member: string;       // slug
  name: string;         // display name
  title: string;        // e.g. "Chief Strategy Officer"
  response: string;     // the member's full text response
  error?: boolean;      // true if member failed to respond
}

/**
 * Compressed meeting summary stored in DB and injected into prompts.
 * This is what prompt-builder.ts Layer 9 (formatMeetingSummaries) reads.
 */
export interface MeetingSummary {
  id: string;
  meeting_id: string | null;
  user_message: string | null;
  summary: string;
  key_topics: string[];
  member_positions: Record<string, string>;
  decisions_made: Array<{
    decision: string;
    confidence: string;
    supporters: string[];
  }>;
  disagreements: Array<{
    topic: string;
    sides: Record<string, string>;
    resolution: string | null;
  }>;
  action_items: Array<{
    action: string;
    owner: string | null;
    deadline: string | null;
  }>;
  member_count: number;
  members_present: string[];
  compressed_at: string;
}

/**
 * Raw AI output from the compression prompt.
 * Parsed from JSON, then mapped to DB columns.
 * Internal type — not exported.
 */
interface CompressionResult {
  summary: string;
  key_topics: string[];
  member_positions: Record<string, string>;
  decisions_made: Array<{
    decision: string;
    confidence: string;
    supporters?: string[];
  }>;
  disagreements: Array<{
    topic: string;
    sides: Record<string, string>;
    resolution: string | null;
  }>;
  action_items: Array<{
    action: string;
    owner: string | null;
    deadline: string | null;
  }>;
}

// =============================================================================
// API KEY RESOLUTION
// =============================================================================
// Same pattern as founder-memory.ts — check both env var naming conventions.
// We call OpenAI directly for cheap compression (bypassing the gateway).

function getOpenAIKey(): string | null {
  const candidates = ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'];
  for (const envKey of candidates) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

// =============================================================================
// COMPRESS BOARD MEETING (write path)
// =============================================================================

/**
 * Compress a full board meeting into shared institutional memory.
 *
 * Called by runMeetingCompressionTask() in background-tasks.ts
 * after all members respond to an @all meeting. Fire-and-forget.
 *
 * The AI reads every member's response and extracts:
 *   - Narrative summary (what happened)
 *   - Per-member positions (who said what)
 *   - Decisions reached (with confidence + supporters)
 *   - Action items (with owners)
 *   - Disagreements (with sides and resolution status)
 *
 * Includes idempotency check — if meetingId already compressed, skips.
 *
 * @param supabase - Admin client
 * @param userId - Founder's user ID
 * @param meetingId - Optional FK to boardroom_meetings
 * @param userMessage - The CEO's original @all message
 * @param responses - All member responses from the parallel call
 */
export async function compressBoardMeeting(
  supabase: SupabaseClient,
  userId: string,
  meetingId: string | undefined,
  userMessage: string,
  responses: MeetingResponse[],
): Promise<void> {
  // Filter to successful responses only (skip errors + stub responses)
  const successful = responses.filter(r => !r.error && r.response && r.response.length > 20);
  if (successful.length < 2) {
    console.warn('[MeetingMemory] Fewer than 2 successful responses — skipping compression');
    return;
  }

  // ── Idempotency: don't compress the same meeting twice ──
  if (meetingId) {
    const { data: existing } = await supabase
      .from('boardroom_meeting_summaries')
      .select('id')
      .eq('meeting_id', meetingId)
      .single();

    if (existing) {
      console.log(`[MeetingMemory] Meeting ${meetingId} already compressed — skipping`);
      return;
    }
  }

  const openaiKey = getOpenAIKey();
  if (!openaiKey) {
    console.warn('[MeetingMemory] No OpenAI API key found. Skipping meeting compression.');
    return;
  }

  // ── Build transcript for AI ───────────────────────────
  // Dynamic cap per member: scales with participant count to stay
  // within token budget. 15 members × 600 chars ≈ 9K chars ≈ 2.25K tokens.
  const maxPerMember = Math.min(600, Math.floor(12000 / successful.length));
  const transcript = successful
    .map(r => {
      const text = r.response.length > maxPerMember
        ? r.response.substring(0, maxPerMember) + '...'
        : r.response;
      return `[${r.name} (${r.title})]:\n${text}`;
    })
    .join('\n\n---\n\n');

  const ceoQuestion = userMessage.length > 500
    ? userMessage.substring(0, 500) + '...'
    : userMessage;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You synthesize board meeting discussions into structured institutional memory.

A CEO asked their AI Board of Directors a question. Multiple board members responded.
Your job is to compress this into institutional memory that will persist across conversations.

CRITICAL: Be specific. Use member names. Capture disagreements — they're valuable.
Future conversations will reference this summary, so precision matters.

Return ONLY valid JSON:
{
  "summary": "3-5 sentence executive summary of the meeting. Include the CEO's question, overall direction of the board's response, what was decided, and what remains unresolved.",
  "key_topics": ["topic1", "topic2", "topic3"],
  "member_positions": {
    "member_slug": "1-2 sentence summary of their key position/recommendation"
  },
  "decisions_made": [
    {
      "decision": "What was decided or recommended",
      "confidence": "strong_consensus | majority | split | no_consensus",
      "supporters": ["slug1", "slug2"]
    }
  ],
  "disagreements": [
    {
      "topic": "What they disagreed on",
      "sides": { "slug1": "Their position", "slug2": "Their position" },
      "resolution": "How it was resolved, or null if unresolved"
    }
  ],
  "action_items": [
    {
      "action": "What needs to happen next",
      "owner": "member_slug or null",
      "deadline": "timeframe if mentioned, or null"
    }
  ]
}

Rules:
- member_positions: Use the member's slug (lowercase, e.g. "athena", "griffin") as the key
- Include ALL members who contributed meaningfully (skip generic/empty responses)
- decisions_made: Only include items where 3+ members aligned on a recommendation
- disagreements: Only include real disagreements, not just different emphasis
- action_items: Extract concrete next steps. Assign owner if a specific member volunteered
- Use member slugs (lowercase, no spaces) in all references
- If no decisions/disagreements/actions, return empty arrays — don't fabricate
- Be concise. This summary will be injected into future prompts.`,
          },
          {
            role: 'user',
            content: `CEO'S QUESTION:\n${ceoQuestion}\n\nBOARD RESPONSES:\n${transcript}`,
          },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn('[MeetingMemory] OpenAI API error:', response.status);
      return;
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) {
      console.warn('[MeetingMemory] Empty response from OpenAI');
      return;
    }

    // ── Parse JSON (with regex fallback for markdown-wrapped) ──
    let parsed: CompressionResult;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.warn('[MeetingMemory] Failed to parse AI synthesis — raw:', raw.substring(0, 200));
      return;
    }

    // ── Validate required fields ──────────────────────────
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      console.warn('[MeetingMemory] Missing summary in parsed response');
      return;
    }

    // ── Sanitize all fields ───────────────────────────────
    const membersPresent = successful.map(r => r.member);

    const summary = String(parsed.summary).substring(0, 2000);
    const keyTopics = (parsed.key_topics || [])
      .slice(0, 10)
      .map(t => String(t).substring(0, 100));

    const memberPositions = sanitizePositions(parsed.member_positions, membersPresent);

    const decisionsMade = (parsed.decisions_made || []).slice(0, 10).map(d => ({
      decision: String(d.decision || '').substring(0, 300),
      confidence: ['strong_consensus', 'majority', 'split', 'no_consensus']
        .includes(d.confidence) ? d.confidence : 'no_consensus',
      supporters: (d.supporters || [])
        .filter((s: string) => membersPresent.includes(s))
        .slice(0, 15),
    }));

    const disagreements = (parsed.disagreements || []).slice(0, 10).map(d => {
      const sides: Record<string, string> = {};
      for (const [slug, pos] of Object.entries(d.sides || {})) {
        if (membersPresent.includes(slug)) {
          sides[slug] = String(pos).substring(0, 200);
        }
      }
      return {
        topic: String(d.topic || '').substring(0, 200),
        sides,
        resolution: d.resolution ? String(d.resolution).substring(0, 200) : null,
      };
    });

    const actionItems = (parsed.action_items || []).slice(0, 10).map(a => ({
      action: String(a.action || '').substring(0, 300),
      owner: a.owner && membersPresent.includes(a.owner)
        ? a.owner
        : null,
      deadline: a.deadline ? String(a.deadline).substring(0, 50) : null,
    }));

    // ── Write to DB ───────────────────────────────────────
    const { error: insertError } = await supabase
      .from('boardroom_meeting_summaries')
      .insert({
        user_id: userId,
        meeting_id: meetingId || null,
        user_message: userMessage.substring(0, 2000),
        summary,
        key_topics: keyTopics,
        member_positions: memberPositions,
        decisions_made: decisionsMade,
        disagreements,
        action_items: actionItems,
        member_count: successful.length,
        members_present: membersPresent,
        compressed_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[MeetingMemory] Failed to write summary:', insertError.message);
      return;
    }

    console.log(
      `[MeetingMemory] Compressed meeting: ${successful.length} members, ` +
      `${keyTopics.length} topics, ${decisionsMade.length} decisions, ` +
      `${disagreements.length} disagreements`
    );

  } catch (err: any) {
    console.error('[MeetingMemory] Compression failed:', err.message);
  }
}

// =============================================================================
// GET RECENT MEETING SUMMARIES (read path)
// =============================================================================

/**
 * Get recent board meeting summaries for a user.
 * Called by single-member.ts and multi-member.ts in the parallel
 * context fetch. Returns the most recent N meetings, newest first.
 *
 * Each summary includes enough context for a board member to
 * reference what happened in past meetings naturally.
 *
 * Explicit column select — no `SELECT *` — keeps payload tight
 * for mobile-first performance.
 *
 * @param supabase - Admin client
 * @param userId - Founder's user ID
 * @param limit - Max summaries to return (default 3)
 */
export async function getRecentMeetingSummaries(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 3,
): Promise<MeetingSummary[]> {
  const { data, error } = await supabase
    .from('boardroom_meeting_summaries')
    .select(
      'id, meeting_id, user_message, summary, key_topics, member_positions, ' +
      'decisions_made, disagreements, action_items, member_count, members_present, compressed_at'
    )
    .eq('user_id', userId)
    .order('compressed_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.warn('[MeetingMemory] Failed to fetch summaries:', error.message);
    return [];
  }

  return data as MeetingSummary[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Sanitize member_positions: only keep slugs that actually participated.
 * Prevents AI from hallucinating member names that weren't in the meeting.
 * Cap each position summary to 300 chars.
 */
function sanitizePositions(
  positions: Record<string, string> | undefined,
  validSlugs: string[],
): Record<string, string> {
  if (!positions || typeof positions !== 'object') return {};

  const validSet = new Set(validSlugs);
  const sanitized: Record<string, string> = {};

  for (const [slug, position] of Object.entries(positions)) {
    if (validSet.has(slug) && typeof position === 'string' && position.trim()) {
      sanitized[slug] = position.substring(0, 300);
    }
  }

  return sanitized;
}