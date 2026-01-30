// FILE: src/pages/Boardroom.tsx
// Executive Boardroom - Slim Orchestrator Page
// This file coordinates the boardroom feature modules

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

// Feature imports
import {
  // Hooks
  useBoardroom,
  useMeeting,
  useBriefing,
  useTasks,
  // Components
  AccessDenied,
  BoardroomHeader,
  DailyBriefing,
  QuickTasks,
  BoardSidebar,
  ChatArea,
  NewMeetingDialog,
  BoardroomErrorBoundary,
  // Types
  type Meeting,
  type QuickTask,
} from '@/features/boardroom';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BoardroomPage: React.FC = () => {
  // UI State
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Data & State Hooks
  const boardroom = useBoardroom();
  
  const meeting = useMeeting({
    members: boardroom.members,
    onMeetingCreated: (newMeeting) => {
      boardroom.setMeetings(prev => [newMeeting, ...prev]);
    },
  });

  const briefing = useBriefing({
    initialBriefing: boardroom.briefing,
    onBriefingGenerated: (newBriefing) => {
      boardroom.setBriefing(newBriefing);
    },
  });

  const tasks = useTasks();

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCreateMeeting = async (title: string, type: any, participants?: string[]) => {
    const newMeeting = await meeting.createMeeting(title, type, participants);
    if (newMeeting) {
      setNewMeetingOpen(false);
    }
  };

  const handleSelectMeeting = async (selectedMeeting: Meeting) => {
    await meeting.loadMeeting(selectedMeeting);
  };

  const handleSendMessage = async () => {
    if (newMessage.trim()) {
      const messageToSend = newMessage;
      setNewMessage('');
      await meeting.sendMessage(messageToSend);
    }
  };

  const handleExecuteTask = async (task: QuickTask) => {
    await tasks.executeTask(task);
  };

  // ============================================================================
  // RENDER - ACCESS STATES
  // ============================================================================

  // Loading state
  if (boardroom.hasAccess === null) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Access denied
  if (boardroom.hasAccess === false) {
    return <AccessDenied />;
  }

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================

  return (
    <BoardroomErrorBoundary
      fallbackTitle="Boardroom Error"
      fallbackMessage="The boardroom encountered an unexpected error. Please refresh the page."
    >
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <BoardroomHeader onNewMeeting={() => setNewMeetingOpen(true)} />

        {/* Daily Briefing Section */}
        <DailyBriefing
          briefing={briefing.briefing}
          isLoading={briefing.isLoading}
          expanded={briefingExpanded}
          onExpandedChange={setBriefingExpanded}
          onGenerateBriefing={() => briefing.generateBriefing()}
        />

        {/* Quick Tasks Section */}
        <QuickTasks
          members={boardroom.members}
          taskResults={tasks.taskResults}
          loadingTaskId={tasks.loadingTaskId}
          expanded={tasksExpanded}
          onExpandedChange={setTasksExpanded}
          onExecuteTask={handleExecuteTask}
          getMemberBySlug={boardroom.getMemberBySlug}
        />

        {/* Main Grid - Sidebar + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <BoardSidebar
            members={boardroom.members}
            meetings={boardroom.meetings}
            activeMeetingId={meeting.activeMeeting?.id}
            onSelectMeeting={handleSelectMeeting}
          />

          <ChatArea
            activeMeeting={meeting.activeMeeting}
            messages={meeting.messages}
            loadingResponses={meeting.loadingResponses}
            sending={meeting.sending}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            onStartMeeting={() => setNewMeetingOpen(true)}
            getMemberBySlug={boardroom.getMemberBySlug}
          />
        </div>

        {/* New Meeting Dialog */}
        <NewMeetingDialog
          open={newMeetingOpen}
          onOpenChange={setNewMeetingOpen}
          members={boardroom.members}
          onCreateMeeting={handleCreateMeeting}
        />
      </div>
    </BoardroomErrorBoundary>
  );
};

export default BoardroomPage;