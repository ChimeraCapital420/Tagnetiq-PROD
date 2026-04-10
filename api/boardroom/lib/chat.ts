// FILE: api/boardroom/lib/chat.ts
// Flat barrel — bridges './chat.js' imports to the ./chat/ folder.
export { COMPRESSION_THRESHOLD, CONTINUITY_CARRYOVER, MAX_CONTEXT_MESSAGES, VALID_MEETING_TYPES } from './chat/types.js';
export type { MeetingType, ConversationMessage, ConversationState, ChatRequestBody, SingleChatParams, CommitteeParams, FullBoardParams, BackgroundTaskParams, MemberResponse } from './chat/types.js';
export { loadOrCreateConversation, persistExchange, compressAndArchive, shouldCompress } from './chat/conversations.js';
export { handleSingleMemberChat } from './chat/single-member.js';
export { handleCommitteeMeeting, handleFullBoardMeeting } from './chat/multi-member.js';
export { runBackgroundTasks } from './chat/background-tasks.js';