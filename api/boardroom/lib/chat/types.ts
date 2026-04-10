// FILE: api/boardroom/lib/chat/types.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Types & Configuration
// ═══════════════════════════════════════════════════════════════════════
//
// v10.0: Added mediaAttachments to SingleChatParams, CommitteeParams,
//        FullBoardParams. Optional — zero breaking changes.
// ═══════════════════════════════════════════════════════════════════════

import type { ProviderCallResult } from '../provider-caller.js';
import type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
import type { EnergyLevel, EnergyArc } from '../../../../src/lib/boardroom/energy.js';
import type { MediaAttachment } from '../prompt-builder/media-context.js';

// =============================================================================
// CONFIG CONSTANTS
// =============================================================================

export const COMPRESSION_THRESHOLD  = 25;
export const CONTINUITY_CARRYOVER   = 6;
export const MAX_CONTEXT_MESSAGES   = 20;

export const VALID_MEETING_TYPES = [
  'one_on_one',
  'full_board',
  'committee',
  'vote',
  'devils_advocate',
  'executive_session',
] as const;

export type MeetingType = (typeof VALID_MEETING_TYPES)[number];

// =============================================================================
// CONVERSATION TYPES
// =============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  member_slug?: string;
}

export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  messageCount: number;
  isNew: boolean;
}

// =============================================================================
// HANDLER PARAMETER TYPES
// =============================================================================

export interface ChatRequestBody {
  meeting_id?: string;
  member_slug?: string;
  message: string;
  conversation_id?: string;
  conversation_history?: ConversationMessage[];
  mention_all?: boolean;
  meeting_type?: string;
  committee_members?: string[];
}

export interface SingleChatParams {
  userId: string;
  meetingId?: string;
  memberSlug: string;
  message: string;
  conversationId?: string;
  legacyHistory: ConversationMessage[];
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
  mediaAttachments?: MediaAttachment[];   // v10.0
}

export interface CommitteeParams {
  userId: string;
  meetingId?: string;
  committeeSlugs: string[];
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
  mediaAttachments?: MediaAttachment[];   // v10.0
}

export interface FullBoardParams {
  userId: string;
  meetingId?: string;
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
  mediaAttachments?: MediaAttachment[];   // v10.0
}

// =============================================================================
// BACKGROUND TASK TYPES
// =============================================================================

export interface BackgroundTaskParams {
  userId: string;
  memberSlug: string;
  boardMember: BoardMember;
  message: string;
  conversationMessages: ConversationMessage[];
  responseText: string;
  result: ProviderCallResult;
  crossDomain: boolean;
  hasMemory: boolean;
  topicCategory: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  crossBoardFeed: any[];
  meetingId?: string;
  conversationId?: string;
  messageCount: number;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface MemberResponse {
  member: string;
  name: string;
  title: string;
  response: string;
  provider: string;
  model: string;
  responseTime: number;
  isFallback: boolean;
  error: boolean;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { ProviderCallResult } from '../provider-caller.js';
export type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
export type { EnergyLevel, EnergyArc } from '../../../../src/lib/boardroom/energy.js';
export type { MediaAttachment } from '../prompt-builder/media-context.js';