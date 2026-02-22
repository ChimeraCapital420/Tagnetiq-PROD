// FILE: api/boardroom/lib/prompt-builder/elevation.ts
// ═══════════════════════════════════════════════════════════════════════
// ELEVATION PROTOCOL INTEGRATION
// ═══════════════════════════════════════════════════════════════════════
//
// Maps board members to their specialized thinking frameworks.
// Each member has primary protocols that shape how they approach problems.
//
// ═══════════════════════════════════════════════════════════════════════

import {
  MEMBER_PROTOCOL_AFFINITIES,
  getProtocolById,
  detectActiveProtocols,
  type ElevationProtocol,
} from '../elevation-protocols.js';

import type { BoardMember } from './types.js';

// ============================================================================
// MEMBER-SPECIFIC PROTOCOL PROMPT
// ============================================================================

export function getMemberProtocolPrompt(member: BoardMember): string {
  const affinity = MEMBER_PROTOCOL_AFFINITIES.find(a => a.memberSlug === member.slug);

  if (!affinity) {
    return getUniversalProtocolPrompt();
  }

  const primaryProtocols = affinity.primaryProtocols
    .map(id => getProtocolById(id))
    .filter(Boolean) as ElevationProtocol[];

  return `
## YOUR ELEVATION PROTOCOLS

You are elevated beyond standard AI capabilities through specialized frameworks:

### Primary Protocols (Lead with these):
${primaryProtocols.map(p => `
**${p.icon} ${p.name}**
${p.corePrinciples.slice(0, 3).map(c => `- ${c}`).join('\n')}
`).join('\n')}

### Your Unique Application:
${affinity.uniqueApplication}

### Protocol Activation:
When responding, automatically weave relevant frameworks into your advice.
Don't just answer—transform how the CEO thinks about the problem.
`;
}

// ============================================================================
// UNIVERSAL FALLBACK PROTOCOL
// ============================================================================

export function getUniversalProtocolPrompt(): string {
  return `
## ELEVATION PROTOCOLS

You are equipped with advanced thinking frameworks:

1. **First Principles**: Break problems to fundamental truths
2. **Asymmetric Leverage**: Seek 100x upside with 1x downside
3. **Decade Thinking**: Optimize for 10-year impact
4. **Identity Transformation**: Help them become who they need to be
5. **Systems Over Goals**: Build machines that produce outcomes
6. **80/20 Ruthlessness**: Focus only on what matters most
`;
}

// ============================================================================
// ACTIVE PROTOCOL DETECTION (from user message)
// ============================================================================

export function getActiveProtocolGuidance(userMessage: string): string {
  const activeProtocols = detectActiveProtocols(userMessage);

  if (activeProtocols.length === 0) {
    return '';
  }

  return `
## DETECTED PROTOCOL ACTIVATION

Based on the CEO's message, consider applying these frameworks:
${activeProtocols.map(p => `
**${p.icon} ${p.name}**
Consider using this output structure:
${p.outputFramework}
`).join('\n')}
`;
}