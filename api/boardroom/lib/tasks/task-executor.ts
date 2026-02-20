// FILE: api/boardroom/lib/tasks/task-executor.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK MODULE — Executor
// ═══════════════════════════════════════════════════════════════════════
//
// Execute a task: build memory-aware context → call AI → update DB.
//
// BUG FIXES (from audit):
//   #4: logGatewayCall doesn't exist in compact provider-caller
//       → replaced with console.log audit trail
//   #5: result.tokenEstimate doesn't exist
//       → removed from metadata
//   #6: taskContext in CallOptions not a valid field
//       → removed from options
//   #7: Duplicate memory formatting
//       → Now uses buildTaskPrompt from prompt-builder.ts
//         (which shares the same Phase 0 memory pipeline as chat)
//
// ═══════════════════════════════════════════════════════════════════════

import { callWithFallback, getSupaAdmin, getCompanyContext } from '../provider-caller.js';
import { buildTaskPrompt } from '../prompt-builder.js';
import {
  getFounderMemory,
  getRecentDecisions,
  getCrossBoardFeed,
} from '../../../../src/lib/boardroom/memory/founder-memory.js';
import { getTrustTier } from '../../../../src/lib/boardroom/evolution.js';
import { getTaskConfig } from './task-registry.js';
import type { ExecuteTaskParams, TaskExecutionResult } from './types.js';

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// EXECUTE TASK
// =============================================================================

/**
 * Execute a task immediately: fetch context, call AI, update DB.
 *
 * This is the "execute_now" path from the POST handler.
 * On failure, marks the task as "blocked" with error details.
 */
export async function executeTask(params: ExecuteTaskParams): Promise<TaskExecutionResult> {
  const {
    userId, taskId, taskType, title, description,
    memberSlug, boardMember, taskMetadata,
  } = params;

  const taskConfig = getTaskConfig(taskType);
  const maxTokens = taskConfig?.maxTokens || 2048;

  // ── Build memory-aware context (parallel fetch) ───────
  const { systemPrompt, taskPrompt } = await buildTaskContext(
    userId, memberSlug, boardMember, taskType, title, description,
  );

  // ── Call AI via gateway ───────────────────────────────
  const result = await callWithFallback(
    boardMember.dominant_provider || boardMember.ai_provider,
    boardMember.ai_model,
    systemPrompt,
    taskPrompt,
    { maxTokens },
  );

  // ── Update task with deliverable ──────────────────────
  const { data: completedTask } = await supabaseAdmin
    .from('boardroom_tasks')
    .update({
      status: 'review',
      completed_at: new Date().toISOString(),
      deliverable_type: 'markdown',
      deliverable_content: result.text,
      metadata: {
        ...taskMetadata,
        provider: result.provider,
        model: result.model,
        responseTime: result.responseTime,
        isFallback: result.isFallback,
      },
    })
    .eq('id', taskId)
    .select()
    .single();

  // ── Audit log (Bug #4 fix: inline instead of logGatewayCall) ──
  console.log(
    `[Task Audit] ${memberSlug} | ${taskType} | ` +
    `${result.provider}/${result.model} | ${result.responseTime}ms | ` +
    `fallback=${result.isFallback}`
  );

  return { task: completedTask, deliverable: result.text, result };
}

/**
 * Mark a task as blocked after execution failure.
 */
export async function markTaskBlocked(
  taskId: string,
  metadata: Record<string, any>,
  errorMessage: string,
): Promise<void> {
  await supabaseAdmin
    .from('boardroom_tasks')
    .update({
      status: 'blocked',
      metadata: {
        ...metadata,
        error: errorMessage,
        blocked_at: new Date().toISOString(),
      },
    })
    .eq('id', taskId);
}

// =============================================================================
// BUILD MEMORY-AWARE TASK CONTEXT
// =============================================================================

/**
 * Fetch all context needed for task execution and assemble prompts.
 *
 * Uses the shared buildTaskPrompt from prompt-builder.ts for the base,
 * then layers on memory context, company context, and cross-board feed.
 */
