// FILE: api/boardroom/lib/prompt-builder/formatters.ts
// ═══════════════════════════════════════════════════════════════════════
// PROMPT LAYER FORMATTERS
// ═══════════════════════════════════════════════════════════════════════
//
// Each function formats one data source into prompt text.
// Pure functions: data in → string out. No side effects.
//
// Layers:
//   formatPersonalityEvolution  → Layer 1 enhancement (Sprint 4)
//   formatFounderMemory         → Layer 3 (Phase 0)
//   formatEnergyGuidance        → Layer 4
//   formatCrossBoardFeed        → Layer 5
//   formatRecentDecisions       → Layer 6
//   formatMeetingSummaries      → Layer 9 (Sprint 3)
//   formatCompanyContext         → Legacy fallback
//   formatLegacyMemories        → Legacy fallback
//   formatConversationHistory   → User prompt assembly
//
// ═══════════════════════════════════════════════════════════════════════

import { ENERGY_ADAPTATIONS, ARC_GUIDANCE } from './constants.js';
import type {
  EnergyLevel,
  EnergyArc,
  FounderMemoryState,
  BoardActivityEntry,
  MeetingSummary,
} from './types.js';

// ============================================================================
// SPRINT 4: PERSONALITY EVOLUTION (Layer 1 enhancement)
// ============================================================================

/**
 * Format evolved personality data for injection into Layer 1 (Identity).
 *
 * This makes the member feel like they've GROWN these traits organically.
 * The text is conversational, not structured — it reads like a character
 * brief, not a database dump.
 *
 * Only renders if personality_evolution has meaningful data.
 */
export function formatPersonalityEvolution(
  evolution?: Record<string, any>,
  memberName?: string,
): string {
  if (!evolution || !evolution.generation || evolution.generation < 1) return '';

  const sections: string[] = [];

  // Voice signature — the core of who they are now
  if (evolution.voice_signature) {
    sections.push(`Your communication has evolved: ${evolution.voice_signature}`);
  }

  // Catchphrases — natural speech patterns
  const catchphrases = evolution.catchphrases as string[] | undefined;
  if (catchphrases && catchphrases.length > 0) {
    sections.push(
      `You naturally gravitate toward phrases like: ${catchphrases.map(c => `"${c}"`).join(', ')}. ` +
      `Use these when they fit — they're YOUR voice, not a script.`
    );
  }

  // Cross-member opinions — organic relationships
  const opinions = evolution.cross_member_opinions as Record<string, string> | undefined;
  if (opinions && Object.keys(opinions).length > 0) {
    const opinionLines = Object.entries(opinions)
      .slice(0, 4)
      .map(([slug, opinion]) => `  - ${slug}: ${opinion}`)
      .join('\n');
    sections.push(
      `Your professional views on colleagues (reference naturally, don't list):\n${opinionLines}`
    );
  }

  // Inside references — shared history with the CEO
  const references = evolution.inside_references as Array<{ reference: string; context: string }> | undefined;
  if (references && references.length > 0) {
    const refLines = references
      .slice(0, 3)
      .map(r => `  - "${r.reference}" — ${r.context}`)
      .join('\n');
    sections.push(
      `Shared history you can reference when relevant:\n${refLines}\n` +
      `Weave these in naturally — "Remember when we discussed..." not "According to my records..."`
    );
  }

  // Communication style
  if (evolution.communication_style) {
    sections.push(`Your evolved style: ${evolution.communication_style}`);
  }

  // Expertise deepening
  if (evolution.expertise_evolution) {
    sections.push(`How you've grown: ${evolution.expertise_evolution}`);
  }

  if (sections.length === 0) return '';

  return `
### YOUR EVOLVED PERSONALITY (Generation ${evolution.generation})
You've been advising this CEO across many conversations. You're not a template —
you've developed real patterns, opinions, and a relationship. Lean into it.

${sections.join('\n\n')}
`;
}

// ============================================================================
// PHASE 0: FOUNDER MEMORY (Layer 3)
// ============================================================================

