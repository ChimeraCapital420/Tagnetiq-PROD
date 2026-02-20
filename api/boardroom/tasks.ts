// FILE: api/boardroom/tasks.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD TASK SYSTEM — Thin Orchestrator
// ═══════════════════════════════════════════════════════════════════════
//
// BEFORE: ~500 lines — registry, context builder, executor, CRUD all
//         tangled. Adding a task type risked breaking execution.
//
// AFTER:  ~180 lines — validates, routes to CRUD handler, delegates
//         execution to lib/tasks/. All logic lives in:
//
//   api/boardroom/lib/tasks/
//   ├── index.ts              # Barrel exports
//   ├── types.ts              # All types
//   ├── task-registry.ts      # Static task configs (add new types here)
//   └── task-executor.ts      # Memory-aware execution + DB updates
//
// BUG FIXES:
//   #4: Removed logGatewayCall (doesn't exist in compact provider-caller)
//   #5: Removed result.tokenEstimate (doesn't exist in ProviderCallResult)
//   #6: Removed taskContext from CallOptions (not a valid field)
//   #7: Task context builder now uses consistent memory formatting
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { getSupaAdmin } from './lib/provider-caller.js';
import { getTrustTier, type BoardMember } from '../../src/lib/boardroom/evolution.js';
import {
  getAvailableTaskTypes,
  isValidTaskType,
  getTaskConfig,
  executeTask,
  markTaskBlocked,
} from './lib/tasks/index.js';

// ═══════════════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 60,
};

const supabaseAdmin = getSupaAdmin();

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level, subscription_tier')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required' });
    }

    switch (req.method) {
      case 'GET':    return handleGet(req, res, user.id);
      case 'POST':   return handlePost(req, res, user.id);
      case 'PATCH':  return handlePatch(req, res, user.id);
      case 'DELETE':  return handleDelete(req, res, user.id);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    const msg = error.message || 'An unexpected error occurred.';
    if (msg.includes('Authentication') || msg.includes('token')) {
      return res.status(401).json({ error: msg });
    }
    console.error('[Boardroom] Tasks error:', msg);
    return res.status(500).json({ error: msg });
  }
}

