// FILE: src/features/boardroom/components/AuditLogViewer.tsx
// Audit Log Viewer — Paginated execution history
//
// Sprint 7: Fetches from /api/boardroom/execution/audit-log.
// Filters by type, member, status. Infinite scroll on mobile.
// Designed for CEO to review all autonomous actions.

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ScrollText,
  Filter,
  Loader2,
  Shield,
  Bot,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS, IMPACT_COLORS } from '../constants';
import type { AuditEntry } from '../types';

interface AuditLogViewerProps {
  /** Pre-filter by member slug */
  memberFilter?: string;
  /** Max entries per page */
  pageSize?: number;
  className?: string;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  memberFilter,
  pageSize = 25,
  className,
}) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<'all' | 'board' | 'autonomy'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [summary, setSummary] = useState<Record<string, number>>({});

  const fetchEntries = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        type: typeFilter,
        limit: String(pageSize),
        offset: String(currentOffset),
      });
      if (memberFilter) params.set('member', memberFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`${API_ENDPOINTS.auditLog}?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch audit log');

      const data = await res.json();

      // Map entries
      const newEntries: AuditEntry[] = (data.entries || []).map((e: any) => ({
        id: e.id,
        source: e.source,
        type: e.action_type || e.type,
        title: e.title || e.action_description || '',
        description: e.description || '',
        member: e.member_slug || e.initiator_detail || null,
        initiatedBy: e.initiated_by || 'board',
        status: e.status,
        cost: e.estimated_cost || e.financial_amount || null,
        isSandbox: e.is_sandbox || false,
        createdAt: e.created_at,
        executedAt: e.executed_at || null,
      }));

      if (reset) {
        setEntries(newEntries);
        setOffset(pageSize);
      } else {
        setEntries(prev => [...prev, ...newEntries]);
        setOffset(currentOffset + pageSize);
      }

      setHasMore(newEntries.length >= pageSize);

      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [offset, typeFilter, statusFilter, memberFilter, pageSize]);

  // Fetch on mount and filter changes
  useEffect(() => {
    fetchEntries(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, memberFilter]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'executed':
      case 'auto_approved':
      case 'confirmed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case 'failed':
      case 'rejected':
      case 'blocked_by_guardrail':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'pending':
      case 'awaiting_confirmation':
        return <Clock className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-base font-semibold">Audit Log</h3>
        </div>

        {/* Summary badges */}
        {Object.keys(summary).length > 0 && (
          <div className="flex gap-1.5 text-[10px]">
            {summary.executed != null && (
              <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">
                {summary.executed} executed
              </span>
            )}
            {summary.blocked != null && summary.blocked > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                {summary.blocked} blocked
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['all', 'board', 'autonomy'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={cn(
              'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              typeFilter === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t === 'all' ? 'All' : t === 'board' ? 'Board Actions' : 'Autonomy'}
          </button>
        ))}

        {/* Status filter chips */}
        {['pending', 'executed', 'failed', 'blocked_by_guardrail'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={cn(
              'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-lg bg-muted p-3">
            <div className="flex items-start gap-2">
              {/* Source icon */}
              <div className="flex-shrink-0 mt-0.5">
                {entry.source === 'autonomy_ledger' ? (
                  <Bot className="w-4 h-4 text-purple-400" />
                ) : (
                  <Shield className="w-4 h-4 text-blue-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{entry.title || entry.type}</span>
                  {statusIcon(entry.status)}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-muted-foreground">
                  {entry.member && <span>{entry.member}</span>}
                  <span>{entry.type}</span>
                  <span>{formatAuditDate(entry.createdAt)}</span>
                  {entry.cost != null && entry.cost > 0 && (
                    <span className="text-amber-400">${entry.cost}</span>
                  )}
                  {entry.isSandbox && (
                    <span className="text-purple-400">sandbox</span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <span className={cn(
                'flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full',
                entry.status === 'executed' || entry.status === 'confirmed'
                  ? 'bg-green-500/10 text-green-400'
                  : entry.status === 'failed' || entry.status === 'rejected' || entry.status === 'blocked_by_guardrail'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-yellow-500/10 text-yellow-400',
              )}>
                {entry.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        ))}

        {/* Empty state */}
        {!isLoading && entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No audit entries found.</p>
          </div>
        )}

        {/* Load more */}
        {hasMore && entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchEntries(false)}
            disabled={isLoading}
            className="w-full h-8 text-xs"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Load more'
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

function formatAuditDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default AuditLogViewer;