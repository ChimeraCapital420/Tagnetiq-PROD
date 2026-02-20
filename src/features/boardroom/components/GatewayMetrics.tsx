// FILE: src/features/boardroom/components/GatewayMetrics.tsx
// ═══════════════════════════════════════════════════════════════════════
// GATEWAY METRICS — AI Provider Health Dashboard
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 7 Gap #4: Real-time visibility into the AI gateway.
// Shows which providers are serving each board member, response times,
// fallback rates, and provider health status.
//
// Data source: _meta from chat responses (accumulated in state)
// and optional live health endpoint.
//
// Mobile-first: single-column card stack on small screens,
// 2-column grid on desktop.
//
// Props:
//   members      — board members with ai_provider, ai_model, ai_dna
//   recentMeta   — recent _meta objects from chat responses
//   onRefresh    — optional refresh handler
//
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity, Zap, AlertTriangle, Clock, Server,
  RefreshCw, TrendingUp, TrendingDown, Minus,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardMemberAvatar } from './BoardMemberAvatar';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import { AI_PROVIDER_COLORS } from '../constants';
import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface GatewayMetricsProps {
  /** All board members (for provider mapping) */
  members: BoardMember[];
  /** Recent _meta objects from chat responses */
  recentMeta?: MetaEntry[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Optional class name */
  className?: string;
}

/** Shape of _meta from chat responses (partial — we only use what we need) */
export interface MetaEntry {
  provider: string;
  model: string;
  responseTime: number;
  isFallback: boolean;
  topic?: string;
  crossDomain?: boolean;
  trustLevel?: number;
  member?: string;
  timestamp?: number;
}

interface ProviderStats {
  provider: string;
  totalCalls: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  fallbackCount: number;
  fallbackRate: number;
  lastSeen: number;
  models: Set<string>;
}

interface MemberProviderInfo {
  member: BoardMember;
  primaryProvider: string;
  primaryModel: string;
  recentResponseMs: number | null;
  recentFallback: boolean;
  callCount: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function computeProviderStats(entries: MetaEntry[]): ProviderStats[] {
  const byProvider: Record<string, MetaEntry[]> = {};

  for (const e of entries) {
    if (!byProvider[e.provider]) byProvider[e.provider] = [];
    byProvider[e.provider].push(e);
  }

  return Object.entries(byProvider)
    .map(([provider, calls]) => {
      const times = calls.map(c => c.responseTime).filter(t => t > 0).sort((a, b) => a - b);
      const avgResponseMs = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
      const p95ResponseMs = times.length > 0
        ? times[Math.floor(times.length * 0.95)]
        : 0;
      const fallbackCount = calls.filter(c => c.isFallback).length;
      const models = new Set(calls.map(c => c.model));
      const lastSeen = Math.max(...calls.map(c => c.timestamp || 0));

      return {
        provider,
        totalCalls: calls.length,
        avgResponseMs,
        p95ResponseMs,
        fallbackCount,
        fallbackRate: calls.length > 0 ? fallbackCount / calls.length : 0,
        lastSeen,
        models,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);
}

function computeMemberProviders(
  members: BoardMember[],
  entries: MetaEntry[],
): MemberProviderInfo[] {
  return members.map((member) => {
    const memberCalls = entries.filter(e => e.member === member.slug);
    const lastCall = memberCalls[memberCalls.length - 1];

    return {
      member,
      primaryProvider: member.ai_provider || 'unknown',
      primaryModel: member.ai_model || 'unknown',
      recentResponseMs: lastCall?.responseTime || null,
      recentFallback: lastCall?.isFallback || false,
      callCount: memberCalls.length,
    };
  });
}

function msLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function healthColor(avgMs: number, fallbackRate: number): string {
  if (fallbackRate > 0.3 || avgMs > 5000) return 'text-red-400';
  if (fallbackRate > 0.1 || avgMs > 3000) return 'text-yellow-400';
  return 'text-green-400';
}

function trendIcon(current: number, baseline: number) {
  const pctChange = baseline > 0 ? ((current - baseline) / baseline) * 100 : 0;
  if (pctChange > 10) return { Icon: TrendingUp, color: 'text-red-400', label: 'Slower' };
  if (pctChange < -10) return { Icon: TrendingDown, color: 'text-green-400', label: 'Faster' };
  return { Icon: Minus, color: 'text-slate-400', label: 'Stable' };
}

// =============================================================================
// PROVIDER CARD
// =============================================================================

const ProviderCard: React.FC<{ stats: ProviderStats }> = ({ stats }) => {
  const health = healthColor(stats.avgResponseMs, stats.fallbackRate);
  const colorClass = AI_PROVIDER_COLORS[stats.provider] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';

  return (
    <div className="p-3 rounded-lg border border-slate-700 bg-slate-800/30">
      <div className="flex items-center justify-between mb-2">
        <Badge className={cn('text-xs border', colorClass)}>
          {stats.provider}
        </Badge>
        <div className={cn('flex items-center gap-1', health)}>
          {stats.fallbackRate > 0.3 ? (
            <XCircle className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span className="text-xs font-medium">
            {stats.fallbackRate > 0.3 ? 'Degraded' : stats.fallbackRate > 0.1 ? 'Warning' : 'Healthy'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Avg Response</p>
          <p className="text-sm font-mono text-white">{msLabel(stats.avgResponseMs)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">P95</p>
          <p className="text-sm font-mono text-white">{msLabel(stats.p95ResponseMs)}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Calls</p>
          <p className="text-sm font-mono text-white">{stats.totalCalls}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Fallback</p>
          <p className={cn('text-sm font-mono', stats.fallbackRate > 0.1 ? 'text-yellow-400' : 'text-white')}>
            {(stats.fallbackRate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {stats.models.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Array.from(stats.models).map((model) => (
            <span key={model} className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
              {model}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MEMBER ROW
// =============================================================================

const MemberRow: React.FC<{ info: MemberProviderInfo }> = ({ info }) => {
  const providerColor = AI_PROVIDER_COLORS[info.primaryProvider] || '';

  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-700/30 transition-all">
      <BoardMemberAvatar member={info.member} size="sm" showTooltip={false} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{info.member.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge className={cn('text-[10px] border px-1 py-0', providerColor)}>
            {info.primaryProvider}
          </Badge>
          <span className="text-[10px] text-slate-500 truncate">{info.primaryModel}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {info.recentResponseMs !== null ? (
          <p className="text-xs font-mono text-slate-300">{msLabel(info.recentResponseMs)}</p>
        ) : (
          <p className="text-xs text-slate-600">—</p>
        )}
        {info.recentFallback && (
          <Badge variant="secondary" className="text-[10px] bg-yellow-500/20 text-yellow-400 mt-0.5">
            fallback
          </Badge>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// SUMMARY BAR
// =============================================================================

const SummaryBar: React.FC<{ entries: MetaEntry[] }> = ({ entries }) => {
  if (entries.length === 0) return null;

  const totalCalls = entries.length;
  const avgMs = Math.round(entries.reduce((s, e) => s + e.responseTime, 0) / totalCalls);
  const fallbacks = entries.filter(e => e.isFallback).length;
  const uniqueProviders = new Set(entries.map(e => e.provider)).size;

  return (
    <div className="grid grid-cols-4 gap-2 p-3 border-b border-slate-700">
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{totalCalls}</p>
        <p className="text-[10px] text-slate-500 uppercase">Calls</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{msLabel(avgMs)}</p>
        <p className="text-[10px] text-slate-500 uppercase">Avg</p>
      </div>
      <div className="text-center">
        <p className={cn('text-lg font-semibold', fallbacks > 0 ? 'text-yellow-400' : 'text-white')}>
          {fallbacks}
        </p>
        <p className="text-[10px] text-slate-500 uppercase">Fallbacks</p>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-white">{uniqueProviders}</p>
        <p className="text-[10px] text-slate-500 uppercase">Providers</p>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const GatewayMetricsContent: React.FC<GatewayMetricsProps> = ({
  members,
  recentMeta = [],
  isLoading,
  onRefresh,
  className,
}) => {
  const providerStats = useMemo(() => computeProviderStats(recentMeta), [recentMeta]);
  const memberProviders = useMemo(() => computeMemberProviders(members, recentMeta), [members, recentMeta]);

  return (
    <Card className={cn('flex flex-col bg-slate-900/50 border-slate-700', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white text-sm">Gateway Health</h2>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* Summary bar */}
      <SummaryBar entries={recentMeta} />

      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="p-3 space-y-4">
          {/* Provider health cards */}
          {providerStats.length > 0 ? (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">
                Provider Health
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {providerStats.map((stats) => (
                  <ProviderCard key={stats.provider} stats={stats} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Server className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm text-slate-400">No provider data yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Start a conversation to see gateway metrics
              </p>
            </div>
          )}

          {/* Per-member provider assignments */}
          {members.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">
                Member → Provider Map
              </h3>
              <div className="space-y-0.5">
                {memberProviders.map((info) => (
                  <MemberRow key={info.member.slug} info={info} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export const GatewayMetrics: React.FC<GatewayMetricsProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Gateway Metrics Unavailable"
    fallbackMessage="The metrics dashboard encountered an error."
  >
    <GatewayMetricsContent {...props} />
  </BoardroomErrorBoundary>
);

export default GatewayMetrics;