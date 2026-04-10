// FILE: api/boardroom/lib/prompt-builder/builder.ts
// ═══════════════════════════════════════════════════════════════════════
// 10-LAYER PROMPT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════
//
// LAYERS:
//   1. Identity      — Name, title, expertise, personality, voice
//   2. Elevation     — Billionaire mental models + member protocols
//   3. Memory        — Founder details from past conversations
//   4. Energy        — CEO's current emotional state
//   5. Cross-Board   — What other members recently discussed
//   6. Decisions     — Recent board decisions
//   7. Meeting Type  — Context modifier
//   8. Voice         — Communication style + Inversion Principle
//   9. Meetings      — Shared memory from full board meetings
//  10. Media         — Documents, URLs, images (domain-filtered) ← NEW
//
// v9.1: Inversion Principle added to Layer 8.
// v10.0: Layer 10 — Media Intelligence.
//   When CEO attaches a document, URL, or image, each board member
//   receives the content pre-filtered through their domain expertise.
//   CFO sees cash flow. Legal sees liability. CSO sees strategy.
//   Same intelligence, 15 domain-filtered perspectives.
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
import { formatMediaAttachments, type MediaAttachment } from './media-context.js';
import type { PromptContext } from './types.js';

// ============================================================================
// UPDATED PROMPT CONTEXT — adds mediaAttachments
// ============================================================================

export interface ExtendedPromptContext extends PromptContext {
  mediaAttachments?: MediaAttachment[];
}

// ============================================================================
// MAIN PROMPT BUILDER — 10-Layer Assembly
// ============================================================================

export function buildBoardMemberPrompt(context: ExtendedPromptContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const {
    member, userMessage, meetingType, conversationHistory,
    founderMemory, founderEnergy, founderArc,
    crossBoardFeed, recentDecisions,
    meetingSummaries,
    companyContext, memories,
    mediaAttachments,   // v10.0
  } = context;

  // ── Layer 1: Identity + Evolved Personality ─────────
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

  // ── Layer 3: Memory ───────────────────────────────────
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
- **Apply Inversion**: Before finalizing any strategic recommendation,
  identify the top 3 ways this strategy commonly fails, then explain
  how your recommendation avoids each failure point. Name the mental
  model you're using (First Principles, Second-Order Thinking, etc.).
- **End with Action**: Always provide a specific next step.

${formatCompanyContext(companyContext)}

---
Your goal is not just to advise, but to ELEVATE the CEO's thinking permanently.
Every response should leave them at a higher level than before.
`;

  // ── Layer 9: Board Meeting Summaries ──────────────────
  const meetingsBlock = formatMeetingSummaries(meetingSummaries, member.slug);

  // ── Layer 10: Media Intelligence (v10.0) ──────────────
  // Domain-filtered document/URL/image content.
  // Each member sees the same content through their expertise lens.
  const mediaBlock = (mediaAttachments && mediaAttachments.length > 0)
    ? formatMediaAttachments(mediaAttachments, member)
    : '';

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
    mediaBlock,         // Layer 10 — last so it's freshest in context
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
${mediaBlock ? 'Reference the attached media in your response where relevant.' : ''}
`.trim();

  return { systemPrompt, userPrompt };
}