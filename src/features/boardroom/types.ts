// FILE: src/features/boardroom/types.ts
// All TypeScript interfaces for the Boardroom feature

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
}

export interface TaskExecutionResponse {
  task_id: string;
  member: Pick<BoardMember, 'name' | 'slug' | 'title'>;
  deliverable: string;
  execution_time_ms?: number;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
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
  last_meeting_date?: string;
  total_meetings?: number;
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
  access_level?: 'owner' | 'admin' | 'member' | 'viewer';
  scheduled_actions?: ScheduledAction[];
}

export interface ScheduledAction {
  id: string;
  title: string;
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
  audio: string; // base64 encoded audio
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
// HOOK RETURN TYPES
// ============================================================================

export interface UseBoardroomReturn {
  // State
  hasAccess: boolean | null;
  members: BoardMember[];
  meetings: Meeting[];
  stats: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  getMemberBySlug: (slug: string) => BoardMember | undefined;
}

export interface UseMeetingReturn {
  // State
  activeMeeting: Meeting | null;
  messages: Message[];
  sending: boolean;
  loadingResponses: string[];
  
  // Actions
  createMeeting: (title: string, type: MeetingType, participants?: string[]) => Promise<Meeting | null>;
  loadMeeting: (meeting: Meeting) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  concludeMeeting: (summary?: string) => Promise<void>;
  clearActiveMeeting: () => void;
}

export interface UseBriefingReturn {
  // State
  briefing: Briefing | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  generateBriefing: (type?: Briefing['briefing_type']) => Promise<void>;
  fetchBriefing: () => Promise<void>;
  markAsRead: () => Promise<void>;
}

export interface UseTasksReturn {
  // State
  taskResults: TaskResult[];
  loadingTaskId: string | null;
  
  // Actions
  executeTask: (task: QuickTask) => Promise<void>;
  clearResults: () => void;
}