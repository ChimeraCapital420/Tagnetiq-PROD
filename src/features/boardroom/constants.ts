// FILE: src/features/boardroom/constants.ts
// All constants and configuration for the Boardroom feature
//
// Sprint 7: Added execution gateway endpoints, standup endpoints,
//           mobile navigation config, trust tier colors, energy colors.

import {
  Users, User, MessageSquare, Vote, Swords,
  MessageCircle, ListTodo, Newspaper, Shield, MoreHorizontal,
} from 'lucide-react';
import type { MeetingTypeConfig, QuickTask, MobileTab } from './types';

// ============================================================================
// MEETING TYPE CONFIGURATIONS
// ============================================================================

export const MEETING_TYPES: MeetingTypeConfig[] = [
  {
    id: 'full_board',
    name: 'Full Board Meeting',
    icon: Users,
    description: 'All members respond to your question',
  },
  {
    id: 'one_on_one',
    name: '1:1 Executive Session',
    icon: User,
    description: 'Private meeting with one board member',
    minParticipants: 1,
    maxParticipants: 1,
  },
  {
    id: 'committee',
    name: 'Committee Meeting',
    icon: MessageSquare,
    description: 'Select 2-4 members for focused discussion',
    minParticipants: 2,
    maxParticipants: 4,
  },
  {
    id: 'vote',
    name: 'Board Vote',
    icon: Vote,
    description: 'Get approve/reject/abstain from all members',
  },
  {
    id: 'devils_advocate',
    name: "Devil's Advocate",
    icon: Swords,
    description: 'One member argues against your proposal',
    minParticipants: 1,
    maxParticipants: 1,
  },
];

export const PARTICIPANT_REQUIRED_TYPES = ['one_on_one', 'committee', 'devils_advocate'] as const;

// ============================================================================
// MOBILE NAVIGATION (Sprint 7)
// ============================================================================

export interface MobileNavItem {
  id: MobileTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: 'pending_approvals' | 'unread_briefing' | 'pending_tasks';
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, badge: 'pending_tasks' },
  { id: 'briefing', label: 'Brief', icon: Newspaper, badge: 'unread_briefing' },
  { id: 'execute', label: 'Execute', icon: Shield, badge: 'pending_approvals' },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

// ============================================================================
// AI PROVIDER STYLING
// ============================================================================

export const AI_PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  openai: 'bg-green-500/20 text-green-400 border-green-500/30',
  google: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  deepseek: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  groq: 'bg-red-500/20 text-red-400 border-red-500/30',
  xai: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  perplexity: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  mistral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

// ============================================================================
// TRUST TIER STYLING (Sprint 6)
// ============================================================================

export const TRUST_TIER_CONFIG: Record<string, { label: string; color: string; min: number }> = {
  observer:   { label: 'Observer',   color: 'text-slate-400',  min: 0 },
  advisor:    { label: 'Advisor',    color: 'text-blue-400',   min: 40 },
  trusted:    { label: 'Trusted',    color: 'text-green-400',  min: 60 },
  autonomous: { label: 'Autonomous', color: 'text-amber-400',  min: 80 },
  executive:  { label: 'Executive',  color: 'text-purple-400', min: 90 },
};

export function getTrustTierLabel(trustLevel: number): string {
  if (trustLevel >= 90) return 'executive';
  if (trustLevel >= 80) return 'autonomous';
  if (trustLevel >= 60) return 'trusted';
  if (trustLevel >= 40) return 'advisor';
  return 'observer';
}

// ============================================================================
// ENERGY LEVEL STYLING (Sprint 2/9)
// ============================================================================

export const ENERGY_COLORS: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  crisis:      { bg: 'bg-red-500/20',    ring: 'ring-red-500',    text: 'text-red-400',    label: 'Crisis' },
  frustrated:  { bg: 'bg-orange-500/20',  ring: 'ring-orange-500', text: 'text-orange-400', label: 'Frustrated' },
  overwhelmed: { bg: 'bg-yellow-500/20',  ring: 'ring-yellow-500', text: 'text-yellow-400', label: 'Overwhelmed' },
  tired:       { bg: 'bg-slate-500/20',   ring: 'ring-slate-500',  text: 'text-slate-400',  label: 'Tired' },
  neutral:     { bg: 'bg-gray-500/20',    ring: 'ring-gray-500',   text: 'text-gray-400',   label: 'Neutral' },
  focused:     { bg: 'bg-blue-500/20',    ring: 'ring-blue-500',   text: 'text-blue-400',   label: 'Focused' },
  excited:     { bg: 'bg-green-500/20',   ring: 'ring-green-500',  text: 'text-green-400',  label: 'Excited' },
  celebrating: { bg: 'bg-purple-500/20',  ring: 'ring-purple-500', text: 'text-purple-400', label: 'Celebrating' },
};

