// FILE: src/lib/boardroom/memory/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD MEMORY MODULE — Barrel Exports
// ═══════════════════════════════════════════════════════════════════════
//
// Phase 0: Each board member remembers the founder differently.
//
// Server-side functions (require supabase admin client):
//   Read:  getFounderMemory, getCrossBoardFeed, getRecentDecisions
//   Write: extractFounderDetails, compressBoardThread,
//          trackEmotionalArc, updateFounderEnergy
//
// Types (safe for client or server):
//   FounderDetail, CompressedMemory, BoardActivityEntry, FounderMemoryState
//
// ═══════════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────────
export type {
  FounderDetail,
  CompressedMemory,
  BoardActivityEntry,
  FounderMemoryState,
} from './founder-memory.js';

// ── Read functions (chat.ts pre-call: fetch context) ─────────────────
export {
  getFounderMemory,
  getCrossBoardFeed,
  getRecentDecisions,
} from './founder-memory.js';

// ── Write functions (chat.ts post-call: background tasks) ────────────
export {
  extractFounderDetails,
  compressBoardThread,
  trackEmotionalArc,
  updateFounderEnergy,
} from './founder-memory.js';