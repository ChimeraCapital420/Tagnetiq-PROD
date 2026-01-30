// FILE: src/features/boardroom/components/BoardSidebar.tsx
// Sidebar component with board members list and meeting history

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
import { cn } from '@/lib/utils';
import type { BoardMember, Meeting } from '../types';
import { AI_PROVIDER_COLORS, UI_CONFIG } from '../constants';

interface BoardSidebarProps {
  members: BoardMember[];
  meetings: Meeting[];
  activeMeetingId?: string;
  onSelectMeeting: (meeting: Meeting) => void;
}

const MemberCard: React.FC<{ member: BoardMember }> = ({ member }) => (
  <Card className="p-3">
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={member.avatar_url} alt={member.name} />
        <AvatarFallback>{member.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground truncate">{member.title}</p>
      </div>
      <Badge className={cn("text-[10px] shrink-0", AI_PROVIDER_COLORS[member.ai_provider])}>
        {member.ai_provider}
      </Badge>
    </div>
  </Card>
);

const MeetingCard: React.FC<{ 
  meeting: Meeting; 
  isActive: boolean;
  onClick: () => void;
}> = ({ meeting, isActive, onClick }) => (
  <Card
    className={cn(
      "p-3 cursor-pointer hover:border-primary transition-all",
      isActive && "border-primary bg-primary/5"
    )}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{meeting.title}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(meeting.started_at).toLocaleDateString()}
        </p>
      </div>
      <Badge variant={meeting.status === 'active' ? 'default' : 'secondary'}>
        {meeting.status}
      </Badge>
    </div>
  </Card>
);

const BoardSidebarContent: React.FC<BoardSidebarProps> = ({
  members,
  meetings,
  activeMeetingId,
  onSelectMeeting,
}) => {
  return (
    <div className="lg:col-span-1 space-y-4">
      <Tabs defaultValue="board">
        <TabsList className="w-full">
          <TabsTrigger value="board" className="flex-1">Board</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <ScrollArea className="h-[50vh]">
            <div className="space-y-2 pr-2">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No board members available
                </p>
              ) : (
                members.map((member) => (
                  <MemberCard key={member.slug} member={member} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <ScrollArea className="h-[50vh]">
            <div className="space-y-2 pr-2">
              {meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No meetings yet
                </p>
              ) : (
                meetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isActive={meeting.id === activeMeetingId}
                    onClick={() => onSelectMeeting(meeting)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Wrap with error boundary
export const BoardSidebar: React.FC<BoardSidebarProps> = (props) => (
  <BoardroomErrorBoundary
    fallbackTitle="Sidebar Unavailable"
    fallbackMessage="The sidebar encountered an error. Try refreshing the page."
  >
    <BoardSidebarContent {...props} />
  </BoardroomErrorBoundary>
);

export default BoardSidebar;