// FILE: src/lib/oracle/index.ts
// Oracle Module — main exports
//
// Usage from api/oracle/chat.ts:
//   import { getOrCreateIdentity, updateIdentityAfterChat, ... } from '../src/lib/oracle/index.js';
//
// Or import from submodules directly:
//   import { buildSystemPrompt } from '../src/lib/oracle/prompt/index.js';
//
// Module map:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection
//   prompt/      → System prompt builder + sections
//   chips/       → Dynamic quick chips

// ── Types ───────────────────────────────────────────────
export type {
  OracleIdentity,
  AiDnaProfile,
  ProviderStats,
  QuickChip,
  OracleChatResponse,
  PersonalityEvolution,
} from './types.js';

// ── Identity ────────────────────────────────────────────
export {
  getOrCreateIdentity,
  updateIdentityAfterChat,
  claimOracleName,
} from './identity/index.js';

export { checkForNameCeremony } from './identity/index.js';
export { buildAiDna } from './identity/index.js';

// ── Personality ─────────────────────────────────────────
export { evolvePersonality } from './personality/index.js';
export { detectUserEnergy } from './personality/index.js';

// ── Prompt ──────────────────────────────────────────────
export { buildSystemPrompt } from './prompt/index.js';

// ── Chips ───────────────────────────────────────────────
export { getQuickChips } from './chips/index.js';