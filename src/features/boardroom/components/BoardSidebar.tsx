// FILE: src/features/boardroom/components/BoardSidebar.tsx
// Sidebar showing board members and meetings

import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare,
  Calendar,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BoardMemberAvatar } from './BoardMemberAvatar';
import { ExecutiveProfileModal } from './ExecutiveProfileModal';
import type { BoardMember, Meeting } from '../types';

// =============================================================================
// TYPES - Matching actual usage in Boardroom.tsx
// =============================================================================

interface BoardSidebarProps {
  members: BoardMember[];
  meetings?: Meeting[];
  activeMeetingId?: string | null;
  onSelectMeeting?: (meeting: Meeting) => void;
  // Optional voice/member selection props for future use
  activeMemberId?: string | null;
  speakingMemberId?: string | null;
  onSelectMember?: (memberId: string) => void;
  onStartVoiceChat?: (memberId: string) => void;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const BoardSidebar: React.FC<BoardSidebarProps> = ({
  members = [],
  meetings = [],
  activeMeetingId,
  onSelectMeeting,
  activeMemberId,
  speakingMemberId,
  onSelectMember,
  onStartVoiceChat,
  className,
}) => {
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<BoardMember | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'meetings'>('members');

  const handleAvatarClick = (member: BoardMember) => {
    setSelectedMemberForProfile(member);
    setIsProfileOpen(true);
  };

  const handleStartTextChat = (memberId: string) => {
    if (onSelectMember) {
      onSelectMember(memberId);
    }
    setIsProfileOpen(false);
  };

  const handleStartVoiceChat = (memberId: string) => {
    if (onStartVoiceChat) {
      onStartVoiceChat(memberId);
    }
    setIsProfileOpen(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className={cn(
        "lg:col-span-1 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden",
        className
      )}>
        {/* Tab Headers */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === 'members'
                ? "bg-slate-700/50 text-white border-b-2 border-amber-500"
                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
            )}
          >
            <Users className="w-4 h-4" />
            Board ({members?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === 'meetings'
                ? "bg-slate-700/50 text-white border-b-2 border-amber-500"
                : "text-slate-400 hover:text-white hover:bg-slate-700/30"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            Meetings ({meetings?.length || 0})
          </button>
        </div>

        <ScrollArea className="h-[500px]">
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="p-3 space-y-2">
              {(!members || members.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No board members available</p>
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id || member.slug}
                    onClick={() => handleAvatarClick(member)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                      "hover:bg-slate-700/50 border border-transparent",
                      activeMemberId === (member.id || member.slug) && "bg-amber-500/10 border-amber-500/30",
                      speakingMemberId === (member.id || member.slug) && "bg-green-500/10 border-green-500/30"
                    )}
                  >
                    <BoardMemberAvatar
                      member={member}
                      size="md"
                      isActive={activeMemberId === (member.id || member.slug)}
                      isSpeaking={speakingMemberId === (member.id || member.slug)}
                      showTooltip={false}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {member.name}
                        </span>
                        {speakingMemberId === (member.id || member.slug) && (
                          <Badge className="bg-green-500/20 text-green-400 text-xs">
                            Speaking
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {member.title || member.role}
                      </p>
                      {/* Use expertise with fallback to specialties, with null check */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(member.expertise || member.specialties || []).slice(0, 2).map((skill, i) => (
                          <span 
                            key={i} 
                            className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded"
                          >
                            {typeof skill === 'string' ? skill : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Meetings Tab */}
          {activeTab === 'meetings' && (
            <div className="p-3 space-y-2">
              {(!meetings || meetings.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No meetings yet</p>
                  <p className="text-xs mt-1">Start a new meeting to begin</p>
                </div>
              ) : (
                meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    onClick={() => onSelectMeeting?.(meeting)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all border",
                      "hover:bg-slate-700/50",
                      activeMeetingId === meeting.id 
                        ? "bg-amber-500/10 border-amber-500/30" 
                        : "border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">
                          {meeting.title || 'Untitled Meeting'}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-xs",
                              meeting.status === 'active' 
                                ? "bg-green-500/20 text-green-400"
                                : "bg-slate-600 text-slate-300"
                            )}
                          >
                            {meeting.status || 'active'}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {meeting.meeting_type || meeting.type || 'General'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(meeting.created_at || meeting.started_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
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