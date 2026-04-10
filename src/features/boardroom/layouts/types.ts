// FILE: src/features/boardroom/layouts/types.ts
// Shared props interface for MobileLayout and DesktopLayout
//
// Both layouts receive the same data from Boardroom.tsx.
// They differ only in how they arrange the UI.
//
// v10.0: onSendMessage updated to accept (message, mediaAttachments?)
//        activeMember added — passed to ChatArea for domain-filtered
//        URL research (CFO gets financial lens, Legal gets liability lens)

import type {
  BoardMember, Meeting, DashboardStats, Briefing,
  TaskResult, QuickTask, Message, ExecutionDashboard, MobileTab,
} from '../types';
import type { MediaAttachment } from '../../../../api/boardroom/lib/prompt-builder/media-context.js';

export interface BoardroomLayoutProps {
  // ── Data ──────────────────────────────────────────
  members: BoardMember[];
  meetings: Meeting[];
  stats: DashboardStats | null;
  execution: ExecutionDashboard | null;
  briefing: Briefing | null;
  taskResults: TaskResult[];
  loadingTaskId: string | null;

  // ── Meeting State ─────────────────────────────────
  activeMeeting: Meeting | null;
  messages: Message[];
  sending: boolean;
  loadingResponses: string[];
  newMessage: string;

  // ── UI State ──────────────────────────────────────
  activeTab: MobileTab;
  selectedMemberSlug: string | null;
  newMeetingOpen: boolean;

  // ── State Setters ─────────────────────────────────
  setActiveTab: (tab: MobileTab) => void;
  setSelectedMemberSlug: (slug: string) => void;
  setNewMeetingOpen: (open: boolean) => void;
  onNewMessageChange: (value: string) => void;

  // ── Actions ───────────────────────────────────────
  // v10.0: accepts message text + optional media attachments
  onSendMessage: (message: string, mediaAttachments?: MediaAttachment[]) => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onCreateMeeting: (title: string, type: any, participants?: string[]) => Promise<void>;
  onExecuteTask: (task: QuickTask) => Promise<void>;
  onGenerateBriefing: () => void;
  onRefresh: () => Promise<void>;
  getMemberBySlug: (slug: string) => BoardMember | undefined;

  // v10.0: active member for domain-filtered URL research in ChatInput
  activeMember?: BoardMember | null;
}