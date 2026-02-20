// FILE: src/features/boardroom/components/TrustMeter.tsx
// Trust level progress bar per board member
//
// Sprint 7: Visual trust indicator for member cards and profiles.
// Trust tiers: Observer (0-39) → Advisor (40-59) → Trusted (60-79)
//              → Autonomous (80-89) → Executive (90-100)
//
// The bar fills proportionally. Color changes at tier boundaries.
// Compact mode for mobile list items, expanded mode for profiles.

import React from 'react';
import { cn } from '@/lib/utils';
import { TRUST_TIER_CONFIG, getTrustTierLabel } from '../constants';

interface TrustMeterProps {
  trustLevel: number;
  /** Compact = single line, expanded = bar + tier + percentage */
  variant?: 'compact' | 'expanded';
  className?: string;
}

export const TrustMeter: React.FC<TrustMeterProps> = ({
  trustLevel,
  variant = 'compact',
  className,
}) => {
  const level = Math.max(0, Math.min(100, trustLevel));
  const tierKey = getTrustTierLabel(level);
  const tier = TRUST_TIER_CONFIG[tierKey];

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Mini bar */}
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
          <div
            className={cn('h-full rounded-full transition-all duration-500', getTrustBarColor(level))}
            style={{ width: `${level}%` }}
          />
        </div>
        {/* Tier label */}
        <span className={cn('text-[10px] font-medium', tier.color)}>
          {tier.label}
        </span>
      </div>
    );
  }

  // Expanded variant
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-semibold', tier.color)}>
          {tier.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {level}/100
        </span>
      </div>

      {/* Full bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', getTrustBarColor(level))}
          style={{ width: `${level}%` }}
        />
      </div>

      {/* Tier markers */}
      <div className="flex justify-between text-[9px] text-muted-foreground/60 px-0.5">
        <span>0</span>
        <span>40</span>
        <span>60</span>
        <span>80</span>
        <span>100</span>
      </div>
    </div>
  );
};

function getTrustBarColor(level: number): string {
  if (level >= 90) return 'bg-purple-500';
  if (level >= 80) return 'bg-amber-500';
  if (level >= 60) return 'bg-green-500';
  if (level >= 40) return 'bg-blue-500';
  return 'bg-slate-500';
}

export default TrustMeter;