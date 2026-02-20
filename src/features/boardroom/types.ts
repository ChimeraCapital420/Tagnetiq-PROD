// FILE: src/features/boardroom/types.ts
// All TypeScript interfaces for the Boardroom feature
//
// Sprint 7: Added execution, standup, autonomy, energy, personality types
//           to support the full mobile-first frontend overhaul.
// Sprint 8: Added BoardroomTask (full DB record), TaskStatus, TaskPriority,
//           CreateTaskParams, expanded UseTasksReturn for TaskDashboard.

// ============================================================================
// BOARD MEMBER TYPES
// ============================================================================

export interface BoardMember {
  id: string;
  slug: string;
  name: string;
  role: string;
  title: string;
  ai_provider: string;
  ai_model?: string;
  avatar_url: string;
  personality: Record<string, unknown>;
  expertise: string[];
  voice_style: string;
  display_order: number;
  is_active?: boolean;
  trust_level?: number;
  ai_dna?: Record<string, unknown>;
  total_interactions?: number;
  personality_evolution?: PersonalityEvolution | null;
  evolved_prompt?: string | null;
  capabilities?: BoardMemberCapability[];
  workload?: MemberWorkload;
}

export interface BoardMemberCapability {
  name: string;
  description: string;
  autonomous: boolean;
}

export interface MemberWorkload {
  pending: number;
  completed: number;
}

// ============================================================================
// PERSONALITY EVOLUTION (Sprint 4)
// ============================================================================

export interface PersonalityEvolution {
  voice_signature?: string;
  catchphrases?: string[];
  cross_member_opinions?: Record<string, string>;
  inside_references?: string[];
  expertise_evolution?: string;
  communication_style?: string;
  generation?: number;
}

// ============================================================================
// ENERGY (Sprint 9 client-side, Sprint 2 server-side)
// ============================================================================

export type EnergyLevel =
  | 'crisis'
  | 'frustrated'
  | 'overwhelmed'
  | 'tired'
  | 'neutral'
  | 'focused'
  | 'excited'
  | 'celebrating';

export interface EnergyState {
  level: EnergyLevel;
  confidence: number;
  detectedAt: string;
}

// ============================================================================
// MEETING TYPES
// ============================================================================

export interface Meeting {
  id: string;
  title: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  started_at: string;
  concluded_at?: string;
  updated_at?: string;
  participants?: string[];
  participant_details?: Pick<BoardMember, 'id' | 'slug' | 'name' | 'title' | 'avatar_url'>[];
  agenda?: string;
  summary?: string;
  decisions?: string[];
  messages?: Message[];
}

export type MeetingType =
  | 'full_board'
  | 'one_on_one'
  | 'committee'
  | 'vote'
  | 'devils_advocate';

export type MeetingStatus = 'active' | 'concluded' | 'archived';

export interface MeetingTypeConfig {
  id: MeetingType;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  minParticipants?: number;
  maxParticipants?: number;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
  id: string;
  meeting_id?: string;
  conversation_id?: string;
  sender_type: 'user' | 'board_member';
  sender_id?: string;
  member_slug?: string;
  content: string;
  message_type?: 'message' | 'vote' | 'decision' | 'action_item';
  created_at: string;
  ai_provider?: string;
}

export interface BoardResponse {
  member: {
    slug: string;
    name: string;
    title: string;
    avatar_url: string;
    ai_provider?: string;
  };
  content: string;
  message_id?: string;
  error?: boolean;
}

export interface ChatResponse {
  user_message: Message;
  responses: BoardResponse[];
}

// ============================================================================
// CONVERSATION PERSISTENCE (Sprint 1)
// ============================================================================

