// FILE: api/boardroom/lib/tasks.ts
// Flat barrel — bridges './tasks.js' imports to the ./tasks/ folder.
export type { TaskInstruction, CreateTaskBody, UpdateTaskBody, ExecuteTaskParams, TaskExecutionResult } from './tasks/types.js';
export { TASK_INSTRUCTIONS, getAvailableTaskTypes, isValidTaskType, getTaskConfig } from './tasks/task-registry.js';
export { executeTask, markTaskBlocked } from './tasks/task-executor.js';