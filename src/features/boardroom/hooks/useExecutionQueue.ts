// FILE: src/features/boardroom/hooks/useExecutionQueue.ts
// Execution Queue Hook — Sprint 6 gateway frontend
//
// Sprint 7: Fetches pending approvals, handles approve/reject,
// manages kill switch, and tracks autonomy spend.
// All mutations go through the gateway endpoint.

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { API_ENDPOINTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants';
import type {
  PendingAction,
  AutonomyStatus,
  UseExecutionQueueReturn,
} from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(ERROR_MESSAGES.notAuthenticated);
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

async function gatewayPost(action: string, body: Record<string, unknown> = {}): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(API_ENDPOINTS.execution, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || ERROR_MESSAGES.executionFailed);
  }
  return res.json();
}

export function useExecutionQueue(): UseExecutionQueueReturn {
  const [queue, setQueue] = useState<PendingAction[]>([]);
  const [autonomy, setAutonomy] = useState<AutonomyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch pending queue ───────────────────────────────
  const refreshQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await gatewayPost('queue');

      // Map API response to PendingAction[]
      const pending: PendingAction[] = (data.queue || []).map((item: any) => ({
        id: item.id,
        member: item.member_slug,
        memberName: item.member_name || item.member_slug,
        memberTitle: item.member_title || '',
        type: item.action_type,
        title: item.title,
        description: item.description || '',
        impact: item.impact_level || 'low',
        cost: item.estimated_cost,
        affectsUsers: item.affects_users || false,
        reversible: item.reversible !== false,
        trust: item.trust_at_creation || 0,
        createdAt: item.created_at,
      }));

      setQueue(pending);

      // Also update autonomy if present
      if (data.autonomy) {
        setAutonomy(data.autonomy);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.executionFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Approve action ────────────────────────────────────
  const approveAction = useCallback(async (actionId: string): Promise<boolean> => {
    try {
      await gatewayPost('approve', { actionId });
      toast.success(SUCCESS_MESSAGES.actionApproved);
      // Remove from local queue immediately (optimistic)
      setQueue(prev => prev.filter(a => a.id !== actionId));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.approvalFailed;
      toast.error(msg);
      return false;
    }
  }, []);

  // ── Reject action ─────────────────────────────────────
  const rejectAction = useCallback(async (actionId: string, reason: string): Promise<boolean> => {
    try {
      await gatewayPost('reject', { actionId, reason });
      toast.success(SUCCESS_MESSAGES.actionRejected);
      setQueue(prev => prev.filter(a => a.id !== actionId));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : ERROR_MESSAGES.approvalFailed;
      toast.error(msg);
      return false;
    }
  }, []);

  // ── Kill switch ───────────────────────────────────────
  const toggleKillSwitch = useCallback(async (reason?: string): Promise<boolean> => {
    try {
      const isCurrentlyActive = autonomy?.kill_switch || false;
      const action = isCurrentlyActive ? 'unkill' : 'kill';
      await gatewayPost(action, reason ? { reason } : {});

      toast.success(
        isCurrentlyActive
          ? SUCCESS_MESSAGES.killSwitchDeactivated
          : SUCCESS_MESSAGES.killSwitchActivated
      );

      // Update local state
      setAutonomy(prev => prev ? {
        ...prev,
        kill_switch: !isCurrentlyActive,
        kill_reason: isCurrentlyActive ? null : (reason || null),
      } : null);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Kill switch failed.';
      toast.error(msg);
      return false;
    }
  }, [autonomy]);

  return {
    queue,
    autonomy,
    isLoading,
    error,
    approveAction,
    rejectAction,
    toggleKillSwitch,
    refreshQueue,
  };
}