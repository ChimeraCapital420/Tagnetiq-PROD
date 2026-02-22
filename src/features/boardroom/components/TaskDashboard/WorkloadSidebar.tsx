// FILE: src/features/boardroom/components/TaskDashboard/WorkloadSidebar.tsx
// ═══════════════════════════════════════════════════════════════════════
// MEMBER WORKLOAD SIDEBAR — Per-member pending/completed progress bars
// ═══════════════════════════════════════════════════════════════════════

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3 } from 'lucide-react';
import { BoardMemberAvatar } from '../BoardMemberAvatar';
import type { BoardMember, MemberWorkload } from './types';

interface WorkloadSidebarProps {
  workload: Record<string, MemberWorkload>;
  members: BoardMember[];
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

export const WorkloadSidebar: React.FC<WorkloadSidebarProps> = ({
  workload,
  members,
  getMemberBySlug,
}) => {
  const entries = Object.entries(workload)
    .map(([slug, w]) => ({ slug, ...w, member: getMemberBySlug(slug) }))
    .filter(e => e.member)
    .sort((a, b) => (b.pending + b.completed) - (a.pending + a.completed));

  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="h-3.5 w-3.5" />
          Member Workload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(({ slug, pending, completed, member }) => {
          const total = pending + completed;
          const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <div key={slug} className="flex items-center gap-2">
              <BoardMemberAvatar member={member!} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{member!.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Progress bar */}
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${completedPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {completed}/{total}
                  </span>
                </div>
              </div>
              {pending > 0 && (
                <Badge variant="outline" className="text-[10px] text-yellow-400">
                  {pending} pending
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};