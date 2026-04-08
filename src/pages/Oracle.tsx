// FILE: src/pages/Oracle.tsx
// ═══════════════════════════════════════════════════════════════════════
// Oracle Page — Thin re-export
// ═══════════════════════════════════════════════════════════════════════
//
// The old monolith has been replaced by the modular architecture in:
//   src/components/oracle/OraclePage.tsx       — thin orchestrator
//   src/components/oracle/hooks/               — all logic
//   src/components/oracle/components/          — all UI
//
// This file exists only so the router import path stays unchanged.
// ═══════════════════════════════════════════════════════════════════════

export { default } from '@/components/oracle/OraclePage';