// FILE: src/features/boardroom/components/TaskDashboard/index.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK DASHBOARD — BARREL EXPORTS
// ═══════════════════════════════════════════════════════════════════════
//
// REFACTORED from single 580-line monolith into modular files:
//
//   types.ts            → Props & re-exported boardroom types
//   constants.tsx        → Status configs, task types, helpers, CopyButton
//   StatusTabs.tsx       → Filter pill tabs
//   TaskCreator.tsx      → Custom task creation form
//   TaskCard.tsx         → Individual task card with actions
//   WorkloadSidebar.tsx  → Per-member workload progress bars
//   QuickTaskSection.tsx → Preset one-click tasks
//   TaskDashboard.tsx    → Slim orchestrator
//
// IMPORT CONTRACT: Existing imports remain unchanged:
//
//   import { TaskDashboard } from './TaskDashboard';
//   import TaskDashboard from './TaskDashboard';
//
// ═══════════════════════════════════════════════════════════════════════

export { TaskDashboard, default } from './TaskDashboard';
export type { TaskDashboardProps } from './types';