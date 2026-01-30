// FILE: src/features/boardroom/components/NewMeetingDialog.tsx
// Dialog for creating new meetings

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BoardMember, MeetingType } from '../types';
import { MEETING_TYPES, PARTICIPANT_REQUIRED_TYPES, ERROR_MESSAGES } from '../constants';

interface NewMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: BoardMember[];
  onCreateMeeting: (title: string, type: MeetingType, participants?: string[]) => Promise<void>;
}

export const NewMeetingDialog: React.FC<NewMeetingDialogProps> = ({
  open,
  onOpenChange,
  members,
  onCreateMeeting,
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType>('full_board');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const requiresParticipants = PARTICIPANT_REQUIRED_TYPES.includes(type as any);
  const meetingTypeConfig = MEETING_TYPES.find(t => t.id === type);

  const validateAndCreate = async () => {
    // Validate title
    if (!title.trim()) {
      toast.error(ERROR_MESSAGES.invalidMeetingTitle);
      return;
    }

    // Validate participants for specific meeting types
    if (type === 'one_on_one' && selectedMembers.length !== 1) {
      toast.error(ERROR_MESSAGES.invalidParticipants.one_on_one);
      return;
    }

    if (type === 'committee' && (selectedMembers.length < 2 || selectedMembers.length > 4)) {
      toast.error(ERROR_MESSAGES.invalidParticipants.committee);
      return;
    }

    if (type === 'devils_advocate' && selectedMembers.length !== 1) {
      toast.error(ERROR_MESSAGES.invalidParticipants.one_on_one);
      return;
    }

    setIsCreating(true);
    try {
      await onCreateMeeting(
        title.trim(),
        type,
        requiresParticipants ? selectedMembers : undefined
      );
      
      // Reset form and close
      setTitle('');
      setType('full_board');
      setSelectedMembers([]);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleMember = (slug: string) => {
    if (type === 'one_on_one' || type === 'devils_advocate') {
      // Single selection
      setSelectedMembers([slug]);
    } else {
      // Multi selection
      setSelectedMembers(prev =>
        prev.includes(slug)
          ? prev.filter(s => s !== slug)
          : [...prev, slug]
      );
    }
  };

  const handleTypeChange = (newType: MeetingType) => {
    setType(newType);
    setSelectedMembers([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start New Meeting</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Meeting Title */}
          <div>
            <label className="text-sm font-medium mb-2 block">Meeting Title</label>
            <Input
              placeholder="e.g., Q1 Strategy Review, Product Launch Discussion..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Meeting Type Selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">Meeting Type</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MEETING_TYPES.map((meetingType) => {
                const Icon = meetingType.icon;
                return (
                  <Card
                    key={meetingType.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary",
                      type === meetingType.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => handleTypeChange(meetingType.id)}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <Icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">{meetingType.name}</p>
                        <p className="text-xs text-muted-foreground">{meetingType.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Member Selection (for certain meeting types) */}
          {requiresParticipants && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Member{type === 'one_on_one' || type === 'devils_advocate' ? '' : 's'}
                {type === 'committee' && ' (2-4)'}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {members.map((member) => (
                  <Card
                    key={member.slug}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary p-2",
                      selectedMembers.includes(member.slug) && "border-primary bg-primary/5"
                    )}
                    onClick={() => toggleMember(member.slug)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <Avatar className="h-12 w-12 mb-1">
                        <AvatarImage src={member.avatar_url} alt={member.name} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium truncate w-full">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate w-full">
                        {member.title}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
              {selectedMembers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Create Button */}
          <Button 
            onClick={validateAndCreate} 
            className="w-full"
            disabled={isCreating}
          >
            {isCreating ? 'Starting...' : 'Start Meeting'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewMeetingDialog;