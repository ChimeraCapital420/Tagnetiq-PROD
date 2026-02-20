// FILE: src/lib/boardroom/memory/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD MEMORY MODULE — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 0: Each board member remembers the founder differently.
// Sprint 3: Shared meeting memory — institutional memory from @all meetings.
//
// Server-side functions (require supabase admin client):
//   Read:  getFounderMemory, getCrossBoardFeed, getRecentDecisions,
//          getRecentMeetingSummaries
//   Write: extractFounderDetails, compressBoardThread,
//          trackEmotionalArc, updateFounderEnergy,
//          compressBoardMeeting
//
// Types (safe for client or server):
//   FounderDetail, CompressedMemory, BoardActivityEntry, FounderMemoryState,
//   MeetingSummary, MeetingResponse
//
// ═══════════════════════════════════════════════════════════════════════

// ── Founder Memory Types ─────────────────────────────────────────────
export type {
  FounderDetail,
  CompressedMemory,
  BoardActivityEntry,
  FounderMemoryState,
} from './founder-memory.js';

// ── Founder Memory — Read (chat.ts pre-call: fetch context) ──────────
export {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
} from './founder-memory.js';

// ── Founder Memory — Write (chat.ts post-call: background tasks) ─────
export {
  extractFounderDetails,
  compressBoardThread,
  trackEmotionalArc,
  updateFounderEnergy,
} from './founder-memory.js';

// ── Meeting Memory Types (Sprint 3) ─────────────────────────────────
export type {
  MeetingSummary,
  MeetingResponse,
} from './meeting-memory.js';

// ── Meeting Memory — Read (prompt Layer 9 injection) ─────────────────
export {
  getRecentMeetingSummaries,
} from './meeting-memory.js';

// ── Meeting Memory — Write (background compression after @all) ───────
export {
  compressBoardMeeting,
} from './meeting-memory.js';