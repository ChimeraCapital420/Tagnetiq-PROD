// FILE: src/features/boardroom/components/BoardSidebar.tsx
// Sidebar showing all board members with clickable avatars

import React, { useState } from 'react';
import { 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Phone,
  PhoneOff,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { BoardMemberAvatar } from './BoardMemberAvatar';
import { ExecutiveProfileModal } from './ExecutiveProfileModal';
import type { BoardMember } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface BoardSidebarProps {
  members: BoardMember[];
  activeMemberId?: string | null;
  speakingMemberId?: string | null;
  onSelectMember: (memberId: string) => void;
  onStartVoiceChat: (memberId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  globalVoiceEnabled?: boolean;
  onToggleGlobalVoice?: (enabled: boolean) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BoardSidebar: React.FC<BoardSidebarProps> = ({
  members,
  activeMemberId,
  speakingMemberId,
  onSelectMember,
  onStartVoiceChat,
  isCollapsed = false,
  onToggleCollapse,
  globalVoiceEnabled = true,
  onToggleGlobalVoice,
  className,
}) => {
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<BoardMember | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleAvatarClick = (member: BoardMember) => {
    setSelectedMemberForProfile(member);
    setIsProfileOpen(true);
  };

  const handleStartTextChat = (memberId: string) => {
    onSelectMember(memberId);
    setIsProfileOpen(false);
  };

  const handleStartVoiceChat = (memberId: string) => {
    onStartVoiceChat(memberId);
    setIsProfileOpen(false);
  };

  const availableCount = members.filter(m => m.status === 'available').length;
  const busyCount = members.filter(m => m.status === 'busy').length;

  // Collapsed view - just avatars
  if (isCollapsed) {
    return (
      <>
        <div className={cn(
          "flex flex-col items-center py-4 px-2 border-r bg-muted/30 w-16",
          className
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="mb-4"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <ScrollArea className="flex-1 w-full">
            <div className="flex flex-col items-center gap-3">
              {members.map((member) => (
                <BoardMemberAvatar
                  key={member.id}
                  member={member}
                  size="md"
                  isActive={activeMemberId === member.id}
                  isSpeaking={speakingMemberId === member.id}
                  onClick={() => handleAvatarClick(member)}
                  onStartVoiceChat={() => handleStartVoiceChat(member.id)}
                  onStartTextChat={() => handleStartTextChat(member.id)}
                  onOpenSettings={() => handleAvatarClick(member)}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Global voice toggle */}
          {onToggleGlobalVoice && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleGlobalVoice(!globalVoiceEnabled)}
              className="mt-4"
            >
              {globalVoiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Profile Modal */}
        <ExecutiveProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          member={selectedMemberForProfile}
          onStartVoiceChat={handleStartVoiceChat}
          onStartTextChat={handleStartTextChat}
          onUpdateSettings={() => {}}
        />
      </>
    );
  }

  // Expanded view
  return (
    <>
      <div className={cn(
        "flex flex-col border-r bg-muted/30 w-72",
        className
      )}>
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <h2 className="font-semibold">Board Members</h2>
            </div>
            {onToggleCollapse && (
              <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {/* Status summary */}
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              {availableCount} available
            </Badge>
            {busyCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                {busyCount} busy
              </Badge>
            )}
          </div>
        </div>

        {/* Global Voice Control */}
        {onToggleGlobalVoice && (
          <div className="px-4 py-3 border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {globalVoiceEnabled ? (
                  <Volume2 className="w-4 h-4 text-green-500" />
                ) : (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm">Voice Responses</span>
              </div>
              <Switch
                checked={globalVoiceEnabled}
                onCheckedChange={onToggleGlobalVoice}
              />
            </div>
          </div>
        )}

        {/* Members list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {members.map((member) => (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                  "hover:bg-muted/80",
                  activeMemberId === member.id && "bg-blue-500/10 border border-blue-500/20",
                  speakingMemberId === member.id && "bg-green-500/10 border border-green-500/20"
                )}
                onClick={() => handleAvatarClick(member)}
              >
                <BoardMemberAvatar
                  member={member}
                  size="lg"
                  isActive={activeMemberId === member.id}
                  isSpeaking={speakingMemberId === member.id}
                  showTooltip={false}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{member.name}</span>
                    {speakingMemberId === member.id && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-600 text-xs">
                        Speaking
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.specialties.slice(0, 2).map((s, i) => (
                      <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartVoiceChat(member.id);
                    }}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAvatarClick(member);
                    }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-3 border-t text-xs text-center text-muted-foreground">
          Click an advisor to view profile • Right-click for quick actions
        </div>
      </div>

      {/* Profile Modal */}
      <ExecutiveProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        member={selectedMemberForProfile}
        onStartVoiceChat={handleStartVoiceChat}
        onStartTextChat={handleStartTextChat}
        onUpdateSettings={() => {}}
      />
    </>
  );
};

export default BoardSidebar;