// FILE: src/features/boardroom/components/index.ts
// Barrel export for all boardroom components
//
// Sprint 7: Added EnergyIndicator, TrustMeter, PersonalityBadge,
//           StandupViewer, ApprovalCard, KillSwitchPanel
// Sprint 7 Gap #4: Added CommitteePanel, ScheduleCalendar, GatewayMetrics
// Sprint 8: Added TaskDashboard (full CRUD task management)

export { AccessDenied } from './AccessDenied';
export { BoardSidebar } from './BoardSidebar';
export { BoardMemberAvatar } from './BoardMemberAvatar';
export { BoardroomErrorBoundary } from './BoardroomErrorBoundary';
export { ChatArea } from './ChatArea';
export { ChatInput } from './ChatInput';
export { DailyBriefing } from './DailyBriefing';
export { ErrorBoundary } from './ErrorBoundary';
export { ExecutiveProfileModal } from './ExecutiveProfileModal';
export { Header } from './Header';
export { BoardroomHeader } from './BoardroomHeader';
export { MessageBubble } from './MessageBubble';
export { NewMeetingDialog } from './NewMeetingDialog';
export { QuickTasks } from './QuickTasks';
export { VoiceBoardroom } from './VoiceBoardroom';
export { VoiceButton } from './VoiceButton';
export { VoiceInputButton } from './VoiceInputButton';

// Sprint 7 additions
export { EnergyIndicator, EnergyDot } from './EnergyIndicator';
export { TrustMeter } from './TrustMeter';
export { PersonalityBadge } from './PersonalityBadge';
export { StandupViewer } from './StandupViewer';
export { ApprovalCard } from './ApprovalCard';
export { KillSwitchPanel } from './KillSwitchPanel';
export { MemberCard } from './MemberCard';
export { AuditLogViewer } from './AuditLogViewer';

// Sprint 7 Gap #4: Previously missing components
export { CommitteePanel } from './CommitteePanel';
export { ScheduleCalendar } from './ScheduleCalendar';
export { GatewayMetrics } from './GatewayMetrics';

// Sprint 8: Full task management dashboard
export { TaskDashboard } from './TaskDashboard';