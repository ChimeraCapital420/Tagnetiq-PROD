// FILE: src/lib/oracle/chat/context-builders.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat — Context Block Builders
// ═══════════════════════════════════════════════════════════════════════
// Extracted from chat.ts monolith (Phase 1).
// Pure functions — no side effects, no DB calls.
//
// These build text blocks that get injected into the system prompt.
// Each returns a string (empty string if no data).
//
// Contains:
//   - buildVisualMemoryContext()       — Oracle Eyes visual memories
//   - buildAnalysisContextBlock()      — Item-specific analysis data
//   - buildProviderReportContext()     — v11.0: Provider report tap awareness
// ═══════════════════════════════════════════════════════════════════════

import type { AnalysisContext } from './types.js';

// =============================================================================
// PROVIDER REPORT CONTEXT (v11.0 — Oracle-Aware Report Reading)
// =============================================================================

/**
 * Context event shape written by ProviderReportSheet to sessionStorage,
 * read by the client chat hook, and passed here via request body.
 */
export interface ProviderReportEvent {
  type: 'provider_report_opened';
  provider: string;
  itemName: string;
  providerValue: number;
  consensusValue: number;
  providerDecision?: string;
  consensusDecision?: string;
  timestamp: number;
}

/**
 * Build a system prompt block when the user recently tapped a provider
 * report card. This gives Oracle awareness of the user's curiosity
 * about specific provider reasoning.
 *
 * Data flow: ProviderReportSheet → sessionStorage → client chat hook →
 *            request body → this function → system prompt injection.
 *
 * Cost: $0. All client-side data, no API calls.
 *
 * @param event - Provider report event from client (null if none)
 * @returns Prompt block string (empty if no event or stale)
 */
export function buildProviderReportContext(event: ProviderReportEvent | null): string {
  if (!event) return '';
  if (event.type !== 'provider_report_opened') return '';

  // Only inject if event is within last 5 minutes
  const ageMs = Date.now() - (event.timestamp || 0);
  if (ageMs > 5 * 60 * 1000) return '';

  const provider = event.provider || 'an AI provider';
  const itemName = event.itemName || 'an item';
  const providerValue = typeof event.providerValue === 'number' ? `$${event.providerValue.toFixed(2)}` : 'unknown';
  const consensusValue = typeof event.consensusValue === 'number' ? `$${event.consensusValue.toFixed(2)}` : 'unknown';

  let block = '\n\n## RECENT USER ACTION — Provider Report Examined\n';
  block += `The user just examined ${provider}'s individual report on "${itemName}".\n`;
  block += `${provider} estimated ${providerValue} while consensus was ${consensusValue}.\n`;

  if (event.providerDecision && event.consensusDecision) {
    const match = event.providerDecision.toUpperCase() === event.consensusDecision.toUpperCase();
    if (match) {
      block += `Both ${provider} and the consensus recommend ${event.consensusDecision}.\n`;
    } else {
      block += `${provider} says ${event.providerDecision} but consensus says ${event.consensusDecision} — the user may be curious why.\n`;
    }
  }

  block += '\nThe user is curious about AI reasoning. You can:\n';
  block += `- Reference ${provider}'s analysis naturally if relevant\n`;
  block += '- Offer to explain why providers disagreed\n';
  block += '- Compare this provider\'s reasoning to others\n';
  block += '- Help them understand which AI to trust and why\n';
  block += 'Don\'t force it — mention it naturally if relevant to conversation flow.\n';

  return block;
}

// =============================================================================
// VISUAL MEMORY CONTEXT (Oracle Eyes — Sprint M)
// =============================================================================

/**
 * Build a system prompt block from visual memories captured by Oracle Eyes.
 * This gives the Oracle awareness of what it has physically "seen" through
 * the user's camera — receipts, rooms, items, documents, etc.
 *
 * Used for recall questions like "Where did I put my keys?" or
 * "What did that receipt say?"
 *
 * @param visualMemories - Array of oracle_visual_memory rows
 * @returns Prompt block string (empty if no memories)
 */
