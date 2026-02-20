// FILE: src/features/boardroom/hooks/useTasks.ts
// ═══════════════════════════════════════════════════════════════════════
// TASK MANAGEMENT HOOK — Full CRUD for Boardroom Tasks
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 8: Expanded from quick-task-only to full task lifecycle.
//
// Backward compatible:
//   executeTask()  — still works for QuickTasks component
//   taskResults    — still populated for inline deliverable display
//   loadingTaskId  — still tracks which preset is running
//   clearResults() — still clears preset results
//
// New capabilities:
//   tasks          — full BoardroomTask[] from DB with status/deliverable
//   fetchTasks()   — list with status filter + assigned_to filter
//   createTask()   — custom task creation (not just presets)
//   updateTask()   — approve, request_revision, update status
//   deleteTask()   — cancel a task
//   getTask()      — fetch single task with full deliverable
//   activeFilter   — current filter state for UI tabs
//   setFilter()    — change filter (triggers re-fetch)
//
// API: api/boardroom/tasks.ts (GET, POST, PATCH, DELETE)
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type {
  QuickTask,
  TaskResult,
  TaskExecutionResponse,
  UseTasksReturn,
  BoardroomTask,
  TaskStatus,
  CreateTaskParams,
} from '../types';
import { API_ENDPOINTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

// =============================================================================
// OPTIONS
// =============================================================================

interface UseTasksOptions {
  /** Callback when a quick task completes (backward compat) */
  onTaskCompleted?: (result: TaskResult) => void;
  /** Callback when task list changes (for parent refresh) */
  onTasksChanged?: () => void;
  /** Auto-fetch tasks on mount? Default: false */
  autoFetch?: boolean;
}

// =============================================================================
// AUTH HELPER
// =============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(ERROR_MESSAGES.notAuthenticated);
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useTasks(options: UseTasksOptions = {}): UseTasksReturn {
  const { onTaskCompleted, onTasksChanged } = options;

  // ── Legacy quick-task state ───────────────────────────
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  // ── Full task management state ────────────────────────
  const [tasks, setTasks] = useState<BoardroomTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TaskStatus | 'all'>('all');

  // Prevent concurrent fetches
  const fetchingRef = useRef(false);

  // ══════════════════════════════════════════════════════
  // FETCH — List tasks with optional filter
  // ══════════════════════════════════════════════════════

  const fetchTasks = useCallback(async (filter?: TaskStatus | 'all'): Promise<void> => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoadingTasks(true);

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();

      const effectiveFilter = filter ?? activeFilter;
      if (effectiveFilter !== 'all') {
        params.set('status', effectiveFilter);
      }

      const url = `${API_ENDPOINTS.tasks}${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load tasks');
      }

      const data: BoardroomTask[] = await response.json();
      setTasks(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.taskExecuteFailed;
      toast.error(msg);
    } finally {
      setIsLoadingTasks(false);
      fetchingRef.current = false;
    }
  }, [activeFilter]);

  // ══════════════════════════════════════════════════════
  // SET FILTER — Change tab and re-fetch
  // ══════════════════════════════════════════════════════

  const setFilter = useCallback((filter: TaskStatus | 'all') => {
    setActiveFilter(filter);
    // Fetch with new filter
    fetchingRef.current = false; // Allow re-fetch
    void fetchTasks(filter);
  }, [fetchTasks]);

  // ══════════════════════════════════════════════════════
  // GET SINGLE TASK — Fetch with full deliverable
  // ══════════════════════════════════════════════════════

  const getTask = useCallback(async (id: string): Promise<BoardroomTask | null> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_ENDPOINTS.tasks}?id=${id}`, { headers });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load task');
      }

      return await response.json();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load task';
      toast.error(msg);
      return null;
    }
  }, []);

  // ══════════════════════════════════════════════════════
  // EXECUTE QUICK TASK — Backward compatible with QuickTasks
  // ══════════════════════════════════════════════════════

  const executeTask = useCallback(async (task: QuickTask): Promise<void> => {
    setLoadingTaskId(task.id);

    try {
      const headers = await getAuthHeaders();

      const response = await fetch(API_ENDPOINTS.tasks, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assigned_to: task.assignedTo,
          title: task.label,
          task_type: task.taskType,
          description: task.description,
          priority: 'high',
          execute_now: true,
        }),
      });

      const data: TaskExecutionResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || ERROR_MESSAGES.taskExecuteFailed);
      }

      const result: TaskResult = {
        id: task.id,
        content: data.deliverable || '[No deliverable]',
        member: data.member?.name || task.assignedTo,
        task_type: task.taskType,
        created_at: new Date().toISOString(),
      };

      setTaskResults(prev => [result, ...prev]);
      onTaskCompleted?.(result);
      onTasksChanged?.();
      toast.success(SUCCESS_MESSAGES.taskCompleted(task.label));

      // Refresh task list if loaded
      if (tasks.length > 0) {
        fetchingRef.current = false;
        void fetchTasks();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.taskExecuteFailed;
      toast.error(msg);
    } finally {
      setLoadingTaskId(null);
    }
  }, [onTaskCompleted, onTasksChanged, tasks.length, fetchTasks]);

  // ══════════════════════════════════════════════════════
  // CREATE CUSTOM TASK
  // ══════════════════════════════════════════════════════

  const createTask = useCallback(async (params: CreateTaskParams): Promise<BoardroomTask | null> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(API_ENDPOINTS.tasks, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assigned_to: params.assigned_to,
          title: params.title,
          description: params.description || params.title,
          task_type: params.task_type,
          priority: params.priority || 'normal',
          execute_now: params.execute_now ?? true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || ERROR_MESSAGES.taskExecuteFailed);
      }

      // If executed immediately, add to results too
      if (params.execute_now && data.deliverable) {
        const result: TaskResult = {
          id: data.task?.id || params.title,
          content: data.deliverable,
          member: data.member?.name || params.assigned_to,
          task_type: params.task_type as any,
          created_at: new Date().toISOString(),
          title: params.title,
          assigned_to: params.assigned_to,
        };
        setTaskResults(prev => [result, ...prev]);
      }

      onTasksChanged?.();
      toast.success(SUCCESS_MESSAGES.taskCompleted(params.title));

      // Refresh task list
      fetchingRef.current = false;
      void fetchTasks();

      return data.task || data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.taskExecuteFailed;
      toast.error(msg);
      return null;
    }
  }, [onTasksChanged, fetchTasks]);

  // ══════════════════════════════════════════════════════
  // UPDATE TASK — Approve, request revision, change status
  // ══════════════════════════════════════════════════════

  const updateTask = useCallback(async (
    id: string,
    action: string,
    feedback?: string,
  ): Promise<void> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(API_ENDPOINTS.tasks, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          id,
          action,
          ceo_feedback: feedback,
          status: action === 'approve' ? 'completed' : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update task');
      }

      // Update in local state
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      onTasksChanged?.();

      const actionLabels: Record<string, string> = {
        approve: 'Task approved',
        request_revision: 'Revision requested',
        cancel: 'Task cancelled',
      };
      toast.success(actionLabels[action] || 'Task updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task';
      toast.error(msg);
    }
  }, [onTasksChanged]);

  // ══════════════════════════════════════════════════════
  // DELETE TASK — Cancel and remove
  // ══════════════════════════════════════════════════════

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    try {
      const headers = await getAuthHeaders();

      const response = await fetch(`${API_ENDPOINTS.tasks}?id=${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete task');
      }

      // Remove from local state
      setTasks(prev => prev.filter(t => t.id !== id));
      onTasksChanged?.();
      toast.success('Task cancelled');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task';
      toast.error(msg);
    }
  }, [onTasksChanged]);

  // ══════════════════════════════════════════════════════
  // CLEAR RESULTS — Backward compat
  // ══════════════════════════════════════════════════════

  const clearResults = useCallback(() => {
    setTaskResults([]);
  }, []);

  // ══════════════════════════════════════════════════════
  // RETURN
  // ══════════════════════════════════════════════════════

  return {
    // Legacy (backward compatible)
    taskResults,
    loadingTaskId,
    executeTask,
    clearResults,

    // Sprint 8: Full CRUD
    tasks,
    isLoadingTasks,
    activeFilter,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    setFilter,
    getTask,
  };
}

export default useTasks;