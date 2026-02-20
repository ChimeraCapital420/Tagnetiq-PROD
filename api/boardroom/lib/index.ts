// FILE: api/boardroom/lib/index.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD INFRASTRUCTURE — Central Nervous System
// ═══════════════════════════════════════════════════════════════════════
//
// This is the Oracle engine, reborn for the CEO's private board.
//
// Same memory extraction. Same energy detection. Same personality
// evolution. Same compression. Same emotional arc tracking.
// But now powering 15 autonomous department heads instead of a
// consumer product.
//
// Everything the board needs to THINK, REMEMBER, and ACT flows
// through this directory:
//
//   provider-caller.ts  — AI Gateway (routing, fallback, audit, towers)
//   prompt-builder.ts   — Prompt Assembly (8-layer: identity + protocols
//                         + memory + energy + feed + trust + DNA + voice)
//   chat/               — Modular chat handler (Sprint 1 refactor)
//
//   [future] execution-gateway.ts — Trust-gated action channels
//   [future] audit-log.ts         — Full audit trail for every action
//   [future] scheduler.ts         — Meeting scheduling + cron triggers
//
// CONSUMERS:
//   api/boardroom/chat.ts       — Conversations (1:1, committee, full board)
//   api/boardroom/tasks.ts      — Task assignment + execution
//   api/boardroom/briefing.ts   — Autonomous daily briefings
//   api/boardroom/sandbox/      — Overnight autonomous simulations (future)
//   api/boardroom/execution/    — Trust-gated real-world actions (future)
//
// ═══════════════════════════════════════════════════════════════════════

// =============================================================================
// PROVIDER GATEWAY
// =============================================================================
// The board's connection to AI. 8 cloud providers + local GPU towers.
// Intelligent fallback chains. Every conversation, task, briefing,
// and sandbox run flows through here.

export {
  // ── Core calls ────────────────────────────────────────
  callProviderDirect,        // Single provider, no fallback (use for specific needs)
  callWithFallback,          // Primary → Groq → OpenAI (use for conversations)

  // ── Configuration ─────────────────────────────────────
  getApiKey,                 // Resolve API key for a provider

  // ── Shared infrastructure ─────────────────────────────
  getSupaAdmin,              // Singleton Supabase admin client
  getCompanyContext,          // Cached company knowledge from DB

  // ── Types ─────────────────────────────────────────────
  type ProviderCallResult,   // Rich result: text + provider + timing
  type CallOptions,          // Config: tokens, temperature, timeout
} from './provider-caller.js';

// =============================================================================
// PROMPT ASSEMBLY
// =============================================================================
// 8-layer prompt builder that makes each board member unique and context-aware.
// Identity → Elevation Protocols → Memory → Energy → Cross-Board Feed
// → Decisions → Meeting Type → Voice
//
// This is what turns a generic AI model into Athena, Griffin, Prometheus.

export {
  buildBoardMemberPrompt,    // Full 8-layer prompt for conversations
  buildTaskPrompt,           // Task-specific prompt with deliverable format
  buildBriefingPrompt,       // Briefing-specific prompt (morning/evening/weekly)
} from './prompt-builder.js';

// =============================================================================
// CHAT MODULE (Sprint 1 refactor)
// =============================================================================
// Modular chat handlers — extracted from the 1,008-line monolith.
// Import individual handlers or use the barrel.

export {
  handleSingleMemberChat,
  handleCommitteeMeeting,
  handleFullBoardMeeting,
  loadOrCreateConversation,
  persistExchange,
  compressAndArchive,
  runBackgroundTasks,
  type ConversationState,
  type ConversationMessage,
  type SingleChatParams,
  type CommitteeParams,
  type FullBoardParams,
  type BackgroundTaskParams,
  type MemberResponse,
  COMPRESSION_THRESHOLD,
  MAX_CONTEXT_MESSAGES,
  VALID_MEETING_TYPES,
} from './chat/index.js';

// =============================================================================
// FUTURE EXPORTS (uncomment as modules are built)
// =============================================================================

// ── Execution Gateway (Sprint 4L) ──────────────────────
// Trust-gated channels: social media, GitHub, Stripe, email,
// customer support, hiring platforms.
//
// export {
//   executeAction,
//   getApprovalQueue,
//   approveExecution,
//   rejectExecution,
//   getExecutionHistory,
//   type ExecutionChannel,
//   type ExecutionResult,
// } from './execution-gateway.js';

// ── Audit Log (Sprint 4L) ──────────────────────────────
// Full trail: every AI call, every action, every approval.
// Immutable. Queryable. The board's black box.
//
// export {
//   logAction,
//   queryAuditLog,
//   getAuditSummary,
//   type AuditEntry,
// } from './audit-log.js';

// ── Meeting Scheduler (Sprint 3L) ──────────────────────
// Scheduled board sessions: daily standups, weekly strategy,
// monthly reviews, emergency sessions.
//
// export {
//   scheduleMeeting,
//   getUpcomingMeetings,
//   triggerEmergencySession,
//   type ScheduledMeeting,
// } from './scheduler.js';