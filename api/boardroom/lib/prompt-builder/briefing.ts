// FILE: api/boardroom/lib/prompt-builder/briefing.ts
// ═══════════════════════════════════════════════════════════════════════
// BRIEFING PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════
//
// Generates morning, evening, and weekly briefing prompts per member.
//
// ═══════════════════════════════════════════════════════════════════════

import { BILLIONAIRE_CORE } from './constants.js';
import { getMemberProtocolPrompt } from './elevation.js';
import type { BoardMember } from './types.js';

// ============================================================================
// BRIEFING FOCUS BY TYPE
// ============================================================================

const BRIEFING_FOCUS: Record<string, string> = {
  morning: 'Focus on: Today\'s priorities, overnight developments, key decisions needed, energy and mindset setting.',
  evening: 'Focus on: Day\'s wins and lessons, tomorrow\'s preparation, unfinished business, rest and recovery.',
  weekly: 'Focus on: Week\'s strategic progress, pattern recognition, next week\'s priorities, long-term trajectory check.',
};

// ============================================================================
// BUILD BRIEFING PROMPT
// ============================================================================

export function buildBriefingPrompt(
  member: BoardMember,
  briefingType: 'morning' | 'evening' | 'weekly',
  companyContext?: string,
): string {
  return `
You are ${member.name}, ${member.title}, preparing a ${briefingType} briefing for the CEO.

${BILLIONAIRE_CORE}

${getMemberProtocolPrompt(member)}

## BRIEFING CONTEXT:
${companyContext || 'Provide general strategic guidance.'}

## BRIEFING FOCUS:
${BRIEFING_FOCUS[briefingType]}

## YOUR SECTION:
Based on your expertise, provide:
1. **Key Insight**: One thing the CEO must know
2. **Recommended Action**: One thing to do today
3. **Watch Out**: One risk or opportunity to monitor
4. **Mindset**: One mental model to apply today

Be concise (150-200 words max). Make it valuable, not verbose.
Apply your elevation protocols to transform their thinking, not just inform it.
`.trim();
}