// FILE: src/features/boardroom/components/KillSwitchPanel.tsx
// Kill Switch Panel — Emergency autonomy stop control
//
// Sprint 7: Big red button for the CEO. Toggles kill switch.
// Shows current status, reason, and spend caps.
// Designed for quick access on mobile.

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertOctagon,
  ShieldOff,
  ShieldCheck,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AutonomyStatus } from '../types';

interface KillSwitchPanelProps {
  autonomy: AutonomyStatus | null;
  onToggle: (reason?: string) => Promise<boolean>;
  className?: string;
}

export const KillSwitchPanel: React.FC<KillSwitchPanelProps> = ({
  autonomy,
  onToggle,
  className,
}) => {
  const [processing, setProcessing] = useState(false);
  const [reason, setReason] = useState('');

  if (!autonomy) {
    return (
      <div className={cn('rounded-lg bg-muted p-4 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          Autonomy not configured yet.
        </p>
      </div>
    );
  }

  const isKilled = autonomy.kill_switch;

  const handleToggle = async () => {
    setProcessing(true);
    const success = await onToggle(isKilled ? undefined : reason || 'Manual kill switch');
    if (success) setReason('');
    setProcessing(false);
  };

  return (
    <div className={cn('rounded-lg border p-4 space-y-4', className,
      isKilled ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted',
    )}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isKilled ? (
            <AlertOctagon className="w-5 h-5 text-red-400" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-green-400" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {isKilled ? 'All Autonomy Stopped' : 'Autonomy Active'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {autonomy.sandbox ? 'Sandbox mode' : 'Live mode'}
              {!autonomy.enabled && ' · Disabled'}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          isKilled ? 'bg-red-500/20 text-red-400' :
          autonomy.enabled ? 'bg-green-500/20 text-green-400' :
          'bg-slate-500/20 text-slate-400',
        )}>
          {isKilled ? 'KILLED' : autonomy.enabled ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Kill reason if active */}
      {isKilled && autonomy.kill_reason && (
        <p className="text-xs text-red-400/80 bg-red-500/10 rounded-md px-3 py-1.5">
          Reason: {autonomy.kill_reason}
        </p>
      )}

      {/* Spend summary */}
      {autonomy.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-background p-2.5">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Today
            </p>
            <p className="text-sm font-semibold mt-0.5">
              ${autonomy.spent_today} / ${autonomy.daily_limit}
            </p>
          </div>
          <div className="rounded-md bg-background p-2.5">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Month
            </p>
            <p className="text-sm font-semibold mt-0.5">
              ${autonomy.spent_this_month} / ${autonomy.monthly_limit}
            </p>
          </div>
        </div>
      )}

      {/* Kill/Unkill button */}
      {!isKilled && (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)..."
          className="w-full h-8 px-3 text-xs rounded-md bg-background border border-input focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      <Button
        onClick={handleToggle}
        disabled={processing}
        variant={isKilled ? 'default' : 'destructive'}
        className={cn('w-full gap-2', isKilled && 'bg-green-600 hover:bg-green-700')}
      >
        {processing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isKilled ? (
          <>
            <ShieldCheck className="w-4 h-4" />
            Reactivate Autonomy
          </>
        ) : (
          <>
            <ShieldOff className="w-4 h-4" />
            Activate Kill Switch
          </>
        )}
      </Button>
    </div>
  );
};

export default KillSwitchPanel;