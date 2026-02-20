// FILE: src/features/boardroom/components/StandupViewer.tsx
// Standup Viewer — Mobile-first standup feed
//
// Sprint 7: Displays today's standups from board members.
// Highlights blockers (red), wins (green), and priority items.
// Compact cards optimized for phone scrolling.

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Trophy,
  ArrowRight,
  RefreshCw,
  Loader2,
  Sunrise,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StandupEntry, StandupDay } from '../types';

// ============================================================================
// TODAY'S STANDUPS
// ============================================================================

interface StandupViewerProps {
  entries: StandupEntry[];
  history?: StandupDay[];
  isLoading: boolean;
  onRefresh: () => void;
  onGenerate: (memberSlug?: string) => void;
  getMemberName?: (slug: string) => string;
  className?: string;
}

export const StandupViewer: React.FC<StandupViewerProps> = ({
  entries,
  history = [],
  isLoading,
  onRefresh,
  onGenerate,
  getMemberName,
  className,
}) => {
  const resolveName = (slug: string) =>
    getMemberName ? getMemberName(slug) : slug;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sunrise className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-semibold">Today's Standups</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 px-2"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onGenerate()}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            Generate All
          </Button>
        </div>
      </div>

      {/* No standups */}
      {!isLoading && entries.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sunrise className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No standups yet today.</p>
          <p className="text-xs mt-1">Generate them or wait for the scheduled time.</p>
        </div>
      )}

      {/* Entry cards */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <StandupCard
            key={entry.id}
            entry={entry}
            memberName={resolveName(entry.member_slug)}
          />
        ))}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Past Standups</h4>
          <div className="space-y-4">
            {history.map((day) => (
              <div key={day.date}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatStandupDate(day.date)}
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    {day.hasBlockers && (
                      <span className="text-red-400 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Blockers
                      </span>
                    )}
                    {day.totalWins > 0 && (
                      <span className="text-green-400 flex items-center gap-0.5">
                        <Trophy className="w-3 h-3" /> {day.totalWins} wins
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {day.entries.map((entry) => (
                    <StandupCard
                      key={entry.id}
                      entry={entry}
                      memberName={resolveName(entry.member_slug)}
                      compact
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STANDUP CARD
// ============================================================================

interface StandupCardProps {
  entry: StandupEntry;
  memberName: string;
  compact?: boolean;
}

const StandupCard: React.FC<StandupCardProps> = ({ entry, memberName, compact = false }) => {
  const hasBlockers = entry.blockers && entry.blockers.length > 0;
  const hasWins = entry.wins && entry.wins.length > 0;

  return (
    <div className={cn(
      'rounded-lg bg-muted p-3',
      hasBlockers && 'ring-1 ring-red-500/20',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{memberName}</span>
        <span className="text-[10px] text-muted-foreground">
          {entry.member_slug}
        </span>
      </div>

      {/* Main content */}
      {!compact && entry.content && (
        <p className="text-xs text-foreground/80 mb-2 line-clamp-3">
          {entry.content}
        </p>
      )}

      {/* Priority items */}
      {entry.priority_items && entry.priority_items.length > 0 && (
        <div className="mb-2">
          {entry.priority_items.map((item, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-foreground/70">
              <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
              <span className={compact ? 'line-clamp-1' : ''}>{item}</span>
            </div>
          ))}
        </div>
      )}

      {/* Blockers */}
      {hasBlockers && (
        <div className="mb-1.5">
          {entry.blockers.map((blocker, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400" />
              <span className={cn('text-red-400/90', compact && 'line-clamp-1')}>{blocker}</span>
            </div>
          ))}
        </div>
      )}

      {/* Wins */}
      {hasWins && (
        <div>
          {entry.wins.map((win, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs">
              <Trophy className="w-3 h-3 mt-0.5 flex-shrink-0 text-green-400" />
              <span className={cn('text-green-400/90', compact && 'line-clamp-1')}>{win}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function formatStandupDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default StandupViewer;