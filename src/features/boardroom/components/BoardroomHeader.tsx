// FILE: src/features/boardroom/components/BoardroomHeader.tsx
// Header component with title and new meeting button

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Plus } from 'lucide-react';

interface BoardroomHeaderProps {
  onNewMeeting: () => void;
}

export const BoardroomHeader: React.FC<BoardroomHeaderProps> = ({ onNewMeeting }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          Executive Boardroom
        </h1>
        <p className="text-muted-foreground mt-1">Your AI Board of Directors</p>
      </div>
      <Button onClick={onNewMeeting} className="gap-2">
        <Plus className="h-4 w-4" />
        New Meeting
      </Button>
    </div>
  );
};

export default BoardroomHeader;