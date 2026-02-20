// FILE: api/boardroom/lib/tasks/types.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK MODULE — Types & Configuration
// ═══════════════════════════════════════════════════════════════════════

import type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
import type { ProviderCallResult } from '../provider-caller.js';

// =============================================================================
// TASK INSTRUCTION CONFIG
// =============================================================================

/** Static config for each task type in the registry */
export interface TaskInstruction {
  /** Human-readable description */
  description: string;
  /** Detailed deliverable format instructions sent to the AI */
  deliverableFormat: string;
  /** Default board member slug to assign this task type to */
  defaultAssignee: string;
  /** Max tokens for AI response (bigger deliverables need more) */
  maxTokens: number;
  /** Minimum trust level required to execute this task type */
  requiresTrust: number;
}

// =============================================================================
// HANDLER TYPES
// =============================================================================

/** Parsed POST request body for task creation */
export interface CreateTaskBody {
  assigned_to: string;
  title: string;
  description?: string;
  task_type: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  execute_now?: boolean;
  deadline?: string;
}

/** Parsed PATCH request body for task updates */
export interface UpdateTaskBody {
  id: string;
  action?: 'approve' | 'reject' | 'request_revision' | 'execute';
  ceo_feedback?: string;
  status?: string;
}

// =============================================================================
// EXECUTOR TYPES
// =============================================================================

/** Parameters for task execution */
export interface ExecuteTaskParams {
  userId: string;
  taskId: string;
  taskType: string;
  title: string;
  description: string | null;
  memberSlug: string;
  boardMember: BoardMember;
  taskMetadata: Record<string, any>;
}

/** Result of task execution */
export interface TaskExecutionResult {
  task: any;
  deliverable: string;
  result: ProviderCallResult;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
export type { ProviderCallResult } from '../provider-caller.js';