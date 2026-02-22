// FILE: api/boardroom/lib/prompt-builder/builder.ts
// ═══════════════════════════════════════════════════════════════════════
// 9-LAYER PROMPT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════
//
// The main builder. Takes PromptContext, assembles all 9 layers into
// a system prompt + user prompt pair.
//
// LAYERS:
//   1. Identity      — Name, title, expertise, personality, voice
//                      + evolved personality (Sprint 4)
//   2. Elevation     — Billionaire mental models + member protocols
//   3. Memory        — Founder details from past conversations
//   4. Energy        — CEO's current emotional state
//   5. Cross-Board   — What other members recently discussed
//   6. Decisions     — Recent board decisions
//   7. Meeting Type  — Context modifier (1:1, committee, vote, etc.)
//   8. Voice         — Communication style directives
//   9. Meetings      — Shared memory from full board meetings
//
// ═══════════════════════════════════════════════════════════════════════

import { BILLIONAIRE_CORE, MEETING_MODIFIERS } from './constants.js';
import { getMemberProtocolPrompt, getActiveProtocolGuidance } from './elevation.js';
import {
  formatPersonalityEvolution,
  formatFounderMemory,
  formatEnergyGuidance,
  formatCrossBoardFeed,
  formatRecentDecisions,
  formatMeetingSummaries,
  formatCompanyContext,
  formatLegacyMemories,
  formatConversationHistory,
} from './formatters.js';
import type { PromptContext } from './types.js';

// ============================================================================
// MAIN PROMPT BUILDER — 9-Layer Assembly
// ============================================================================

export function buildBoardMemberPrompt(context: PromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const {
    member, userMessage, meetingType, conversationHistory,
    // Phase 0 fields
    founderMemory, founderEnergy, founderArc,
    crossBoardFeed, recentDecisions,
    // Sprint 3 field
    meetingSummaries,
    // Legacy fields
    companyContext, memories,
  } = context;

  // ── Layer 1: Identity + Evolved Personality (Sprint 4) ─
  const evolvedBlock = formatPersonalityEvolution(
    member.personality_evolution,
    member.name,
  );

  const identityBlock = `
# ${member.name.toUpperCase()} - ${member.title}
## AI Board of Directors | Executive Boardroom

You are ${member.name}, serving as ${member.title} on this executive AI Board of Directors.
You advise the CEO with the strategic depth of history's greatest business minds.

### YOUR EXPERTISE:
${(member.expertise || []).map(e => `- ${e}`).join('\n')}

### YOUR PERSONALITY:
${member.personality?.style || 'Direct, insightful, and action-oriented'}
Voice: ${member.voice_style || 'Professional but warm'}
${evolvedBlock}
`;

  // ── Layer 2: Elevation Protocols ──────────────────────
  const elevationBlock = `${BILLIONAIRE_CORE}\n${getMemberProtocolPrompt(member)}`;

  // ── Layer 3: Memory (Phase 0 → legacy fallback) ──────
  const memoryBlock = founderMemory
    ? formatFounderMemory(founderMemory)
    : formatLegacyMemories(memories);

  // ── Layer 4: Energy Adaptation ────────────────────────
  const energyBlock = formatEnergyGuidance(founderEnergy, founderArc);

  // ── Layer 5: Cross-Board Feed ─────────────────────────
  const feedBlock = formatCrossBoardFeed(crossBoardFeed, member.slug);

  // ── Layer 6: Recent Decisions ─────────────────────────
  const decisionsBlock = formatRecentDecisions(recentDecisions);

  // ── Layer 7: Meeting Type ─────────────────────────────
  const meetingBlock = MEETING_MODIFIERS[meetingType] || '';

  // ── Layer 8: Voice / Response Guidelines ──────────────
  const voiceBlock = `
### RESPONSE GUIDELINES:
- **Be Direct**: No corporate fluff. Say what you mean.
- **Be Bold**: Recommend what's right, not what's safe.
- **Be Specific**: Give exact numbers, names, timelines.
- **Be Transformational**: Leave them thinking differently.
- **Challenge Assumptions**: Question what they didn't know to question.
- **End with Action**: Always provide a specific next step.

${formatCompanyContext(companyContext)}

---
Your goal is not just to advise, but to ELEVATE the CEO's thinking permanently.
Every response should leave them at a higher level than before.
`;

  // ── Layer 9: Board Meeting Summaries (Sprint 3) ───────
  const meetingsBlock = formatMeetingSummaries(meetingSummaries, member.slug);

  // ── Assemble system prompt ────────────────────────────
  const systemPrompt = [
    identityBlock,
    elevationBlock,
    memoryBlock,
    energyBlock,
    feedBlock,
    decisionsBlock,
    meetingBlock,
    voiceBlock,
    meetingsBlock,
  ]
    .filter(block => block.trim().length > 0)
    .join('\n')
    .trim();

  // ── Assemble user prompt ──────────────────────────────
  const protocolGuidance = getActiveProtocolGuidance(userMessage);

  const userPrompt = `
${formatConversationHistory(conversationHistory)}

## CEO'S MESSAGE:
${userMessage}

${protocolGuidance}

Respond as ${member.name}, bringing your unique expertise and elevation protocols to bear.
`.trim();

  return { systemPrompt, userPrompt };
}