export interface Conversation {
  id: string;
  user_id: string;
  member_slug: string;
  title: string;
  message_count: number;
  is_compressed: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// BRIEFING TYPES
// ============================================================================

export interface Briefing {
  id: string;
  user_id?: string;
  briefing_date: string;
  briefing_type: 'morning' | 'evening' | 'weekly' | 'custom';
  sections: BriefingSection[];
  summary: string;
  action_items: BriefingActionItem[];
  read_at: string | null;
  created_at: string;
}

export interface BriefingSection {
  member_slug: string;
  member_name: string;
  title: string;
  content: string;
  priority: number;
  category?: string;
}

export interface BriefingActionItem {
  id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
}

// ============================================================================
// TASK TYPES
// ============================================================================

export interface QuickTask {
  id: string;
  label: string;
  assignedTo: string;
  taskType: TaskType;
  description?: string;
}

export type TaskType =
  | 'social_media_posts'
  | 'competitive_analysis'
  | 'market_research'
  | 'investor_narrative'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'financial_projections'
  | 'api_design'
  | 'custom';

export interface TaskResult {
  id: string;
  content: string;
  member: string;
  task_type?: TaskType;
  created_at?: string;
  completed_at?: string;
  title?: string;
  assigned_to?: string;
  deliverable_type?: string;
}

export interface TaskExecutionResponse {
  task_id: string;
  member: Pick<BoardMember, 'name' | 'slug' | 'title'>;
  deliverable: string;
  execution_time_ms?: number;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
}

// ── Sprint 8: Full task record from boardroom_tasks table ────────────

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Full task record from the boardroom_tasks table.
 * Used by TaskDashboard for list/detail views.
 * QuickTask is the preset shape; BoardroomTask is the DB record.
 */
export interface BoardroomTask {
  id: string;
  user_id: string;
  assigned_to: string;
  title: string;
  description: string;
  task_type: TaskType | string;
  priority: TaskPriority;
  status: TaskStatus;
  started_at: string | null;
  completed_at: string | null;
  deliverable_type: string | null;
  deliverable_content: string | null;
  ceo_feedback: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Params for creating a new task via the API.
 */
export interface CreateTaskParams {
  assigned_to: string;
  title: string;
  description?: string;
  task_type: TaskType | string;
  priority?: TaskPriority;
  execute_now?: boolean;
}

// ============================================================================
// STANDUP TYPES (Sprint 5)
// ============================================================================

export interface StandupEntry {
  id: string;
  member_slug: string;
  member_name?: string;
  content: string;
  priority_items: string[];
  blockers: string[];
  wins: string[];
  entry_date: string;
  created_at: string;
}

export interface StandupDay {
  date: string;
  entries: StandupEntry[];
  hasBlockers: boolean;
  totalWins: number;
}

// ============================================================================
// EXECUTION TYPES (Sprint 6)
// ============================================================================

export type ActionStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected' | 'executed' | 'failed' | 'rolled_back';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PendingAction {
  id: string;
  member: string;
  memberName: string;
  memberTitle: string;
  type: string;
  title: string;
  description: string;
  impact: ImpactLevel;
  cost: number | null;
  affectsUsers: boolean;
  reversible: boolean;
  trust: number;
  createdAt: string;
}

export interface ExecutionResult {
  id: string;
  member_slug: string;
  action_type: string;
  title: string;
  status: ActionStatus;
  impact_level: ImpactLevel;
  executed_at: string | null;
  created_at: string;
}

export interface AutonomyStatus {
  enabled: boolean;
  sandbox: boolean;
  kill_switch: boolean;
  kill_reason: string | null;
  spent_today: number;
  spent_this_month: number;
  daily_limit: number;
  monthly_limit: number;
}

export interface AuditEntry {
  id: string;
  source: 'board_action' | 'autonomy_ledger';
  type: string;
  title: string;
  description: string;
  member: string | null;
  initiatedBy: string;
  status: string;
  cost: number | null;
  isSandbox: boolean;
  createdAt: string;
  executedAt: string | null;
}

// ============================================================================
// DASHBOARD & STATS TYPES
// ============================================================================

export interface DashboardStats {
  total_members: number;
  active_meetings: number;
  pending_tasks: number;
  tasks_completed_this_week: number;
  has_unread_briefing: boolean;
  pending_approvals?: number;
  kill_switch_active?: boolean;
  last_meeting_date?: string;
  total_meetings?: number;
}

export interface ExecutionDashboard {
  pending_approvals: number;
  pending_confirmations: number;
  recent_executions: ExecutionResult[];
  autonomy: AutonomyStatus | null;
}

export interface BoardroomData {
  members: BoardMember[];
  meetings: Meeting[];
  stats: DashboardStats | null;
  todays_briefing: Briefing | null;
  tasks?: {
    pending_count: number;
    recent_completed: TaskResult[];
    by_member: Record<string, MemberWorkload>;
  };
  execution?: ExecutionDashboard;
  access_level?: 'owner' | 'admin' | 'member' | 'viewer';
  scheduled_actions?: ScheduledAction[];
}

export interface ScheduledAction {
  id: string;
  title?: string;
  member_slug?: string;
  action_type: string;
  schedule: string;
  last_run?: string;
  next_run?: string;
  is_active: boolean;
}

// ============================================================================
// VOICE TYPES
// ============================================================================

export interface VoiceRequest {
  text: string;
  member_slug: string;
}

export interface VoiceResponse {
  audio: string;
  duration_ms?: number;
  voice_id?: string;
}

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  status?: number;
}