export function formatFounderMemory(memory: FounderMemoryState | null | undefined): string {
  if (!memory) return '';

  const sections: string[] = [];

  // Extracted details — what you've learned about this CEO
  const details = memory.founder_details || [];
  if (details.length > 0) {
    const highConfidence = details
      .filter(d => d.confidence >= 0.7)
      .slice(-15);

    if (highConfidence.length > 0) {
      sections.push(`### What You Know About This CEO:
${highConfidence.map(d => `- **${d.detail_type}**: ${d.value}`).join('\n')}`);
    }
  }

  // Compressed memories — summaries of past conversation threads
  const compressed = memory.compressed_memories || [];
  if (compressed.length > 0) {
    const recent = compressed.slice(-5);
    sections.push(`### Past Conversation Summaries:
${recent.map(c => `- [${c.date}] ${c.summary} (Topics: ${(c.topics || []).join(', ')})`).join('\n')}`);
  }

  // Decisions witnessed — institutional memory
  const decisions = memory.decisions_witnessed || [];
  if (decisions.length > 0) {
    const activeDecisions = decisions
      .filter(d => d.status === 'active')
      .slice(-5);
    if (activeDecisions.length > 0) {
      sections.push(`### Decisions You've Witnessed:
${activeDecisions.map(d => `- ${d.decision} (${d.date})`).join('\n')}`);
    }
  }

  // Recurring patterns (Prometheus special)
  const patterns = memory.recurring_patterns || [];
  if (patterns.length > 0) {
    sections.push(`### Recurring Patterns You've Noticed:
${patterns.slice(-3).map(p => `- ${p.pattern} (seen ${p.occurrences}x)`).join('\n')}`);
  }

  if (sections.length === 0) return '';

  return `
## YOUR MEMORY OF THIS CEO
You remember these details from past conversations. Use them naturally —
reference shared history, build on previous discussions, notice patterns.
Do NOT list these facts back. Weave them into your advice organically.

${sections.join('\n\n')}

Relationship depth: ${memory.total_interactions || 0} conversations
`;
}

// ============================================================================
// PHASE 0: ENERGY ADAPTATION (Layer 4)
// ============================================================================

export function formatEnergyGuidance(
  energy?: EnergyLevel,
  arc?: EnergyArc,
): string {
  if (!energy || energy === 'neutral') return '';

  const energyAdvice = ENERGY_ADAPTATIONS[energy] || ENERGY_ADAPTATIONS.neutral;
  const arcAdvice = arc && arc !== 'steady' ? ARC_GUIDANCE[arc] || '' : '';

  return `
## CEO'S CURRENT STATE
Energy: **${energy}** | Arc: **${arc || 'steady'}**

${energyAdvice}
${arcAdvice ? `\n${arcAdvice}` : ''}

Adapt your tone and approach accordingly. This is not about being soft —
it's about being effective. A frustrated CEO needs different medicine than
an excited one.
`;
}

// ============================================================================
// PHASE 0: CROSS-BOARD FEED (Layer 5)
// ============================================================================

export function formatCrossBoardFeed(
  feed?: BoardActivityEntry[],
  currentMemberSlug?: string,
): string {
  if (!feed || feed.length === 0) return '';

  const otherMembers = feed.filter(f => f.member_slug !== currentMemberSlug);
  if (otherMembers.length === 0) return '';

  return `
## WHAT YOUR COLLEAGUES DISCUSSED RECENTLY
Other board members have been advising the CEO on these topics.
Use this for context — don't repeat their advice, BUILD on it or
respectfully disagree if your expertise tells you otherwise.

${otherMembers.slice(0, 5).map(f =>
    `- **${f.member_name}**: ${f.summary}${f.topic_tags?.length ? ` [${f.topic_tags.join(', ')}]` : ''}`
  ).join('\n')}

You are aware of your colleagues' counsel. Reference it when relevant:
"I see Griffin raised concerns about runway — I want to add..."
"Building on what Athena suggested about market positioning..."
`;
}

// ============================================================================
// PHASE 0: RECENT DECISIONS (Layer 6)
// ============================================================================

