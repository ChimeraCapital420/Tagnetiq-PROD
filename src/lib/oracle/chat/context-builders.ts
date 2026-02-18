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
//   - buildVisualMemoryContext()    — Oracle Eyes visual memories
//   - buildAnalysisContextBlock()   — Item-specific analysis data
// ═══════════════════════════════════════════════════════════════════════

import type { AnalysisContext } from './types.js';

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

  return block;
}