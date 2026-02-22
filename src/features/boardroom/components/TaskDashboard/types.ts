// FILE: src/features/boardroom/components/TaskDashboard/types.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK DASHBOARD TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

import type {
  BoardMember,
  BoardroomTask,
  TaskStatus,
  TaskPriority,
  CreateTaskParams,
  QuickTask,
  TaskResult,
  MemberWorkload,
} from '../../types';

// Re-export for sub-components
export type {
  BoardMember,
  BoardroomTask,
  TaskStatus,
  TaskPriority,
  CreateTaskParams,
  QuickTask,
  TaskResult,
  MemberWorkload,
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface TaskDashboardProps {
  /** Board members for assignment dropdown + avatar display */
  members: BoardMember[];
  /** Full task list from useTasks hook */
  tasks: BoardroomTask[];
  /** Whether task list is loading */
  isLoadingTasks: boolean;
  /** Current status filter */
  activeFilter: TaskStatus | 'all';
  /** Quick task results (legacy) */
  taskResults: TaskResult[];
  /** Which quick task is loading */
  loadingTaskId: string | null;
  /** Per-member workload data from boardroomData.tasks.by_member */
  memberWorkload?: Record<string, MemberWorkload>;
  /** Pending task count from stats */
  pendingCount?: number;
  /** Resolve slug → member */
  getMemberBySlug: (slug: string) => BoardMember | undefined;

  // Actions
  onFetchTasks: (filter?: TaskStatus | 'all') => Promise<void>;
  onSetFilter: (filter: TaskStatus | 'all') => void;
  onCreateTask: (params: CreateTaskParams) => Promise<BoardroomTask | null>;
  onExecuteQuickTask: (task: QuickTask) => Promise<void>;
  onUpdateTask: (id: string, action: string, feedback?: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onClearResults: () => void;
}