export function formatRecentDecisions(
  decisions?: Array<{ decision: string; member_slug: string; category: string; created_at: string }>,
): string {
  if (!decisions || decisions.length === 0) return '';

  return `
## ACTIVE BOARD DECISIONS
These decisions were recently made. Factor them into your advice —
don't contradict active decisions without acknowledging the conflict.

${decisions.slice(0, 5).map(d =>
    `- [${d.category}] ${d.decision} (by ${d.member_slug}, ${d.created_at.split('T')[0]})`
  ).join('\n')}
`;
}

// ============================================================================
// SPRINT 3: MEETING SUMMARIES (Layer 9)
// ============================================================================

export function formatMeetingSummaries(
  summaries?: MeetingSummary[],
  currentMemberSlug?: string,
): string {
  if (!summaries || summaries.length === 0) return '';

  const blocks = summaries.slice(0, 3).map(meeting => {
    const date = meeting.compressed_at
      ? new Date(meeting.compressed_at).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
        })
      : 'Recent';

    const lines: string[] = [];
    lines.push(`### Board Meeting — ${date}`);

    if (meeting.user_message) {
      const truncated = meeting.user_message.length > 200
        ? meeting.user_message.substring(0, 200) + '...'
        : meeting.user_message;
      lines.push(`**CEO asked:** "${truncated}"`);
    }

    lines.push(meeting.summary);

    const myPosition = currentMemberSlug
      ? meeting.member_positions?.[currentMemberSlug]
      : null;
    if (myPosition) {
      lines.push(`**Your position in this meeting:** ${myPosition}`);
    }

    const otherPositions = Object.entries(meeting.member_positions || {})
      .filter(([slug]) => slug !== currentMemberSlug)
      .slice(0, 4);
    if (otherPositions.length > 0) {
      lines.push('**Colleague positions:**');
      for (const [slug, position] of otherPositions) {
        lines.push(`- **${slug}**: ${position}`);
      }
    }

    const decisions = meeting.decisions_made || [];
    if (decisions.length > 0) {
      lines.push('**Decisions reached:**');
      for (const d of decisions.slice(0, 3)) {
        lines.push(`- ${d.decision} (${d.confidence})`);
      }
    }

    const disagreements = meeting.disagreements || [];
    if (disagreements.length > 0) {
      lines.push('**Unresolved tensions:**');
      for (const d of disagreements.slice(0, 2)) {
        const sidesSummary = Object.entries(d.sides || {})
          .map(([slug, pos]) => `${slug}: "${pos}"`)
          .join(' vs. ');
        lines.push(`- ${d.topic}: ${sidesSummary}${d.resolution ? ` → Resolved: ${d.resolution}` : ''}`);
      }
    }

    return lines.join('\n');
  });

  return `
## RECENT BOARD MEETINGS
You participated in these full board meetings. Reference them naturally —
acknowledge your own previous positions, build on colleague input,
and note any unresolved tensions that relate to the current discussion.

${blocks.join('\n\n---\n\n')}
`;
}

// ============================================================================
// LEGACY FORMATTERS (backward compat for tasks.ts / briefing.ts)
// ============================================================================

export function formatCompanyContext(context?: string): string {
  if (!context) return '';
  return `
## COMPANY CONTEXT
${context}
`;
}

export function formatLegacyMemories(memories?: Array<{ type: string; content: string }>): string {
  if (!memories || memories.length === 0) return '';
  return `
## YOUR MEMORIES OF THIS CEO
Previous interactions and key information:
${memories.map(m => `- [${m.type}] ${m.content}`).join('\n')}

Use these memories to provide personalized, contextual advice.
`;
}

export function formatConversationHistory(history: Array<{ role: string; content: string }>): string {
  if (history.length === 0) return '';

  const recent = history.slice(-10);

  return `
## CONVERSATION SO FAR
${recent.map(h => {
    const speaker = h.role === 'user' ? 'CEO' : 'Board';
    return `**${speaker}**: ${h.content.substring(0, 500)}${h.content.length > 500 ? '...' : ''}`;
  }).join('\n\n')}
`;
}