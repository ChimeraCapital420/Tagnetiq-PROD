// FILE: src/features/boardroom/components/TaskDashboard/TaskDashboard.tsx
// ═══════════════════════════════════════════════════════════════════════
// TASK DASHBOARD — Orchestrator (slim)
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 8: Full task lifecycle UI.
// Refactored from 580-line monolith → sub-components.
//
// Mobile-first: single column, touch targets, collapsible sections.
// Desktop: 2-column layout (list + workload sidebar).
//
// API: api/boardroom/tasks.ts — GET, POST, PATCH, DELETE
// Hook: useTasks.ts
// ═══════════════════════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Briefcase } from 'lucide-react';
import { BoardroomErrorBoundary } from '../BoardroomErrorBoundary';
import { StatusTabs } from './StatusTabs';
import { TaskCreator } from './TaskCreator';
import { TaskCard } from './TaskCard';
import { WorkloadSidebar } from './WorkloadSidebar';
import { QuickTaskSection } from './QuickTaskSection';
import type { TaskDashboardProps } from './types';

// =============================================================================
// MAIN CONTENT
// =============================================================================

const TaskDashboardContent: React.FC<TaskDashboardProps> = ({
  members,
  tasks,
  isLoadingTasks,
  activeFilter,
  taskResults,
  loadingTaskId,
  memberWorkload,
  pendingCount,
  getMemberBySlug,
  onFetchTasks,
  onSetFilter,
  onCreateTask,
  onExecuteQuickTask,
  onUpdateTask,
  onDeleteTask,
  onClearResults,
}) => {
  // Fetch tasks on mount
  useEffect(() => {
    onFetchTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute status counts from current tasks
  const statusCounts: Record<string, number> = {};
  for (const t of tasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Tasks
          {pendingCount !== undefined && pendingCount > 0 && (
            <Badge variant="outline" className="text-xs text-yellow-400">
              {pendingCount} pending
            </Badge>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFetchTasks()}
          disabled={isLoadingTasks}
          className="gap-1.5 h-7 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${isLoadingTasks ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status tabs */}
      <StatusTabs
        active={activeFilter}
        counts={statusCounts}
        onSelect={onSetFilter}
      />

      {/* Action bar: Quick Tasks + Custom Task Creator */}
      <div className="flex flex-wrap gap-2">
        <QuickTaskSection
          taskResults={taskResults}
          loadingTaskId={loadingTaskId}
          getMemberBySlug={getMemberBySlug}
          onExecute={onExecuteQuickTask}
          onClearResults={onClearResults}
        />
        <TaskCreator members={members} onSubmit={onCreateTask} />
      </div>

      {/* Main content: task list + optional sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task list (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-2">
          {isLoadingTasks && tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm">Loading tasks...</p>
              </CardContent>
            </Card>
          ) : tasks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks{activeFilter !== 'all' ? ` with status "${activeFilter}"` : ''}</p>
                <p className="text-xs mt-1">Use Quick Tasks or create a custom task above</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-2 pr-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    member={getMemberBySlug(task.assigned_to)}
                    onUpdate={onUpdateTask}
                    onDelete={onDeleteTask}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Workload sidebar (1/3 on desktop, full width mobile) */}
        <div className="space-y-4">
          {memberWorkload && Object.keys(memberWorkload).length > 0 && (
            <WorkloadSidebar
              workload={memberWorkload}
              members={members}
              getMemberBySlug={getMemberBySlug}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// WRAPPED EXPORT
// =============================================================================

export const TaskDashboard: React.FC<TaskDashboardProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Task Dashboard Unavailable"
    fallbackMessage="The task dashboard encountered an error. Try refreshing the page."
  >
    <TaskDashboardContent {...props} />
  </BoardroomErrorBoundary>
);

export default TaskDashboard;