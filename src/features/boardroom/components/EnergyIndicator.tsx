// FILE: src/features/boardroom/components/EnergyIndicator.tsx
// Energy level indicator — colored ring + label
//
// Sprint 7: Shows the CEO's detected energy state.
// Used in chat headers, member cards, and mobile status bar.
// Ring color maps to energy level (red=crisis → purple=celebrating).

import React from 'react';
import { cn } from '@/lib/utils';
import { ENERGY_COLORS } from '../constants';
import type { EnergyLevel } from '../types';

interface EnergyIndicatorProps {
  energy: EnergyLevel;
  /** Show text label beside the ring */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { ring: 'w-3 h-3', text: 'text-[10px]' },
  md: { ring: 'w-4 h-4', text: 'text-xs' },
  lg: { ring: 'w-6 h-6', text: 'text-sm' },
};

export const EnergyIndicator: React.FC<EnergyIndicatorProps> = ({
  energy,
  showLabel = false,
  size = 'md',
  className,
}) => {
  const colors = ENERGY_COLORS[energy] || ENERGY_COLORS.neutral;
  const dims = SIZE_MAP[size];

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Animated ring */}
      <div className={cn(
        'rounded-full ring-2 flex-shrink-0',
        dims.ring,
        colors.bg,
        colors.ring,
        // Pulse on high-energy states
        (energy === 'crisis' || energy === 'frustrated') && 'animate-pulse',
      )} />

      {/* Optional label */}
      {showLabel && (
        <span className={cn('font-medium', dims.text, colors.text)}>
          {colors.label}
        </span>
      )}
    </div>
  );
};

/**
 * Inline energy dot — minimal version for tight spaces (member list, chat headers).
 */
export const EnergyDot: React.FC<{ energy: EnergyLevel; className?: string }> = ({ energy, className }) => {
  const colors = ENERGY_COLORS[energy] || ENERGY_COLORS.neutral;
  return (
    <div
      className={cn('w-2 h-2 rounded-full flex-shrink-0', colors.bg, colors.ring, 'ring-1', className)}
      title={colors.label}
    />
  );
};

export default EnergyIndicator;