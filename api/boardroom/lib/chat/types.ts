// FILE: api/boardroom/lib/chat/types.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Types & Configuration
// ═══════════════════════════════════════════════════════════════════════
//
// Single source of truth for every type, interface, and constant used
// across the chat module. Import from here — never define types inline.
//
// ═══════════════════════════════════════════════════════════════════════

import type { ProviderCallResult } from '../provider-caller.js';
import type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
import type { EnergyLevel, EnergyArc } from '../../../../src/lib/boardroom/energy.js';

// =============================================================================
// CONFIG CONSTANTS
// =============================================================================

/** Archive and start fresh when this many messages in a thread */
export const COMPRESSION_THRESHOLD = 25;

/** Carry this many recent messages into the new thread for continuity */
export const CONTINUITY_CARRYOVER = 6;

/** Max messages sent to AI provider (context window management) */
export const MAX_CONTEXT_MESSAGES = 20;

/** Valid meeting types accepted by the chat handler */
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

/** A single message in a conversation thread */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  member_slug?: string;
}

/** Server-side conversation state loaded from boardroom_conversations */
export interface ConversationState {
  id: string;
  messages: ConversationMessage[];
  messageCount: number;
  isNew: boolean;
}

// =============================================================================
// HANDLER PARAMETER TYPES
// =============================================================================

/** Parsed + validated request body from the main handler */
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

/** Parameters passed to handleSingleMemberChat */
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
}

/** Parameters passed to handleCommitteeMeeting */
export interface CommitteeParams {
  userId: string;
  meetingId?: string;
  committeeSlugs: string[];
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
}

/** Parameters passed to handleFullBoardMeeting */
export interface FullBoardParams {
  userId: string;
  meetingId?: string;
  message: string;
  meetingType: string;
  founderEnergy: EnergyLevel;
  founderArc: EnergyArc;
  topicCategory: string;
}

// =============================================================================
// BACKGROUND TASK TYPES
// =============================================================================

/** Everything the background task runner needs after a response is sent */
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

/** Shape of a single member's response in committee/full board meetings */
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
// RE-EXPORTS (convenience — consumers import from types.ts only)
// =============================================================================

export type { ProviderCallResult } from '../provider-caller.js';
export type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';
export type { EnergyLevel, EnergyArc } from '../../../../src/lib/boardroom/energy.js';