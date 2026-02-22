// FILE: src/lib/boardroom/evolution/personality.ts
// ═══════════════════════════════════════════════════════════════════════
// SPRINT 4: PERSONALITY EVOLUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════
//
// AI-driven personality growth every 25 interactions.
// Uses gpt-4o-mini to analyze conversation patterns and extract:
//   - Voice signatures and catchphrases
//   - Cross-member opinions from meeting interactions
//   - Inside references to specific past conversations
//   - Expertise deepening based on conversation topics
//
// Cost: ~$0.002 per evolution (gpt-4o-mini). Fire-and-forget.
//
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient, PersonalityEvolutionData } from './types.js';

// ============================================================================
// API KEY RESOLUTION
// ============================================================================

function getOpenAIKey(): string | null {
  const candidates = ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'];
  for (const envKey of candidates) {
    const value = process.env[envKey];
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
}

// ============================================================================
// EVOLVED PROMPT NARRATIVE BUILDER
// ============================================================================

/**
 * Build a narrative text summary of the evolved personality.
 * Stored in boardroom_members.evolved_prompt for backward compat
 * with any code that reads evolved_prompt as a text block.
 */
function buildEvolvedPromptNarrative(
  member: { name: string; title: string; role: string; voice_style?: string },
  evolution: PersonalityEvolutionData,
): string {
  const lines: string[] = [];

  lines.push(`EVOLVED PERSONALITY — ${member.name} (Generation ${evolution.generation})`);
  lines.push('');

  if (evolution.voice_signature) {
    lines.push(`VOICE: ${evolution.voice_signature}`);
  }

  if (evolution.communication_style) {
    lines.push(`STYLE: ${evolution.communication_style}`);
  }

  if (evolution.catchphrases.length > 0) {
    lines.push(`SIGNATURE PHRASES: ${evolution.catchphrases.join(' | ')}`);
  }

  if (evolution.expertise_evolution) {
    lines.push(`EXPERTISE GROWTH: ${evolution.expertise_evolution}`);
  }

  if (Object.keys(evolution.cross_member_opinions).length > 0) {
    lines.push('');
    lines.push('COLLEAGUE VIEWS:');
    for (const [slug, opinion] of Object.entries(evolution.cross_member_opinions)) {
      lines.push(`  ${slug}: ${opinion}`);
    }
  }

  if (evolution.inside_references.length > 0) {
    lines.push('');
    lines.push('SHARED HISTORY:');
    for (const ref of evolution.inside_references) {
      lines.push(`  "${ref.reference}" — ${ref.context}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// MAIN PERSONALITY EVOLUTION
// ============================================================================

/**
 * Evolve a board member's personality based on their conversation history.
 *
 * Triggered every 25 interactions. Uses gpt-4o-mini to analyze:
 *   - How the member has been communicating (speech patterns)
 *   - Emerging catchphrases and signature phrases
 *   - Opinions about other members formed through meetings
 *   - Inside references to specific past conversations
 *   - Expertise deepening based on conversation topics
 *
 * Writes to:
 *   - boardroom_members.personality_evolution (JSONB — live personality data)
 *   - boardroom_members.evolved_prompt (TEXT — narrative personality summary)
 *   - boardroom_evolution_history (audit/rollback snapshot)
 */
export async function evolvePersonality(
  supabase: SupabaseClient,
  userId: string,
  memberSlug: string,
): Promise<void> {
  const openaiKey = getOpenAIKey();
  if (!openaiKey) {
    console.warn('[Evolution] No OpenAI API key found. Skipping personality evolution.');
    return;
  }

  // ── 1. Fetch member's current state ────────────────────
  const { data: member } = await supabase
    .from('boardroom_members')
    .select('slug, name, title, role, voice_style, personality, personality_evolution, total_interactions')
    .eq('slug', memberSlug)
    .single();

  if (!member) {
    console.warn(`[Evolution] Member ${memberSlug} not found. Skipping.`);
    return;
  }

  const currentEvolution = (member.personality_evolution || {}) as Partial<PersonalityEvolutionData>;
  const currentGeneration = currentEvolution.generation || 0;
  const nextGeneration = currentGeneration + 1;

  // ── 2. Fetch recent conversations (member's actual responses) ──
  const { data: conversations } = await supabase
    .from('boardroom_conversations')
    .select('messages')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .order('updated_at', { ascending: false })
    .limit(8);

  // Extract the member's responses + founder's messages for analysis
  const memberResponses: string[] = [];
  const founderMessages: string[] = [];

  for (const convo of (conversations || [])) {
    const msgs = (convo.messages || []) as Array<{ role: string; content: string }>;
    for (const msg of msgs) {
      if (msg.role === 'assistant' && msg.content) {
        memberResponses.push(msg.content.substring(0, 400));
      } else if (msg.role === 'user' && msg.content) {
        founderMessages.push(msg.content.substring(0, 300));
      }
    }
  }

  // Need at least some conversation data to evolve
  if (memberResponses.length < 5) {
    console.log(`[Evolution] ${memberSlug}: insufficient conversation data (${memberResponses.length} responses). Skipping.`);
    return;
  }

  // ── 3. Fetch recent meeting summaries for cross-member opinions ──
  const { data: meetings } = await supabase
    .from('boardroom_meeting_summaries')
    .select('summary, member_positions, disagreements, members_present')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Build meeting context — what this member said + what others said
  const meetingContext = (meetings || []).map(m => {
    const myPosition = m.member_positions?.[memberSlug];
    const otherPositions = Object.entries(m.member_positions || {})
      .filter(([slug]) => slug !== memberSlug)
      .slice(0, 4)
      .map(([slug, pos]) => `${slug}: ${pos}`)
      .join('\n  ');
    const tensions = (m.disagreements || [])
      .map((d: any) => d.topic)
      .join(', ');

    return [
      `Meeting: ${m.summary?.substring(0, 200) || 'Board discussion'}`,
      myPosition ? `My position: ${myPosition}` : null,
      otherPositions ? `Colleagues:\n  ${otherPositions}` : null,
      tensions ? `Tensions: ${tensions}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n---\n');

  // ── 4. Fetch founder's compressed memories for inside references ──
  const { data: memory } = await supabase
    .from('board_founder_memory')
    .select('compressed_memories, founder_details')
    .eq('user_id', userId)
    .eq('member_slug', memberSlug)
    .single();

  const compressedSummaries = ((memory?.compressed_memories || []) as any[])
    .slice(-5)
    .map((c: any) => c.summary || '')
    .filter(Boolean)
    .join('\n');

  // ── 5. Build the evolution prompt ──────────────────────
  const sampleResponses = memberResponses
    .slice(0, 15)
    .map((r, i) => `[${i + 1}] ${r}`)
    .join('\n\n');

  const sampleFounder = founderMessages
    .slice(0, 10)
    .map((m, i) => `[${i + 1}] ${m}`)
    .join('\n');

  const previousCatchphrases = (currentEvolution.catchphrases || []).join(', ');
  const previousVoice = currentEvolution.voice_signature || member.voice_style || 'Not yet established';

  const prompt = `You analyze a board member's communication patterns to extract their EVOLVING personality.

MEMBER: ${member.name} (${member.title})
ROLE: ${member.role}
GENERATION: ${nextGeneration} (evolving from generation ${currentGeneration})
CURRENT VOICE: ${previousVoice}
${previousCatchphrases ? `PREVIOUS CATCHPHRASES: ${previousCatchphrases}` : ''}

═══ MEMBER'S RECENT RESPONSES (how they actually communicate) ═══
${sampleResponses}

═══ FOUNDER'S MESSAGES (what they discuss with this member) ═══
${sampleFounder}

${meetingContext ? `═══ BOARD MEETING INTERACTIONS ═══\n${meetingContext}` : ''}

${compressedSummaries ? `═══ PAST CONVERSATION SUMMARIES ═══\n${compressedSummaries}` : ''}

═══ YOUR TASK ═══
Extract this member's EVOLVED personality. Build on generation ${currentGeneration}, don't restart from zero.

Return ONLY valid JSON:
{
  "voice_signature": "1-2 sentences describing HOW this member naturally communicates. Speech rhythm, directness, preferred structures. Based on ACTUAL patterns in their responses.",
  "catchphrases": ["Up to 4 phrases or sentence starters this member gravitates toward. Must feel NATURAL, pulled from actual patterns. Keep previous catchphrases if still relevant, replace stale ones."],
  "cross_member_opinions": {
    "member_slug": "One sentence professional opinion about a colleague, based on meeting interactions. Only include members they've actually interacted with."
  },
  "inside_references": [
    { "reference": "Short label for a specific past event/conversation", "context": "What it refers to — specific enough to trigger a memory" }
  ],
  "expertise_evolution": "One sentence on how their expertise has deepened or shifted based on conversation topics",
  "communication_style": "One sentence: their evolved communication approach (e.g., 'Data-first storyteller who grounds abstractions in specific numbers')"
}

RULES:
- Catchphrases must come from ACTUAL patterns, not generic business speak
- Cross-member opinions need genuine professional tension or respect — not bland praise
- Inside references must be SPECIFIC to real conversations, not generic
- Voice signature should capture what makes this member DISTINCT from the other 14
- If insufficient data for a field, return null — never fabricate
- Maximum 4 cross_member_opinions, 3 inside_references
- Build ON the previous generation, evolve it — don't replace everything`;

  // ── 6. Call gpt-4o-mini ────────────────────────────────
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
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.warn(`[Evolution] API error for ${memberSlug}:`, response.status);
      return;
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return;

    // ── 7. Parse and validate ──────────────────────────────
    let parsed: any;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      console.warn(`[Evolution] Failed to parse evolution response for ${memberSlug}`);
      return;
    }

    // Sanitize every field — defensive coding
    const voiceSignature = parsed.voice_signature
      ? String(parsed.voice_signature).substring(0, 500)
      : currentEvolution.voice_signature || null;

    const catchphrases = Array.isArray(parsed.catchphrases)
      ? parsed.catchphrases
          .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
          .map((c: string) => c.substring(0, 100))
          .slice(0, 4)
      : currentEvolution.catchphrases || [];

    const crossMemberOpinions: Record<string, string> = {};
    if (parsed.cross_member_opinions && typeof parsed.cross_member_opinions === 'object') {
      for (const [slug, opinion] of Object.entries(parsed.cross_member_opinions)) {
        if (typeof opinion === 'string' && opinion.trim().length > 0 && slug !== memberSlug) {
          crossMemberOpinions[slug] = String(opinion).substring(0, 300);
        }
      }
    }
    // Merge with previous opinions (keep old ones that weren't refreshed)
    const mergedOpinions = {
      ...(currentEvolution.cross_member_opinions || {}),
      ...crossMemberOpinions,
    };

    const insideReferences = Array.isArray(parsed.inside_references)
      ? parsed.inside_references
          .filter((r: any) => r?.reference && r?.context)
          .map((r: any) => ({
            reference: String(r.reference).substring(0, 150),
            context: String(r.context).substring(0, 300),
          }))
          .slice(0, 3)
      : [];
    // Merge with previous references (keep last 5 total)
    const mergedReferences = [
      ...(currentEvolution.inside_references || []),
      ...insideReferences,
    ].slice(-5);

    const expertiseEvolution = parsed.expertise_evolution
      ? String(parsed.expertise_evolution).substring(0, 400)
      : currentEvolution.expertise_evolution || null;

    const communicationStyle = parsed.communication_style
      ? String(parsed.communication_style).substring(0, 300)
      : currentEvolution.communication_style || null;

    // ── 8. Build the evolved personality_evolution JSONB ──
    const newEvolution: PersonalityEvolutionData = {
      generation: nextGeneration,
      voice_signature: voiceSignature,
      catchphrases,
      cross_member_opinions: mergedOpinions,
      inside_references: mergedReferences,
      expertise_evolution: expertiseEvolution,
      communication_style: communicationStyle,
      last_evolved_at: new Date().toISOString(),
    };

    // ── 9. Build the evolved_prompt text narrative ───────
    const evolvedPrompt = buildEvolvedPromptNarrative(member, newEvolution);

    // ── 10. Write to boardroom_members ───────────────────
    await supabase
      .from('boardroom_members')
      .update({
        personality_evolution: newEvolution,
        evolved_prompt: evolvedPrompt,
      })
      .eq('slug', memberSlug);

    // ── 11. Write to boardroom_evolution_history (audit) ─
    await supabase
      .from('boardroom_evolution_history')
      .insert({
        member_slug: memberSlug,
        user_id: userId,
        generation: nextGeneration,
        evolved_prompt: evolvedPrompt,
        voice_signature: voiceSignature,
        catchphrases,
        cross_member_opinions: mergedOpinions,
        inside_references: mergedReferences,
        expertise_evolution: expertiseEvolution,
        communication_style: communicationStyle,
        trigger_interaction_count: member.total_interactions,
      })
      .then(() => {})
      .catch(() => {}); // Non-fatal — the live data is what matters

    console.log(
      `🧬 [Evolution] ${member.name} evolved to generation ${nextGeneration} ` +
      `(${catchphrases.length} catchphrases, ` +
      `${Object.keys(mergedOpinions).length} opinions, ` +
      `${mergedReferences.length} references)`
    );

  } catch (err: any) {
    console.warn(`[Evolution] Personality evolution failed for ${memberSlug}:`, err.message);
  }
}