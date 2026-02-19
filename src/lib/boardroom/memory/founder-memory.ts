// FILE: src/lib/boardroom/memory/founder-memory.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD FOUNDER MEMORY — Each member remembers the founder differently
// ═══════════════════════════════════════════════════════════════════════
//
// Athena remembers strategic decisions and pivot points.
// Griffin remembers financial targets and risk tolerance.
// Vulcan remembers tech stack choices and architecture decisions.
// Prometheus remembers emotional patterns, fears, and breakthroughs.
//
// Ported from Oracle's personal-details.ts and compressor.ts,
// scoped per board member with role-specific extraction prompts.
//
// All extraction runs as non-blocking background tasks (fire-and-forget).
// Uses gpt-4o-mini for extraction — ~$0.001 per call. Cheap. High impact.
//
// BUG FIX (Sprint 1):
//   Extraction functions now resolve the OpenAI API key via the same
//   multi-variant lookup the gateway uses. Previously hardcoded to
//   OPEN_AI_API_KEY which could silently fail if the env var was
//   named OPENAI_API_KEY (no underscore).
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export interface FounderDetail {
  key: string;
  value: string;
  detail_type: string;
  confidence: number;
  context: string;
  extracted_at: string;
}

export interface CompressedMemory {
  summary: string;
  topics: string[];
  date: string;
  message_count: number;
}

export interface BoardActivityEntry {
  member_slug: string;
  member_name: string;
  summary: string;
  topic_tags: string[];
  energy: string;
  created_at: string;
}

export interface FounderMemoryState {
  compressed_memories: CompressedMemory[];
  founder_details: FounderDetail[];
  decisions_witnessed: Array<{ decision: string; context: string; date: string; status: string }>;
  rapport_score: number;
  total_interactions: number;
  last_energy: string;
  last_energy_arc: string;
  emotional_arc: Array<{ date: string; energy: string; arc: string; note: string }>;
  recurring_patterns: Array<{ pattern: string; first_seen: string; occurrences: number; last_seen: string }>;
}

// =============================================================================
// API KEY RESOLUTION
// =============================================================================
// Bug #2 fix: Check both env var naming conventions.
// The gateway's getApiKey checks OPENAI_API_KEY and OPEN_AI_API_KEY.
// We replicate that logic here since founder-memory.ts calls OpenAI
// directly (bypassing the gateway for cheap extraction calls).

