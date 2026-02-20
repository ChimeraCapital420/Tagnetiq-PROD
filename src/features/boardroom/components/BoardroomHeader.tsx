// FILE: src/features/boardroom/components/BoardroomHeader.tsx
// Header component — Mobile-aware with execution status badges
//
// Sprint 7: Simplified header used by DesktopLayout.
// On mobile, the layout handles its own header/nav.
// Shows kill switch warning, pending approvals badge.

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoardroomHeaderProps {
  onNewMeeting: () => void;
  pendingApprovals?: number;
  killSwitchActive?: boolean;
  className?: string;
}

export const BoardroomHeader: React.FC<BoardroomHeaderProps> = ({
  onNewMeeting,
  pendingApprovals = 0,
  killSwitchActive = false,
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Executive Boardroom
            {pendingApprovals > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {pendingApprovals}
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your AI Board of Directors
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Kill switch warning */}
        {killSwitchActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-medium">
            <AlertOctagon className="w-3.5 h-3.5" />
            Kill Switch Active
          </div>
        )}

        <Button onClick={onNewMeeting} className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Meeting</span>
        </Button>
      </div>
    </div>
  );
};

// Alias for backward compatibility
export const Header = BoardroomHeader;

export default BoardroomHeader;