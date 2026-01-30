// FILE: src/features/boardroom/hooks/useTasks.ts
// Hook for quick task execution

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { QuickTask, TaskResult, TaskExecutionResponse, UseTasksReturn } from '../types';
import { API_ENDPOINTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';

interface UseTasksOptions {
  onTaskCompleted?: (result: TaskResult) => void;
}

export function useTasks(options: UseTasksOptions = {}): UseTasksReturn {
  const { onTaskCompleted } = options;

  // State
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  // Get auth session helper
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error(ERROR_MESSAGES.notAuthenticated);
    }
    return session;
  };

  // Execute a quick task
  const executeTask = useCallback(async (task: QuickTask): Promise<void> => {
    setLoadingTaskId(task.id);

    try {
      const session = await getSession();

      const response = await fetch(API_ENDPOINTS.tasks, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          assigned_to: task.assignedTo,
          title: task.label,
          task_type: task.taskType,
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
      toast.success(SUCCESS_MESSAGES.taskCompleted(task.label));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.taskExecuteFailed;
      toast.error(errorMessage);
    } finally {
      setLoadingTaskId(null);
    }
  }, [onTaskCompleted]);

  // Clear all results
  const clearResults = useCallback(() => {
    setTaskResults([]);
  }, []);

  // Check if a task has results
  const hasResult = useCallback((taskId: string): boolean => {
    return taskResults.some(r => r.id === taskId);
  }, [taskResults]);

  // Get result for a specific task
  const getResult = useCallback((taskId: string): TaskResult | undefined => {
    return taskResults.find(r => r.id === taskId);
  }, [taskResults]);

  return {
    // State
    taskResults,
    loadingTaskId,
    
    // Actions
    executeTask,
    clearResults,
    
    // Helpers
    hasResult,
    getResult,
  } as UseTasksReturn & { 
    hasResult: (taskId: string) => boolean;
    getResult: (taskId: string) => TaskResult | undefined;
  };
}

export default useTasks;