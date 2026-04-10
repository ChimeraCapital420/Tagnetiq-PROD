// FILE: src/pages/Boardroom.tsx
// Executive Boardroom — Responsive Layout Router
//
// Sprint 7: Mobile-first rebuild. Detects viewport and renders
// MobileLayout (bottom nav, full-screen panels) or DesktopLayout
// (3-column sidebar). All data loading happens here, layouts are pure UI.
//
// The CEO runs the company from their phone. Mobile is the primary experience.
//
// v10.0: Media attachment support
//   - handleSendMessage updated to accept (message, mediaAttachments?)
//   - activeMember derived from selectedMemberSlug and passed to layouts
//     so ChatArea can pass it to ChatInput for domain-filtered URL research
//   - newMessage state kept for backward compat with any layout that still
//     reads it, but ChatInput manages its own state internally

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

// v10.0: Media attachment type for onSendMessage signature
import type { MediaAttachment } from '../../../api/boardroom/lib/prompt-builder/media-context.js';

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
  // Kept for backward compat — ChatInput manages its own state in v10.0
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

  // ── v10.0: Derive active member from selectedMemberSlug ──
  // Passed to ChatArea → ChatInput so URL research is domain-filtered.
  // CFO browsing a business listing gets financial lens.
  // Legal browsing a contract gets liability lens.
  const activeMember = selectedMemberSlug
    ? boardroom.getMemberBySlug(selectedMemberSlug) ?? null
    : null;

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

  // v10.0: Updated signature — accepts message text + optional media attachments.
  // ChatInput calls onSend(message, attachments) — this threads both through
  // to useMeeting.sendMessage which passes them to the board chat API.
  // The old path (newMessage state → handleSendMessage()) still works for
  // any layout component that hasn't been updated to use ChatInput directly.
  const handleSendMessage = useCallback(async (
    message: string,
    mediaAttachments?: MediaAttachment[],
  ) => {
    const hasAttachments = mediaAttachments && mediaAttachments.length > 0;
    if (!message.trim() && !hasAttachments) return;

    await meeting.sendMessage(message, mediaAttachments);
    // Clear newMessage state in case old path used it
    setNewMessage('');
  }, [meeting]);

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

    // v10.0: Active member for domain-filtered URL research in ChatInput
    activeMember,

    // UI state
    activeTab,
    selectedMemberSlug,
    newMeetingOpen,

    // Handlers
    setActiveTab,
    setSelectedMemberSlug: handleSelectMember,
    setNewMeetingOpen,
    onNewMessageChange: setNewMessage,
    onSendMessage: handleSendMessage,   // v10.0: now (message, attachments?) => void
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