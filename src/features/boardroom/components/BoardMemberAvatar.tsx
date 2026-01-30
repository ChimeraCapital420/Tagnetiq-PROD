// FILE: src/features/boardroom/components/BoardMemberAvatar.tsx
// Clickable avatar that shows status and opens profile modal

import React from 'react';
import { Phone, MessageSquare, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface BoardMemberAvatarProps {
  member: BoardMember;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  onStartVoiceChat?: () => void;
  onStartTextChat?: () => void;
  onOpenSettings?: () => void;
  showStatus?: boolean;
  showTooltip?: boolean;
  isActive?: boolean;
  isSpeaking?: boolean;
  className?: string;
}

// =============================================================================
// SIZE CONFIG
// =============================================================================

const SIZES = {
  sm: {
    avatar: 'w-8 h-8',
    status: 'w-2 h-2 -bottom-0.5 -right-0.5',
    text: 'text-xs',
    ring: 'ring-2',
  },
  md: {
    avatar: 'w-10 h-10',
    status: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
    text: 'text-sm',
    ring: 'ring-2',
  },
  lg: {
    avatar: 'w-12 h-12',
    status: 'w-3 h-3 -bottom-0.5 -right-0.5',
    text: 'text-base',
    ring: 'ring-2',
  },
  xl: {
    avatar: 'w-16 h-16',
    status: 'w-4 h-4 -bottom-1 -right-1',
    text: 'text-lg',
    ring: 'ring-4',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const BoardMemberAvatar: React.FC<BoardMemberAvatarProps> = ({
  member,
  size = 'md',
  onClick,
  onStartVoiceChat,
  onStartTextChat,
  onOpenSettings,
  showStatus = true,
  showTooltip = true,
  isActive = false,
  isSpeaking = false,
  className,
}) => {
  const sizeConfig = SIZES[size];
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const statusColor = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-400',
  }[member.status];

  const AvatarContent = (
    <div
      className={cn(
        "relative cursor-pointer transition-all group",
        onClick && "hover:scale-105",
        className
      )}
      onClick={onClick}
    >
      {/* Avatar circle */}
      <div
        className={cn(
          sizeConfig.avatar,
          "rounded-full flex items-center justify-center font-semibold text-white transition-all",
          "bg-gradient-to-br",
          member.id === 'ceo' && "from-amber-500 to-orange-600",
          member.id === 'cfo' && "from-green-500 to-emerald-600",
          member.id === 'cmo' && "from-pink-500 to-rose-600",
          member.id === 'coo' && "from-blue-500 to-indigo-600",
          member.id === 'legal' && "from-slate-500 to-slate-700",
          member.id === 'strategy' && "from-purple-500 to-violet-600",
          member.id === 'market' && "from-cyan-500 to-teal-600",
          member.id === 'sourcing' && "from-orange-500 to-amber-600",
          member.id === 'prometheus' && "from-red-600 to-rose-700",
          !['ceo', 'cfo', 'cmo', 'coo', 'legal', 'strategy', 'market', 'sourcing', 'prometheus'].includes(member.id) && "from-gray-500 to-gray-600",
          isActive && `${sizeConfig.ring} ring-blue-500`,
          isSpeaking && "ring-green-500 ring-4 animate-pulse",
        )}
        style={{
          backgroundImage: member.avatar ? `url(${member.avatar})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!member.avatar && (
          <span className={sizeConfig.text}>{initials}</span>
        )}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          <span className="w-1 h-2 bg-green-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" />
          <span className="w-1 h-3 bg-green-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.1s]" />
          <span className="w-1 h-2 bg-green-500 rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.2s]" />
        </div>
      )}

      {/* Status indicator */}
      {showStatus && !isSpeaking && (
        <div
          className={cn(
            "absolute rounded-full border-2 border-background",
            sizeConfig.status,
            statusColor
          )}
        />
      )}

      {/* Hover overlay */}
      {onClick && (
        <div className={cn(
          sizeConfig.avatar,
          "absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center"
        )}>
          <Settings className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );

  // With context menu
  if (onStartVoiceChat || onStartTextChat || onOpenSettings) {
    return (
      <TooltipProvider>
        <ContextMenu>
          <ContextMenuTrigger>
            {showTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {AvatarContent}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-center">
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                  <p className="text-xs capitalize">{member.status}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              AvatarContent
            )}
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            {onStartVoiceChat && (
              <ContextMenuItem onClick={onStartVoiceChat}>
                <Phone className="w-4 h-4 mr-2" />
                Start Voice Chat
              </ContextMenuItem>
            )}
            {onStartTextChat && (
              <ContextMenuItem onClick={onStartTextChat}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </ContextMenuItem>
            )}
            {(onStartVoiceChat || onStartTextChat) && onOpenSettings && (
              <ContextMenuSeparator />
            )}
            {onOpenSettings && (
              <ContextMenuItem onClick={onOpenSettings}>
                <Settings className="w-4 h-4 mr-2" />
                View Profile & Settings
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </TooltipProvider>
    );
  }

  // Simple tooltip version
  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {AvatarContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-center">
            <p className="font-semibold">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.role}</p>
            <p className="text-xs capitalize">{member.status}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return AvatarContent;
};

export default BoardMemberAvatar;