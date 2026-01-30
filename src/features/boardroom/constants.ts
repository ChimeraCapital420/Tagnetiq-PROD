// FILE: src/features/boardroom/constants.ts
// All constants and configuration for the Boardroom feature

import { Users, User, MessageSquare, Vote, Swords } from 'lucide-react';
import type { MeetingTypeConfig, QuickTask } from './types';

// ============================================================================
// MEETING TYPE CONFIGURATIONS
// ============================================================================

export const MEETING_TYPES: MeetingTypeConfig[] = [
  { 
    id: 'full_board', 
    name: 'Full Board Meeting', 
    icon: Users, 
    description: 'All members respond to your question' 
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
    description: 'Get approve/reject/abstain from all members' 
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

// Meeting types that require participant selection
export const PARTICIPANT_REQUIRED_TYPES = ['one_on_one', 'committee', 'devils_advocate'] as const;

// ============================================================================
// AI PROVIDER STYLING
// ============================================================================

export const AI_PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  openai: 'bg-green-500/20 text-green-400 border-green-500/30',
  groq: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  gemini: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  google: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  xai: 'bg-red-500/20 text-red-400 border-red-500/30',
  perplexity: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  deepseek: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  mistral: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export const AI_PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'GPT-4',
  groq: 'Groq',
  gemini: 'Gemini',
  google: 'Gemini',
  xai: 'Grok',
  perplexity: 'Perplexity',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
};

// ============================================================================
// QUICK TASKS CONFIGURATION
// ============================================================================

export const QUICK_TASKS: QuickTask[] = [
  { 
    id: 'social-posts', 
    label: 'Social Posts', 
    assignedTo: 'glitch', 
    taskType: 'social_media_posts',
    description: 'Generate engaging social media content',
  },
  { 
    id: 'competitor-analysis', 
    label: 'Competitor Intel', 
    assignedTo: 'athena', 
    taskType: 'competitive_analysis',
    description: 'Analyze competitor strategies and positioning',
  },
  { 
    id: 'market-research', 
    label: 'Market Research', 
    assignedTo: 'scuba', 
    taskType: 'market_research',
    description: 'Research market trends and opportunities',
  },
  { 
    id: 'investor-narrative', 
    label: 'Investor Pitch', 
    assignedTo: 'athena', 
    taskType: 'investor_narrative',
    description: 'Craft compelling investor narratives',
  },
  { 
    id: 'terms-of-service', 
    label: 'Terms of Service', 
    assignedTo: 'lexicoda', 
    taskType: 'terms_of_service',
    description: 'Draft or review terms of service',
  },
  { 
    id: 'privacy-policy', 
    label: 'Privacy Policy', 
    assignedTo: 'lexicoda', 
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
    assignedTo: 'vulcan', 
    taskType: 'api_design',
    description: 'Design and document API endpoints',
  },
];

// ============================================================================
// API ENDPOINTS
// ============================================================================

export const API_ENDPOINTS = {
  boardroom: '/api/boardroom',
  meetings: '/api/boardroom/meetings',
  chat: '/api/boardroom/chat',
  briefing: '/api/boardroom/briefing',
  tasks: '/api/boardroom/tasks',
  voice: '/api/boardroom/voice',
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
  taskResultMaxHeight: 160, // px
  
  // Sidebar
  sidebarMemberListHeight: '50vh',
  
  // Chat area
  chatAreaHeight: '60vh',
  
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
} as const;

// ============================================================================
// LOADING MESSAGES
// ============================================================================

export const LOADING_MESSAGES = {
  briefing: 'Scuba Steve is scanning market news, Athena is analyzing strategy...',
  chat: 'Thinking...',
  task: 'Processing...',
} as const;