export function buildVisualMemoryContext(visualMemories: any[]): string {
  if (!visualMemories || visualMemories.length === 0) return '';

  let context = '\n\n## ORACLE VISUAL MEMORY — What You Have Seen\n';
  context += 'You have visual memories from looking through the user\'s camera/glasses. ';
  context += 'Use these to answer questions like "where did I put X?", "what did that article say?", ';
  context += '"what was in that room?". Reference specific details — timestamps, positions, descriptions.\n\n';

  for (const mem of visualMemories) {
    const when = new Date(mem.observed_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    context += `---\n`;
    context += `SEEN: ${when}\n`;
    context += `MODE: ${mem.mode}\n`;
    context += `DESCRIPTION: ${mem.description}\n`;

    if (mem.location_hint) {
      context += `LOCATION: ${mem.location_hint}\n`;
    }

    if (mem.objects && Array.isArray(mem.objects) && mem.objects.length > 0) {
      context += `OBJECTS: ${mem.objects.map((o: any) =>
        `${o.name}${o.position_hint ? ` [${o.position_hint}]` : ''}${o.estimated_value ? ` ~$${o.estimated_value}` : ''}`
      ).join(', ')}\n`;
    }

    if (mem.extracted_text) {
      const textPreview = mem.extracted_text.length > 500
        ? mem.extracted_text.substring(0, 500) + '... [truncated]'
        : mem.extracted_text;
      context += `TEXT CONTENT: ${textPreview}\n`;
    }

    context += `SOURCE: ${mem.source || 'phone_camera'}\n\n`;
  }

  if (visualMemories.length >= 30) {
    context += '(Showing most recent 30 visual memories. Older ones exist but are not shown.)\n';
  }

  return context;
}

// =============================================================================
// ANALYSIS CONTEXT BLOCK (ask.ts compatibility / item-specific conversations)
// =============================================================================

/**
 * Build a system prompt block for item-specific analysis context.
 * This is injected when the user is asking follow-up questions about
 * a specific item they recently analyzed (e.g. from the scan results page).
 *
 * @param analysisContext - Analysis data for the item being discussed
 * @returns Prompt block string (empty if no context)
 */
export function buildAnalysisContextBlock(analysisContext: AnalysisContext | null): string {
  if (!analysisContext) return '';

  let block = '\n\n## ITEM CONTEXT — What The User Is Asking About\n';
  block += 'The user is asking about a specific item they analyzed. Use this data to inform your response.\n\n';

  if (analysisContext.itemName) {
    block += `Item: ${analysisContext.itemName}\n`;
  }
  if (analysisContext.estimatedValue !== undefined) {
    block += `Estimated Value: $${analysisContext.estimatedValue}\n`;
  }
  if (analysisContext.summary_reasoning) {
    block += `Analysis Summary: ${analysisContext.summary_reasoning}\n`;
  }
  if (Array.isArray(analysisContext.valuation_factors) && analysisContext.valuation_factors.length > 0) {
    block += `Key Valuation Factors: ${analysisContext.valuation_factors.join('; ')}\n`;
  }
  if (analysisContext.category) {
    block += `Category: ${analysisContext.category}\n`;
  }
  if (analysisContext.confidence !== undefined) {
    block += `Confidence: ${analysisContext.confidence}%\n`;
  }

  // v11.0: Include individual provider vote summaries if available
  if (analysisContext.providerVotes && Array.isArray(analysisContext.providerVotes)) {
    block += '\nIndividual Provider Assessments:\n';
    for (const vote of analysisContext.providerVotes) {
      if (!vote || !vote.providerName) continue;
      block += `  - ${vote.providerName}: $${vote.estimatedValue?.toFixed?.(2) ?? '?'} ${vote.decision || '?'} (confidence: ${typeof vote.confidence === 'number' ? (vote.confidence > 1 ? vote.confidence : Math.round(vote.confidence * 100)) + '%' : '?'})`;
      if (vote.rawResponse?.summary_reasoning) {
        block += ` — ${vote.rawResponse.summary_reasoning.substring(0, 120)}`;
      }
      block += '\n';
    }
    block += 'You can compare providers when the user asks which AI to trust or why they disagreed.\n';
  }

  return block;
}