// ============================================================================
// IMPACT LEVEL STYLING (Sprint 6)
// ============================================================================

export const IMPACT_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

// ============================================================================
// QUICK TASKS (legacy, preserved)
// ============================================================================

export const QUICK_TASKS: QuickTask[] = [
  {
    id: 'social-posts',
    label: 'Social Posts',
    assignedTo: 'echo',
    taskType: 'social_media_posts',
    description: 'Generate social media content',
  },
  {
    id: 'competitive-analysis',
    label: 'Competitive Analysis',
    assignedTo: 'athena',
    taskType: 'competitive_analysis',
    description: 'Analyze competitive landscape',
  },
  {
    id: 'market-research',
    label: 'Market Research',
    assignedTo: 'flux',
    taskType: 'market_research',
    description: 'Research market trends and opportunities',
  },
  {
    id: 'investor-narrative',
    label: 'Investor Narrative',
    assignedTo: 'griffin',
    taskType: 'investor_narrative',
    description: 'Build investor-ready narrative',
  },
  {
    id: 'terms-of-service',
    label: 'Terms of Service',
    assignedTo: 'sage',
    taskType: 'terms_of_service',
    description: 'Draft or review terms of service',
  },
  {
    id: 'privacy-policy',
    label: 'Privacy Policy',
    assignedTo: 'sage',
    taskType: 'privacy_policy',
    description: 'Draft or review privacy policy',
  },
  {
    id: 'financial-projections',
    label: 'Financials',
    assignedTo: 'griffin',
    taskType: 'financial_projections',
    description: 'Build financial models and projections',
  },
  {
    id: 'api-design',
    label: 'API Design',
    assignedTo: 'forge',
    taskType: 'api_design',
    description: 'Design and document API endpoints',
  },
];

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const API_ENDPOINTS = {
  // Core
  boardroom: '/api/boardroom',
  meetings: '/api/boardroom/meetings',
  chat: '/api/boardroom/chat',
  briefing: '/api/boardroom/briefing',
  tasks: '/api/boardroom/tasks',
  voice: '/api/boardroom/voice',
  // Sprint 1: Conversations
  conversations: '/api/boardroom/conversations',
  // Sprint 5: Standups
  standup: '/api/boardroom/standup',
  // Sprint 6: Execution Gateway
  actions: '/api/boardroom/actions',
  execution: '/api/boardroom/execution/gateway',
  auditLog: '/api/boardroom/execution/audit-log',
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const UI_CONFIG = {
  // Chat
  maxMessageLength: 4000,
  messagesPerPage: 50,

  // Briefing
  briefingSectionMaxLength: 500,

  // Tasks
  taskResultMaxHeight: 160,

  // Sidebar
  sidebarMemberListHeight: '50vh',

  // Chat area
  chatAreaHeight: '60vh',

  // Mobile
  mobileBreakpoint: 768,
  bottomNavHeight: 64,

  // Animations
  scrollBehavior: 'smooth' as const,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  notAuthenticated: 'Not authenticated. Please sign in.',
  accessDenied: 'Access denied. The Boardroom is restricted.',
  loadFailed: 'Failed to load boardroom data.',
  meetingCreateFailed: 'Failed to create meeting.',
  meetingLoadFailed: 'Failed to load meeting.',
  messageSendFailed: 'Failed to send message.',
  briefingGenerateFailed: 'Failed to generate briefing.',
  taskExecuteFailed: 'Task execution failed.',
  voicePlaybackFailed: 'Voice playback failed.',
  executionFailed: 'Action execution failed.',
  approvalFailed: 'Failed to process approval.',
  standupFailed: 'Failed to load standup data.',
  invalidMeetingTitle: 'Please enter a meeting title.',
  invalidParticipants: {
    one_on_one: 'Select exactly one member for 1:1 meeting.',
    committee: 'Select 2-4 members for committee meeting.',
  },
} as const;

// ============================================================================
// SUCCESS MESSAGES
// ============================================================================

export const SUCCESS_MESSAGES = {
  meetingCreated: 'Meeting started!',
  meetingConcluded: 'Meeting concluded.',
  briefingGenerated: 'Briefing generated!',
  taskCompleted: (taskLabel: string) => `${taskLabel} completed!`,
  messageCopied: 'Copied to clipboard.',
  actionApproved: 'Action approved and executing.',
  actionRejected: 'Action rejected.',
  killSwitchActivated: 'Kill switch activated. All autonomy stopped.',
  killSwitchDeactivated: 'Kill switch deactivated.',
  standupGenerated: 'Standup generated!',
} as const;

// ============================================================================
// LOADING MESSAGES
// ============================================================================

export const LOADING_MESSAGES = {
  briefing: 'Scuba Steve is scanning market news, Athena is analyzing strategy...',
  chat: 'Thinking...',
  task: 'Processing...',
} as const;