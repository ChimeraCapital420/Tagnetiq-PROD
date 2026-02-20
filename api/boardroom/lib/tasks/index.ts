// FILE: api/boardroom/lib/tasks/index.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK MODULE — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════

// ── Types ───────────────────────────────────────────────
export type {
  TaskInstruction,
  CreateTaskBody,
  UpdateTaskBody,
  ExecuteTaskParams,
  TaskExecutionResult,
} from './types.js';

// ── Task Registry ───────────────────────────────────────
export {
  TASK_INSTRUCTIONS,
  getAvailableTaskTypes,
  isValidTaskType,
  getTaskConfig,
} from './task-registry.js';

// ── Executor ────────────────────────────────────────────
export {
  executeTask,
  markTaskBlocked,
} from './task-executor.js';