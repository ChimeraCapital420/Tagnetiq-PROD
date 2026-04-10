// FILE: src/lib/boardroom/memory.ts
// Flat barrel — bridges './memory.js' imports to the ./memory/ folder.
export type { FounderDetail, CompressedMemory, BoardActivityEntry, FounderMemoryState } from './memory/founder-memory.js';
export { getFounderMemory, getCrossBoardFeed, getRecentDecisions, extractFounderDetails, compressBoardThread, trackEmotionalArc, updateFounderEnergy } from './memory/founder-memory.js';
export type { MeetingSummary, MeetingResponse } from './memory/meeting-memory.js';
export { getRecentMeetingSummaries, compressBoardMeeting, getBoardMemberBriefing } from './memory/meeting-memory.js';