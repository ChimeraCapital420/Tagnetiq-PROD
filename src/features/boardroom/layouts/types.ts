// FILE: src/features/boardroom/layouts/types.ts
// Shared props interface for MobileLayout and DesktopLayout
//
// Both layouts receive the same data from Boardroom.tsx.
// They differ only in how they arrange the UI.

import type {
  BoardMember, Meeting, DashboardStats, Briefing,
  TaskResult, QuickTask, Message, ExecutionDashboard, MobileTab,
} from '../types';

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
  onSendMessage: () => void;
  onSelectMeeting: (meeting: Meeting) => void;
  onCreateMeeting: (title: string, type: any, participants?: string[]) => Promise<void>;
  onExecuteTask: (task: QuickTask) => Promise<void>;
  onGenerateBriefing: () => void;
  onRefresh: () => Promise<void>;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}