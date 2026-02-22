// FILE: src/lib/oracle/client/provider-report-bridge.ts
// ═══════════════════════════════════════════════════════════════════════
// Provider Report → Oracle Bridge (Client-Side)
// ═══════════════════════════════════════════════════════════════════════
// Reads the sessionStorage event written by ProviderReportSheet and
// returns it for inclusion in the Oracle chat request body.
//
// CONSUME-ONCE pattern: after reading, the event is cleared from
// sessionStorage so Oracle doesn't repeat itself across messages.
//
// Cost: $0. Pure client-side sessionStorage read.
// Latency: <1ms.
//
// USAGE in useOracleChat hook (or wherever chat requests are built):
//
//   import { consumeProviderReportEvent } from '@/lib/oracle/client/provider-report-bridge';
//
//   // Before sending message to /api/oracle/chat:
//   const providerReportEvent = consumeProviderReportEvent();
//   const body = {
//     message,
//     conversationHistory,
//     // ... existing fields ...
//     providerReportEvent,  // <-- add this field
//   };
//
// The server-side prompt-assembler.ts will pick it up and inject
// it into the system prompt if present and fresh (<5 min old).
// ═══════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'oracle_context_event';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface ProviderReportEvent {
  type: 'provider_report_opened';
  provider: string;
  itemName: string;
  providerValue: number;
  consensusValue: number;
  providerDecision?: string;
  consensusDecision?: string;
  timestamp: number;
}

/**
 * Read and consume the provider report event from sessionStorage.
 * Returns null if no event exists, event is stale, or event is malformed.
 * Clears the event after reading (consume-once).
 */
export function consumeProviderReportEvent(): ProviderReportEvent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Clear immediately (consume-once)
    sessionStorage.removeItem(STORAGE_KEY);

    const event = JSON.parse(raw);

    // Validate shape
    if (!event || event.type !== 'provider_report_opened') return null;
    if (!event.provider || !event.timestamp) return null;

    // Check freshness
    const age = Date.now() - event.timestamp;
    if (age > MAX_AGE_MS) return null;

    return event as ProviderReportEvent;
  } catch {
    // sessionStorage read failed — degrade silently
    return null;
  }
}

/**
 * Peek at the provider report event without consuming it.
 * Useful for UI hints ("Oracle noticed you looked at X").
 */
export function peekProviderReportEvent(): ProviderReportEvent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const event = JSON.parse(raw);
    if (!event || event.type !== 'provider_report_opened') return null;

    const age = Date.now() - event.timestamp;
    if (age > MAX_AGE_MS) return null;

    return event as ProviderReportEvent;
  } catch {
    return null;
  }
}