// FILE: api/boardroom/lib/chat/index.ts
// ═══════════════════════════════════════════════════════════════════════
// CHAT MODULE — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
//
// Import anything chat-related from here.
//
//   import { handleSingleMemberChat, type SingleChatParams } from './lib/chat/index.js';
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types & Config ──────────────────────────────────────
export {
  COMPRESSION_THRESHOLD,
  CONTINUITY_CARRYOVER,
  MAX_CONTEXT_MESSAGES,
  VALID_MEETING_TYPES,
  type MeetingType,
  type ConversationMessage,
  type ConversationState,
  type ChatRequestBody,
  type SingleChatParams,
  type CommitteeParams,
  type FullBoardParams,
  type BackgroundTaskParams,
  type MemberResponse,
} from './types.js';

// ── Conversation Persistence ────────────────────────────
export {
  loadOrCreateConversation,
  persistExchange,
  compressAndArchive,
  shouldCompress,
} from './conversations.js';

// ── Meeting Handlers ────────────────────────────────────
export { handleSingleMemberChat } from './single-member.js';
export { handleCommitteeMeeting, handleFullBoardMeeting } from './multi-member.js';

// ── Background Tasks ────────────────────────────────────
export { runBackgroundTasks } from './background-tasks.js';