// ============================================================================
// MOBILE NAV TYPES (Sprint 7)
// ============================================================================

export type MobileTab = 'chat' | 'tasks' | 'briefing' | 'execute' | 'more';

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseBoardroomReturn {
  hasAccess: boolean | null;
  members: BoardMember[];
  meetings: Meeting[];
  stats: DashboardStats | null;
  execution: ExecutionDashboard | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

export interface UseMeetingReturn {
  activeMeeting: Meeting | null;
  messages: Message[];
  sending: boolean;
  loadingResponses: string[];
  createMeeting: (title: string, type: MeetingType, participants?: string[]) => Promise<Meeting | null>;
  loadMeeting: (meeting: Meeting) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  concludeMeeting: (summary?: string) => Promise<void>;
  clearActiveMeeting: () => void;
}

export interface UseBriefingReturn {
  briefing: Briefing | null;
  isLoading: boolean;
  error: string | null;
  generateBriefing: (type?: Briefing['briefing_type']) => Promise<void>;
  fetchBriefing: () => Promise<void>;
  markAsRead: () => Promise<void>;
}

export interface UseTasksReturn {
  // Legacy quick-task state (backward compatible)
  taskResults: TaskResult[];
  loadingTaskId: string | null;
  executeTask: (task: QuickTask) => Promise<void>;
  clearResults: () => void;

  // Sprint 8: Full CRUD task management
  tasks: BoardroomTask[];
  isLoadingTasks: boolean;
  activeFilter: TaskStatus | 'all';
  fetchTasks: (filter?: TaskStatus | 'all') => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<BoardroomTask | null>;
  updateTask: (id: string, action: string, feedback?: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  setFilter: (filter: TaskStatus | 'all') => void;
  getTask: (id: string) => Promise<BoardroomTask | null>;
}

export interface UseExecutionQueueReturn {
  queue: PendingAction[];
  autonomy: AutonomyStatus | null;
  isLoading: boolean;
  error: string | null;
  approveAction: (actionId: string) => Promise<boolean>;
  rejectAction: (actionId: string, reason: string) => Promise<boolean>;
  toggleKillSwitch: (reason?: string) => Promise<boolean>;
  refreshQueue: () => Promise<void>;
}

export interface UseStandupsReturn {
  entries: StandupEntry[];
  history: StandupDay[];
  isLoading: boolean;
  error: string | null;
  fetchToday: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  triggerGeneration: (memberSlug?: string) => Promise<void>;
}