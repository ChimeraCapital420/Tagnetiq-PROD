// FILE: src/features/boardroom/components/MemberCard.tsx
// Member Card — Mobile-first compact card per board member
//
// Sprint 7: Combines avatar, name, role, provider badge,
// trust meter, energy dot, and personality generation badge.
// Tapping opens 1:1 chat. Long-press opens profile.

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AI_PROVIDER_COLORS } from '../constants';
import { TrustMeter } from './TrustMeter';
import { EnergyDot } from './EnergyIndicator';
import { PersonalityBadge } from './PersonalityBadge';
import type { BoardMember, EnergyLevel } from '../types';

interface MemberCardProps {
  member: BoardMember;
  /** Current detected energy (from context) */
  energy?: EnergyLevel;
  /** Compact = list item, full = expanded card */
  variant?: 'compact' | 'full';
  /** Is this member currently active/speaking */
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  member,
  energy,
  variant = 'compact',
  isActive = false,
  onClick,
  className,
}) => {
  const trustLevel = member.trust_level ?? 20;

  if (variant === 'compact') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
          'hover:bg-muted/80',
          isActive ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted',
          className,
        )}
      >
        {/* Avatar + energy dot */}
        <div className="relative flex-shrink-0">
          <img
            src={member.avatar_url}
            alt={member.name}
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).className = 'w-10 h-10 rounded-full bg-muted';
            }}
          />
          {energy && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <EnergyDot energy={energy} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{member.name}</span>
            <Badge
              className={cn(
                'text-[8px] px-1 py-0 leading-tight',
                AI_PROVIDER_COLORS[member.ai_provider] || 'bg-gray-500/20 text-gray-400'
              )}
            >
              {member.ai_provider}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{member.title}</p>
          <TrustMeter trustLevel={trustLevel} variant="compact" className="mt-1" />
        </div>

        {/* Workload indicator */}
        {member.workload && (member.workload.pending > 0 || member.workload.completed > 0) && (
          <div className="flex-shrink-0 text-right">
            {member.workload.pending > 0 && (
              <span className="text-[10px] text-yellow-400 block">
                {member.workload.pending} pending
              </span>
            )}
            {member.workload.completed > 0 && (
              <span className="text-[10px] text-green-400 block">
                {member.workload.completed} done
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  // Full variant — expanded card with all Sprint 4/5/6 data
  return (
    <div className={cn('rounded-lg bg-muted p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <img
            src={member.avatar_url}
            alt={member.name}
            className="w-14 h-14 rounded-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).className = 'w-14 h-14 rounded-full bg-muted';
            }}
          />
          {energy && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <EnergyDot energy={energy} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold">{member.name}</h3>
          <p className="text-sm text-muted-foreground">{member.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              className={cn(
                'text-[9px]',
                AI_PROVIDER_COLORS[member.ai_provider] || 'bg-gray-500/20 text-gray-400'
              )}
            >
              {member.ai_provider}
            </Badge>
            {member.role && (
              <span className="text-[10px] text-muted-foreground">{member.role}</span>
            )}
          </div>
        </div>
      </div>

      {/* Trust meter — expanded */}
      <TrustMeter trustLevel={trustLevel} variant="expanded" />

      {/* Expertise */}
      {member.expertise && member.expertise.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.expertise.map((skill, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Capabilities */}
      {member.capabilities && member.capabilities.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Capabilities
          </p>
          <div className="space-y-1">
            {member.capabilities.map((cap, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground/80">{cap.name}</span>
                {cap.autonomous && (
                  <span className="text-[9px] px-1.5 py-0 rounded-full bg-amber-500/10 text-amber-400">
                    auto
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personality evolution */}
      <PersonalityBadge
        evolution={member.personality_evolution}
        memberName={member.name}
        variant="expanded"
      />

      {/* Action button */}
      {onClick && (
        <button
          onClick={onClick}
          className="w-full py-2 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        >
          Start 1:1 Chat
        </button>
      )}
    </div>
  );
};

export default MemberCard;