function getOpenAIKey(): string | null {
  const candidates = ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'];
  for (const envKey of candidates) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

// =============================================================================
// MEMBER-SPECIFIC EXTRACTION PROMPTS
// =============================================================================
// Each member extracts different founder details based on their expertise.

const MEMBER_EXTRACTION_PROMPTS: Record<string, string> = {
  athena: `Extract STRATEGIC information the founder revealed:
- Strategic decisions made or discussed
- Market positions and competitive concerns
- Long-term goals and vision statements
- Risk appetite and tolerance signals
- Pivot history and reasoning
- Growth targets and timeline expectations
- Competitive threats mentioned
Key types: strategic_decision, market_position, long_term_goal, risk_appetite, pivot_point, growth_target, competitive_threat`,

  griffin: `Extract FINANCIAL information the founder revealed:
- Revenue targets and actual numbers mentioned
- Burn rate, runway, and cash position
- Pricing decisions and reasoning
- Budget constraints and spending priorities
- Funding status and investor discussions
- Financial risk tolerance
- Unit economics and margins discussed
Key types: revenue_target, burn_rate, pricing_decision, budget_constraint, funding_status, financial_risk, unit_economics`,

  vulcan: `Extract TECHNICAL information the founder revealed:
- Technology stack choices and preferences
- Architecture decisions and reasoning
- Build vs buy decisions
- Technical debt acknowledged
- Deployment preferences and infrastructure
- Performance requirements mentioned
- Integration priorities
Key types: tech_stack, architecture_decision, build_vs_buy, tech_debt, deployment_pref, performance_req, integration_priority`,

  prometheus: `Extract PSYCHOLOGICAL and PERSONAL information the founder revealed:
- Emotional state signals (stressed, excited, burnt out, energized)
- Fears and doubts expressed
- Breakthroughs and moments of clarity
- Motivation sources and what drives them
- Energy patterns (when do they crash vs thrive)
- Relationship mentions (family, team, partners)
- Meaning and purpose statements
- Coping patterns (healthy and unhealthy)
- Self-perception and identity statements
- Recurring themes across conversations
Key types: emotional_state, fear_expressed, breakthrough, motivation_source, energy_pattern, relationship_mention, meaning_statement, coping_pattern, self_perception, recurring_theme`,

  glitch: `Extract MARKETING and BRAND information the founder revealed:
- Brand voice decisions and preferences
- Marketing wins and failures mentioned
- Audience insights and user feedback
- Content strategies discussed
- Messaging that resonated or failed
- Community dynamics observed
- Channel preferences and priorities
Key types: brand_voice, marketing_result, audience_insight, content_strategy, messaging_test, community_insight, channel_preference`,

  sal: `Extract OPERATIONAL information the founder revealed:
- Process decisions and workflow changes
- Inventory strategies and stock decisions
- Fulfillment and shipping approaches
- Operational bottlenecks mentioned
- Efficiency targets and improvements
- Vendor and supplier discussions
- Quality standards mentioned
Key types: process_decision, inventory_strategy, fulfillment_approach, bottleneck, efficiency_target, vendor_info, quality_standard`,

  lexicoda: `Extract LEGAL and COMPLIANCE information the founder revealed:
- Legal decisions made or pending
- Compliance concerns mentioned
- IP and intellectual property discussions
- Contract terms and partnership structures
- Risk exposures flagged or acknowledged
- Regulatory requirements mentioned
- Terms of service and privacy discussions
Key types: legal_decision, compliance_concern, ip_matter, contract_term, risk_exposure, regulatory_req, policy_decision`,

  scuba: `Extract RESEARCH and MARKET INTELLIGENCE the founder revealed:
- Market opportunities identified
- Competitive intelligence gathered
- Emerging trends discussed
- Customer segments mentioned
- Industry dynamics observed
- Data sources and research methods preferred
Key types: market_opportunity, competitive_intel, emerging_trend, customer_segment, industry_dynamic, research_preference`,

  janus: `Extract HISTORICAL PATTERNS and FUTURE PREDICTIONS the founder discussed:
- Past decisions and their outcomes
- Pattern recognition insights
- Future predictions and timing expectations
- Seasonal patterns mentioned
- Market cycle observations
- Trend timing and inflection points
Key types: past_outcome, pattern_insight, future_prediction, seasonal_pattern, market_cycle, timing_insight`,

  // Default for members without specific prompts
  _default: `Extract KEY INFORMATION the founder revealed that is relevant to your domain:
- Decisions made or discussed
- Goals and targets mentioned
- Concerns and risks flagged
- Preferences and priorities expressed
- Important context for future conversations
Key types: decision, goal, concern, preference, context`,
};

// =============================================================================
// FETCH FOUNDER MEMORY FOR A MEMBER
// =============================================================================

/**
 * Get a board member's memory of the founder.
 * Returns compressed memories, extracted details, and relationship state.
 * Creates the memory row if it doesn't exist yet.
 */
export async function getFounderMemory(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
): Promise<FounderMemoryState | null> {
  // Upsert — create if not exists
  const { data, error } = await supabase
    .from('board_founder_memory')
    .upsert(
      { user_id: userId, member_slug: memberSlug },
      { onConflict: 'user_id,member_slug', ignoreDuplicates: true }
    )
    .select('*')
    .single();

  if (error) {
    // Try a plain select if upsert fails (RLS might block upsert)
    const { data: existing } = await supabase
      .from('board_founder_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('member_slug', memberSlug)
      .single();

    if (!existing) {
      // Create it
      await supabase
        .from('board_founder_memory')
        .insert({ user_id: userId, member_slug: memberSlug });

      return {
        compressed_memories: [],
        founder_details: [],
        decisions_witnessed: [],
        rapport_score: 20,
        total_interactions: 0,
        last_energy: 'neutral',
        last_energy_arc: 'steady',
        emotional_arc: [],
        recurring_patterns: [],
      };
    }

    return existing as FounderMemoryState;
  }

  return data as FounderMemoryState;
}

// =============================================================================
// GET CROSS-BOARD ACTIVITY FEED
// =============================================================================

/**
 * Get recent activity from OTHER board members (not the current one).
 * Injected into prompts so members know what colleagues have been advising.
 */
export async function getCrossBoardFeed(
  supabase: SupabaseClient,
  userId: string,
  excludeMemberSlug: string,
  days: number = 7,
  limit: number = 7,
): Promise<BoardActivityEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('board_activity_feed')
    .select('member_slug, summary, topic_tags, energy, created_at')
    .eq('user_id', userId)
    .neq('member_slug', excludeMemberSlug)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Map member slugs to display names
  const nameMap: Record<string, string> = {
    athena: 'Athena (CSO)', griffin: 'Griffin (CFO)', scuba: 'Scuba Steve (CRO)',
    glitch: 'Glitch (CMO)', lexicoda: 'Lexicoda (CLO)', vulcan: 'Vulcan (CTO)',
    leo: 'LEO (CDO)', cerebro: 'Cerebro (CHRO)', aegle: 'Aegle (CWO)',
    janus: 'Janus (CIO)', legolas: 'Legolas (CProdO)', orion: 'Orion (CKO)',
    sal: 'Sal (COO)', sha1: 'SHA-1 (CPO)', prometheus: 'Prometheus (CPsyO)',
  };

  return data.map(entry => ({
    ...entry,
    member_name: nameMap[entry.member_slug] || entry.member_slug,
  }));
}

// =============================================================================
// GET RECENT DECISIONS
// =============================================================================

/**
 * Get recent board decisions for context injection.
 */
export async function getRecentDecisions(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 5,
): Promise<Array<{ decision: string; member_slug: string; category: string; created_at: string }>> {
  const { data } = await supabase
    .from('board_decisions')
    .select('decision, member_slug, category, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

// =============================================================================
// POST-CONVERSATION: EXTRACT FOUNDER DETAILS (background)
// =============================================================================

/**
 * Extract founder details from a conversation, filtered through the member's
 * expertise lens. Runs as a non-blocking background task.
 *
 * Uses gpt-4o-mini — ~$0.001 per call.
 *
 * Bug #2 fix: API key resolved via getOpenAIKey() which checks both
 * OPENAI_API_KEY and OPEN_AI_API_KEY env var names.
 */
export async function extractFounderDetails(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  const userMessages = messages.filter(m =>
    m.role === 'user' && m.content.trim().length > 10
  );
  if (userMessages.length < 2) return;

  // ── Bug #2 fix: use multi-variant key lookup ──────────
  const openaiKey = getOpenAIKey();
  if (!openaiKey) {
    console.warn('[BoardMemory] No OpenAI API key found (checked OPENAI_API_KEY and OPEN_AI_API_KEY). Skipping extraction.');
    return;
  }

  const extractionPrompt = MEMBER_EXTRACTION_PROMPTS[memberSlug]
    || MEMBER_EXTRACTION_PROMPTS._default;

  const transcript = messages
    .filter(m => m.role !== 'system')
    .slice(-30)
    .map(m => `${m.role === 'user' ? 'FOUNDER' : memberSlug.toUpperCase()}: ${m.content.substring(0, 400)}`)
    .join('\n');

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
            content: `You extract founder information from board conversations.
${extractionPrompt}

Return ONLY a JSON object:
{
  "details": [
    { "key": "snake_case_key", "value": "extracted value", "detail_type": "type_from_above", "confidence": 0.8, "context": "how you know this" }
  ],
  "activity_summary": "One sentence summary of what was discussed",
  "topic_tags": ["tag1", "tag2"],
  "decisions_made": [
    { "decision": "what was decided", "context": "why" }
  ]
}

Confidence: 1.0 = explicitly stated, 0.8 = strongly implied, 0.6 = reasonably inferred.
Do NOT extract anything below 0.6 confidence.
Return empty arrays if nothing relevant found.`,
          },
          { role: 'user', content: `CONVERSATION:\n${transcript}` },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.warn(`[BoardMemory] Extraction API error for ${memberSlug}:`, response.status);
      return;
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return;

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.warn(`[BoardMemory] Failed to parse extraction for ${memberSlug}`);
      return;
    }

    // ── Update founder memory ──────────────────────────────
    const { data: existing } = await supabase
      .from('board_founder_memory')
      .select('founder_details, decisions_witnessed, total_interactions')
      .eq('user_id', userId)
      .eq('member_slug', memberSlug)
      .single();

    if (!existing) return;

    // Merge new details (deduplicate by key, newer wins)
    const existingDetails = (existing.founder_details || []) as FounderDetail[];
    const newDetails = (parsed.details || [])
      .filter((d: any) => d.key && d.value && d.confidence >= 0.6)
      .map((d: any) => ({
        key: String(d.key).substring(0, 100),
        value: String(d.value).substring(0, 500),
        detail_type: d.detail_type || 'context',
        confidence: d.confidence || 0.6,
        context: d.context ? String(d.context).substring(0, 200) : '',
        extracted_at: new Date().toISOString(),
      }));

    // Deduplicate: new details overwrite old ones with same key
    const detailMap = new Map<string, FounderDetail>();
    for (const detail of existingDetails) detailMap.set(detail.key, detail);
    for (const detail of newDetails) detailMap.set(detail.key, detail);
    const mergedDetails = Array.from(detailMap.values()).slice(-50); // Cap at 50

    // Merge decisions
    const existingDecisions = existing.decisions_witnessed || [];
    const newDecisions = (parsed.decisions_made || []).map((d: any) => ({
      decision: String(d.decision).substring(0, 300),
      context: d.context ? String(d.context).substring(0, 200) : '',
      date: new Date().toISOString().split('T')[0],
      status: 'active',
    }));
    const mergedDecisions = [...existingDecisions, ...newDecisions].slice(-30); // Cap at 30

    // Update the memory row
    await supabase
      .from('board_founder_memory')
      .update({
        founder_details: mergedDetails,
        decisions_witnessed: mergedDecisions,
        total_interactions: (existing.total_interactions || 0) + 1,
        last_interaction_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('member_slug', memberSlug);

    // ── Post to activity feed ──────────────────────────────
    const activitySummary = parsed.activity_summary
      || `Discussed ${(parsed.topic_tags || []).join(', ') || 'general topics'}`;

    await supabase
      .from('board_activity_feed')
      .insert({
        user_id: userId,
        member_slug: memberSlug,
        summary: String(activitySummary).substring(0, 300),
        topic_tags: (parsed.topic_tags || []).slice(0, 5),
        energy: null, // Will be set by the chat handler
      });

    console.log(
      `[BoardMemory] ${memberSlug}: extracted ${newDetails.length} details, ` +
      `${newDecisions.length} decisions for founder`
    );

  } catch (err: any) {
    console.warn(`[BoardMemory] Extraction failed for ${memberSlug}:`, err.message);
  }
}

// =============================================================================
// POST-CONVERSATION: COMPRESS THREAD (background)
// =============================================================================

/**
 * Compress a board member's conversation thread into a memory summary.
 * Triggered when thread_message_count >= COMPRESSION_THRESHOLD.
 *
 * Bug #2 fix: API key resolved via getOpenAIKey() which checks both
 * OPENAI_API_KEY and OPEN_AI_API_KEY env var names.
 */
export async function compressBoardThread(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  const meaningful = messages.filter(m =>
    m.role !== 'system' && m.content.trim().length > 10
  );
  if (meaningful.length < 8) return;

  // ── Bug #2 fix: use multi-variant key lookup ──────────
  const openaiKey = getOpenAIKey();
  if (!openaiKey) {
    console.warn('[BoardMemory] No OpenAI API key found. Skipping compression.');
    return;
  }

  const extractionPrompt = MEMBER_EXTRACTION_PROMPTS[memberSlug]
    || MEMBER_EXTRACTION_PROMPTS._default;

  const transcript = meaningful
    .slice(-40)
    .map(m => `${m.role === 'user' ? 'FOUNDER' : memberSlug.toUpperCase()}: ${m.content.substring(0, 300)}`)
    .join('\n');

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
            content: `Compress this board conversation into a structured memory summary.
You are summarizing from the perspective of ${memberSlug}, focusing on what matters for their role.

${extractionPrompt}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary focused on what matters for this board member's role",
  "topics": ["topic1", "topic2"],
  "key_takeaways": ["takeaway1", "takeaway2"]
}`,
          },
          { role: 'user', content: `CONVERSATION:\n${transcript}` },
        ],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return;

    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch { return; }

    const { data: existing } = await supabase
      .from('board_founder_memory')
      .select('compressed_memories')
      .eq('user_id', userId)
      .eq('member_slug', memberSlug)
      .single();

    if (!existing) return;

    const memories = (existing.compressed_memories || []) as CompressedMemory[];
    memories.push({
      summary: parsed.summary || 'Conversation compressed',
      topics: parsed.topics || [],
      date: new Date().toISOString().split('T')[0],
      message_count: meaningful.length,
    });

    // Keep last 20 compressed memories
    const trimmed = memories.slice(-20);

    await supabase
      .from('board_founder_memory')
      .update({
        compressed_memories: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('member_slug', memberSlug);

    console.log(`[BoardMemory] Compressed ${memberSlug} thread: ${meaningful.length} msgs → summary`);

  } catch (err: any) {
    console.warn(`[BoardMemory] Compression failed for ${memberSlug}:`, err.message);
  }
}

// =============================================================================
// PROMETHEUS SPECIAL: EMOTIONAL ARC TRACKING
// =============================================================================

/**
 * Track the founder's emotional arc over time.
 * Only used by Prometheus. Runs after every Prometheus conversation.
 */
export async function trackEmotionalArc(
  supabase: SupabaseClient,
  userId: string,
  energy: string,
  arc: string,
  note: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('board_founder_memory')
    .select('emotional_arc, recurring_patterns')
    .eq('user_id', userId)
    .eq('member_slug', 'prometheus')
    .single();

  if (!existing) return;

  // Add to emotional arc
  const emotionalArc = (existing.emotional_arc || []) as Array<any>;
  emotionalArc.push({
    date: new Date().toISOString(),
    energy,
    arc,
    note: note.substring(0, 300),
  });

  // Keep last 50 entries (covers ~2 months of regular use)
  const trimmedArc = emotionalArc.slice(-50);

  // Detect recurring patterns
  const patterns = existing.recurring_patterns || [];
  detectRecurringPatterns(trimmedArc, patterns);

  await supabase
    .from('board_founder_memory')
    .update({
      emotional_arc: trimmedArc,
      recurring_patterns: patterns.slice(-10),
      last_energy: energy,
      last_energy_arc: arc,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('member_slug', 'prometheus');
}

/**
 * Simple pattern detection for Prometheus.
 * Looks for repeated emotional states within similar timeframes.
 */
function detectRecurringPatterns(
  arc: Array<{ date: string; energy: string; arc: string; note: string }>,
  patterns: Array<{ pattern: string; first_seen: string; occurrences: number; last_seen: string }>,
): void {
  // Count energy frequencies in last 30 entries
  const recent = arc.slice(-30);
  const energyCounts: Record<string, number> = {};
  for (const entry of recent) {
    energyCounts[entry.energy] = (energyCounts[entry.energy] || 0) + 1;
  }

  // If any negative energy appears 3+ times, flag as pattern
  const negativeEnergies = ['frustrated', 'anxious', 'exhausted'];
  for (const energy of negativeEnergies) {
    if ((energyCounts[energy] || 0) >= 3) {
      const existingPattern = patterns.find(p => p.pattern.includes(energy));
      if (existingPattern) {
        existingPattern.occurrences++;
        existingPattern.last_seen = new Date().toISOString();
      } else {
        patterns.push({
          pattern: `Recurring ${energy} state detected`,
          first_seen: new Date().toISOString(),
          occurrences: energyCounts[energy],
          last_seen: new Date().toISOString(),
        });
      }
    }
  }

  // Detect sprint patterns (high focus followed by crash)
  const arcSequence = recent.map(e => e.arc).join(',');
  if (arcSequence.includes('building_excitement') && arcSequence.includes('venting')) {
    const existingPattern = patterns.find(p => p.pattern.includes('sprint-crash'));
    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.last_seen = new Date().toISOString();
    } else {
      patterns.push({
        pattern: 'sprint-crash cycle: high energy build followed by crash/venting',
        first_seen: new Date().toISOString(),
        occurrences: 1,
        last_seen: new Date().toISOString(),
      });
    }
  }
}

// =============================================================================
// UPDATE ENERGY STATE
// =============================================================================

/**
 * Update a member's last-known energy reading of the founder.
 */
export async function updateFounderEnergy(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
  energy: string,
  arc: string,
): Promise<void> {
  await supabase
    .from('board_founder_memory')
    .update({
      last_energy: energy,
      last_energy_arc: arc,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('member_slug', memberSlug);
}