// FILE: src/features/boardroom/components/ScheduleCalendar.tsx
// ═══════════════════════════════════════════════════════════════════════
// SCHEDULE CALENDAR — Cron & Scheduled Action Visualization
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 7 Gap #4: Visual timeline of automated boardroom events.
// Shows recurring crons (briefings, standups, debriefs) and one-off
// scheduled actions from boardroom_scheduled_actions.
//
// Mobile-first: vertical timeline on all screens.
// No external calendar library — lightweight, fast.
//
// Props:
//   scheduledActions — from boardroomData.scheduled_actions
//   onRefresh        — pull fresh schedule from API
//
// ═══════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar, Clock, Sun, Moon, Coffee,
  RefreshCw, Zap, Pause, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import type { ScheduledAction } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ScheduleCalendarProps {
  /** Scheduled actions from the API */
  scheduledActions?: ScheduledAction[];
  /** Whether data is loading */
  isLoading?: boolean;
  /** Refresh handler */
  onRefresh?: () => void;
  /** Optional class name */
  className?: string;
}

/** Built-in cron schedules (from vercel.json) */
interface CronEntry {
  id: string;
  label: string;
  description: string;
  schedule: string;
  utcHour: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// =============================================================================
// BUILT-IN CRONS (matches vercel.json)
// =============================================================================

const BUILT_IN_CRONS: CronEntry[] = [
  {
    id: 'kpi-snapshot',
    label: 'KPI Snapshot',
    description: 'Computes daily analytics snapshot',
    schedule: '0 6 * * *',
    utcHour: 6,
    icon: Zap,
    color: 'text-cyan-400',
  },
  {
    id: 'oracle-insights',
    label: 'Oracle Insights',
    description: 'Aggregates board-digestible analytics',
    schedule: '30 6 * * *',
    utcHour: 6,
    icon: Zap,
    color: 'text-purple-400',
  },
  {
    id: 'daily-digest',
    label: 'Daily Digest',
    description: 'User notification emails',
    schedule: '0 13 * * *',
    utcHour: 13,
    icon: Coffee,
    color: 'text-yellow-400',
  },
  {
    id: 'morning-briefing',
    label: 'Morning Briefing',
    description: 'Board members prepare daily briefing',
    schedule: '0 14 * * *',
    utcHour: 14,
    icon: Sun,
    color: 'text-amber-400',
  },
  {
    id: 'standup',
    label: 'Daily Standup',
    description: 'Board members report priorities & blockers',
    schedule: '0 16 * * *',
    utcHour: 16,
    icon: Coffee,
    color: 'text-green-400',
  },
  {
    id: 'evening-debrief',
    label: 'Evening Debrief',
    description: 'End-of-day summary and overnight planning',
    schedule: '0 1 * * *',
    utcHour: 1,
    icon: Moon,
    color: 'text-blue-400',
  },
];

// =============================================================================
// HELPERS
// =============================================================================

function utcToLocal(utcHour: number): string {
  const now = new Date();
  now.setUTCHours(utcHour, 0, 0, 0);
  return now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSchedule(schedule: string): string {
  // Parse simple cron patterns for display
  if (schedule.includes('* * *')) return 'Daily';
  if (schedule.includes('* * 1-5')) return 'Weekdays';
  if (schedule.includes('* * 0,6')) return 'Weekends';
  return schedule;
}

function getNextRun(utcHour: number, minute: number = 0): Date {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(utcHour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function timeUntil(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return 'now';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

// =============================================================================
// TIMELINE ITEM
// =============================================================================

const TimelineItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  label: string;
  description: string;
  localTime: string;
  frequency: string;
  nextIn: string;
  isActive?: boolean;
}> = ({ icon: Icon, color, label, description, localTime, frequency, nextIn, isActive = true }) => (
  <div className={cn(
    'flex gap-3 p-3 rounded-lg border transition-all',
    isActive
      ? 'border-slate-700 bg-slate-800/30 hover:bg-slate-700/30'
      : 'border-slate-800 bg-slate-900/30 opacity-60',
  )}>
    <div className={cn(
      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
      'bg-slate-800 border border-slate-700',
    )}>
      <Icon className={cn('w-4 h-4', color)} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-white">{label}</span>
        {!isActive && (
          <Badge variant="secondary" className="text-[10px] bg-slate-700 text-slate-400">
            Paused
          </Badge>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="w-3 h-3" />
          {localTime}
        </span>
        <span className="text-xs text-slate-600">·</span>
        <span className="text-xs text-slate-500">{frequency}</span>
        {isActive && (
          <>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-amber-400/80">{nextIn}</span>
          </>
        )}
      </div>
    </div>
  </div>
);

// =============================================================================
// SCHEDULED ACTION ITEM
// =============================================================================

const ActionItem: React.FC<{ action: ScheduledAction }> = ({ action }) => {
  const statusConfig = {
    true: { icon: CheckCircle2, color: 'text-green-400', label: 'Active' },
    false: { icon: Pause, color: 'text-slate-400', label: 'Paused' },
  };
  const config = statusConfig[String(action.is_active) as 'true' | 'false'];

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30">
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700">
        <config.icon className={cn('w-4 h-4', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">
            {action.title || action.action_type.replace(/_/g, ' ')}
          </span>
          <Badge variant="secondary" className={cn(
            'text-[10px]',
            action.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400',
          )}>
            {config.label}
          </Badge>
        </div>
        {action.member_slug && (
          <p className="text-xs text-slate-400 mt-0.5">Assigned to {action.member_slug}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-xs text-slate-500">
            {formatSchedule(action.schedule)}
          </span>
          {action.last_run && (
            <>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                Last: {new Date(action.last_run).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </>
          )}
          {action.next_run && (
            <>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-amber-400/80">
                Next: {new Date(action.next_run).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const ScheduleCalendarContent: React.FC<ScheduleCalendarProps> = ({
  scheduledActions = [],
  isLoading,
  onRefresh,
  className,
}) => {
  // Sort built-in crons by next occurrence
  const sortedCrons = useMemo(() => {
    return [...BUILT_IN_CRONS]
      .map((cron) => {
        const minute = cron.schedule.startsWith('30') ? 30 : 0;
        const next = getNextRun(cron.utcHour, minute);
        return { ...cron, next, localTime: utcToLocal(cron.utcHour), nextIn: timeUntil(next) };
      })
      .sort((a, b) => a.next.getTime() - b.next.getTime());
  }, []);

  return (
    <Card className={cn('flex flex-col bg-slate-900/50 border-slate-700', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white text-sm">Schedule</h2>
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

      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="p-3 space-y-4">
          {/* Built-in recurring crons */}
          <div>
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">
              Daily Automations
            </h3>
            <div className="space-y-2">
              {sortedCrons.map((cron) => (
                <TimelineItem
                  key={cron.id}
                  icon={cron.icon}
                  color={cron.color}
                  label={cron.label}
                  description={cron.description}
                  localTime={cron.localTime}
                  frequency="Daily"
                  nextIn={cron.nextIn}
                />
              ))}
            </div>
          </div>

          {/* Custom scheduled actions */}
          {scheduledActions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1 mb-2">
                Scheduled Actions
              </h3>
              <div className="space-y-2">
                {scheduledActions.map((action) => (
                  <ActionItem key={action.id} action={action} />
                ))}
              </div>
            </div>
          )}

          {scheduledActions.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500">
                No custom scheduled actions. Board members can propose recurring tasks.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
};

export const ScheduleCalendar: React.FC<ScheduleCalendarProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Schedule Unavailable"
    fallbackMessage="The schedule calendar encountered an error."
  >
    <ScheduleCalendarContent {...props} />
  </BoardroomErrorBoundary>
);

export default ScheduleCalendar;