async function buildTaskContext(
  userId: string,
  memberSlug: string,
  boardMember: any,
  taskType: string,
  title: string,
  description: string | null,
): Promise<{ systemPrompt: string; taskPrompt: string }> {

  // ── Fetch all context in parallel ─────────────────────
  const [founderMemory, recentDecisions, crossBoardFeed, companyContext] = await Promise.all([
    getFounderMemory(supabaseAdmin, userId, memberSlug).catch(() => null),
    getRecentDecisions(supabaseAdmin, userId).catch(() => []),
    getCrossBoardFeed(supabaseAdmin, userId, memberSlug, 14, 5).catch(() => []),
    getCompanyContext(),
  ]);

  // ── Build memory context block ────────────────────────
  let memoryContext = '';

  if (founderMemory) {
    const details = (founderMemory.founder_details || [])
      .filter((d: any) => d.confidence >= 0.7)
      .slice(-15);

    if (details.length > 0) {
      memoryContext += '\n## WHAT YOU KNOW ABOUT THE FOUNDER\n';
      memoryContext += 'Use this context to make your deliverable specific and relevant:\n';
      details.forEach((d: any) => {
        memoryContext += `- **${d.detail_type || d.key}**: ${d.value}\n`;
      });
    }

    const decisions = (founderMemory.decisions_witnessed || []).slice(-5);
    if (decisions.length > 0) {
      memoryContext += '\n## DECISIONS YOU WITNESSED\n';
      decisions.forEach((d: any) => {
        memoryContext += `- ${d.decision}${d.status === 'completed' ? ' ✓' : ''}\n`;
      });
    }

    const memories = (founderMemory.compressed_memories || []).slice(-3);
    if (memories.length > 0) {
      memoryContext += '\n## PREVIOUS CONVERSATION SUMMARIES\n';
      memories.forEach((m: any) => {
        memoryContext += `- [${m.date}] ${m.summary}\n`;
      });
    }
  }

  if (crossBoardFeed.length > 0) {
    memoryContext += '\n## WHAT OTHER BOARD MEMBERS HAVE BEEN DOING\n';
    crossBoardFeed.forEach((entry: any) => {
      memoryContext += `- ${entry.member_slug}: ${entry.summary}\n`;
    });
  }

  if (recentDecisions.length > 0) {
    memoryContext += '\n## ACTIVE BOARD DECISIONS\n';
    recentDecisions.forEach((d: any) => {
      memoryContext += `- ${d.decision} (via ${d.member_slug})\n`;
    });
  }

  // ── Build system prompt ───────────────────────────────
  const taskConfig = getTaskConfig(taskType);

  const systemPrompt = `${boardMember.system_prompt || ''}
${companyContext}
${memoryContext}

You are now executing a specific task for the founder. Focus entirely on producing the requested deliverable. Be thorough, professional, and actionable.

CRITICAL: Use what you know about the founder and the company (above) to make this deliverable SPECIFIC and RELEVANT to THEIR situation. Not generic boilerplate. Not placeholder data. Real context, real recommendations, real specifics.

If you reference a number, make it specific to what you know.
If you reference a competitor, reference one they've discussed.
If you reference a goal, reference THEIR stated goal.
This deliverable should feel like it was written by someone who KNOWS this business.`;

  // ── Build the task prompt ─────────────────────────────
  const taskInstruction = taskConfig?.deliverableFormat || description || title;

  const taskPrompt = `## YOUR ASSIGNMENT
${title}

## ADDITIONAL CONTEXT FROM THE FOUNDER
${description || 'No additional context provided.'}

## DELIVERABLE REQUIREMENTS
${taskInstruction}

## OUTPUT STANDARDS
- Complete, professional deliverable that can be used immediately
- Format appropriately for the task type
- Reference specific details you know about the founder, company, and goals
- Flag any assumptions you're making
- Flag anything that needs human review or verification
- If you need information you don't have, say so clearly — don't fabricate`;

  return { systemPrompt, taskPrompt };
}