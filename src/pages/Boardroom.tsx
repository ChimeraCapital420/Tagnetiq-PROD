// FILE: src/pages/Boardroom.tsx
// Executive Boardroom — Responsive Layout Router
//
// Sprint 7: Mobile-first rebuild. Detects viewport and renders
// MobileLayout (bottom nav, full-screen panels) or DesktopLayout
// (3-column sidebar). All data loading happens here, layouts are pure UI.
//
// The CEO runs the company from their phone. Mobile is the primary experience.

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

// Feature imports
import {
  useBoardroom,
  useMeeting,
  useBriefing,
  useTasks,
  AccessDenied,
  BoardroomErrorBoundary,
  type Meeting,
  type QuickTask,
  type MobileTab,
} from '@/features/boardroom';
import { UI_CONFIG } from '@/features/boardroom/constants';
import { MobileLayout } from '@/features/boardroom/layouts/MobileLayout';
import { DesktopLayout } from '@/features/boardroom/layouts/DesktopLayout';

// ============================================================================
// VIEWPORT HOOK
// ============================================================================

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < UI_CONFIG.mobileBreakpoint
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${UI_CONFIG.mobileBreakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BoardroomPage: React.FC = () => {
  const isMobile = useIsMobile();

  // ── UI State ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MobileTab>('chat');
  const [selectedMemberSlug, setSelectedMemberSlug] = useState<string | null>(null);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // ── Data Hooks ────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────

  const handleSelectMember = useCallback((slug: string) => {
    setSelectedMemberSlug(slug);
    setActiveTab('chat');
  }, []);

  const handleSelectMeeting = useCallback((m: Meeting) => {
    meeting.loadMeeting(m);
    setActiveTab('chat');
  }, [meeting]);

  const handleCreateMeeting = useCallback(async (title: string, type: any, participants?: string[]) => {
    const newMeeting = await meeting.createMeeting(title, type, participants);
    if (newMeeting) {
      setNewMeetingOpen(false);
    }
  }, [meeting]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim()) return;
    await meeting.sendMessage(newMessage);
    setNewMessage('');
  }, [meeting, newMessage]);

  const handleExecuteTask = useCallback(async (task: QuickTask) => {
    await tasks.executeTask(task);
  }, [tasks]);

  // ── Loading & Access ──────────────────────────────────

  if (boardroom.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground">Loading boardroom...</p>
        </div>
      </div>
    );
  }

  if (boardroom.hasAccess === false) {
    return <AccessDenied />;
  }

  // ── Shared Props ──────────────────────────────────────

  const sharedProps = {
    // Data
    members: boardroom.members,
    meetings: boardroom.meetings,
    stats: boardroom.stats,
    execution: boardroom.execution,
    briefing: briefing.briefing,
    taskResults: tasks.taskResults,
    loadingTaskId: tasks.loadingTaskId,

    // Meeting state
    activeMeeting: meeting.activeMeeting,
    messages: meeting.messages,
    sending: meeting.sending,
    loadingResponses: meeting.loadingResponses,
    newMessage,

    // UI state
    activeTab,
    selectedMemberSlug,
    newMeetingOpen,

    // Handlers
    setActiveTab,
    setSelectedMemberSlug: handleSelectMember,
    setNewMeetingOpen,
    onNewMessageChange: setNewMessage,
    onSendMessage: handleSendMessage,
    onSelectMeeting: handleSelectMeeting,
    onCreateMeeting: handleCreateMeeting,
    onExecuteTask: handleExecuteTask,
    onGenerateBriefing: () => briefing.generateBriefing(),
    onRefresh: boardroom.refresh,
    getMemberBySlug: boardroom.getMemberBySlug,
  };

  // ── Render ────────────────────────────────────────────

  return (
    <BoardroomErrorBoundary
      fallbackTitle="Boardroom Unavailable"
      fallbackMessage="Something went wrong. Please refresh the page."
    >
      {isMobile ? (
        <MobileLayout {...sharedProps} />
      ) : (
        <DesktopLayout {...sharedProps} />
      )}
    </BoardroomErrorBoundary>
  );
};

export default BoardroomPage;