// =============================================================================
// GET — List tasks or get specific task
// =============================================================================

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  const { id, status, assigned_to, task_type, limit: queryLimit } = req.query;

  if (id) {
    const { data: task } = await supabaseAdmin
      .from('boardroom_tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    return task
      ? res.status(200).json(task)
      : res.status(404).json({ error: 'Task not found' });
  }

  let query = supabaseAdmin
    .from('boardroom_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status as string);
  if (assigned_to) query = query.eq('assigned_to', assigned_to as string);
  if (task_type) query = query.eq('task_type', task_type as string);

  const limit = Math.min(parseInt(queryLimit as string) || 50, 100);
  const { data: tasks } = await query.limit(limit);

  return res.status(200).json({
    tasks: tasks || [],
    count: (tasks || []).length,
    filters: { status, assigned_to, task_type },
  });
}

// =============================================================================
// POST — Create and optionally execute a task
// =============================================================================

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  const { assigned_to, title, description, task_type, priority, execute_now, deadline } = req.body;

  if (!assigned_to || !title || !task_type) {
    return res.status(400).json({
      error: 'Required: assigned_to (member slug), title, task_type',
      available_task_types: getAvailableTaskTypes(),
    });
  }

  if (!isValidTaskType(task_type)) {
    return res.status(400).json({
      error: `Unknown task_type: "${task_type}"`,
      available_task_types: getAvailableTaskTypes(),
    });
  }

  // Load assigned board member
  const { data: member } = await supabaseAdmin
    .from('boardroom_members')
    .select('*')
    .eq('slug', assigned_to)
    .single();

  if (!member) {
    return res.status(400).json({ error: `Board member '${assigned_to}' not found` });
  }

  const boardMember = member as BoardMember;
  const taskConfig = getTaskConfig(task_type)!;
  const memberTrust = boardMember.trust_level || 0;

  // Trust gating
  if (memberTrust < taskConfig.requiresTrust) {
    return res.status(403).json({
      error: `${boardMember.name} needs trust level ${taskConfig.requiresTrust}+ for ${task_type} tasks. Current: ${memberTrust} (${getTrustTier(memberTrust)}).`,
      suggestion: 'Build trust through more conversations and successful task completions.',
    });
  }

  // Create task record
  const taskMetadata = {
    member_name: boardMember.name,
    member_title: boardMember.title,
    trust_at_creation: memberTrust,
  };

  const { data: task, error: taskError } = await supabaseAdmin
    .from('boardroom_tasks')
    .insert({
      user_id: userId,
      assigned_to,
      title,
      description: description || title,
      task_type,
      priority: priority || 'normal',
      status: execute_now ? 'in_progress' : 'pending',
      started_at: execute_now ? new Date().toISOString() : null,
      deadline: deadline || null,
      metadata: taskMetadata,
    })
    .select()
    .single();

  if (taskError) {
    return res.status(500).json({ error: taskError.message });
  }

  // Execute immediately if requested
  if (execute_now) {
    try {
      const { task: completedTask, deliverable, result } = await executeTask({
        userId,
        taskId: task.id,
        taskType: task_type,
        title,
        description: description || null,
        memberSlug: assigned_to,
        boardMember,
        taskMetadata,
      });

      return res.status(200).json({
        task: completedTask,
        deliverable,
        member: { name: boardMember.name, title: boardMember.title, slug: boardMember.slug },
        _meta: {
          provider: result.provider,
          model: result.model,
          responseTime: result.responseTime,
          isFallback: result.isFallback,
          trustLevel: memberTrust,
          trustTier: getTrustTier(memberTrust),
        },
      });
    } catch (execError: any) {
      await markTaskBlocked(task.id, taskMetadata, execError.message);
      return res.status(500).json({
        error: `Task execution failed: ${execError.message}`,
        task_id: task.id,
        task_status: 'blocked',
      });
    }
  }

  return res.status(201).json({
    task,
    message: `Task assigned to ${boardMember.name}. Set execute_now: true to run immediately.`,
  });
}

// =============================================================================
// PATCH — Update task (feedback, approval, status, revision)
// =============================================================================

async function handlePatch(req: VercelRequest, res: VercelResponse, userId: string) {
  const { id, action, ceo_feedback, status } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Task ID required' });
  }

  const { data: currentTask } = await supabaseAdmin
    .from('boardroom_tasks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (!currentTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updates: any = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'approve':
      updates.status = 'approved';
      updates.ceo_approved = true;
      updates.ceo_feedback = ceo_feedback || 'Approved';
      break;
    case 'reject':
      updates.status = 'rejected';
      updates.ceo_approved = false;
      updates.ceo_feedback = ceo_feedback || 'Rejected';
      break;
    case 'request_revision':
      updates.status = 'revision_requested';
      updates.ceo_feedback = ceo_feedback || 'Please revise';
      break;
    case 'execute':
      if (currentTask.status !== 'pending') {
        return res.status(400).json({ error: `Cannot execute task in "${currentTask.status}" status` });
      }
      updates.status = 'in_progress';
      updates.started_at = new Date().toISOString();
      break;
    default:
      if (ceo_feedback !== undefined) updates.ceo_feedback = ceo_feedback;
      if (status !== undefined) updates.status = status;
  }

  const { data: updatedTask } = await supabaseAdmin
    .from('boardroom_tasks')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  return res.status(200).json(updatedTask);
}

// =============================================================================
// DELETE — Cancel task (soft delete)
// =============================================================================

async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Task ID required (query param)' });
  }

  const { data: task } = await supabaseAdmin
    .from('boardroom_tasks')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id as string)
    .eq('user_id', userId)
    .select()
    .single();

  return task
    ? res.status(200).json({ success: true, task })
    : res.status(404).json({ error: 'Task not found' });
}