// FILE: api/boardroom/lib/provider-caller/metrics.ts
// ═══════════════════════════════════════════════════════════════════════
// GATEWAY PERFORMANCE TRACKING
// ═══════════════════════════════════════════════════════════════════════
//
// In-memory call tracking per provider. Resets on cold start.
// Provides metrics for dashboard display and self-healing signals.
//
// Future: persist to boardroom_gateway_audit table for long-term analytics.
//
// ═══════════════════════════════════════════════════════════════════════

import type { CallRecord, GatewayMetrics, GatewayAuditDetails } from './types.js';

// =============================================================================
// IN-MEMORY PERFORMANCE TRACKING
// =============================================================================

const recentCalls: CallRecord[] = [];
const MAX_CALL_HISTORY = 200;

export function recordCall(record: CallRecord): void {
  recentCalls.push(record);
  if (recentCalls.length > MAX_CALL_HISTORY) {
    recentCalls.splice(0, recentCalls.length - MAX_CALL_HISTORY);
  }
}

/**
 * Get performance metrics for dashboard display.
 */
export function getGatewayMetrics(): GatewayMetrics {
  const now = Date.now();
  const last24h = recentCalls.filter(c => now - c.timestamp < 86400000);

  const byProvider: GatewayMetrics['byProvider'] = {};
  for (const call of last24h) {
    if (!byProvider[call.provider]) {
      byProvider[call.provider] = { calls: 0, failures: 0, fallbacks: 0, avgTime: 0 };
    }
    const p = byProvider[call.provider];
    p.calls++;
    if (!call.success) p.failures++;
    if (call.wasFallback) p.fallbacks++;
    p.avgTime = ((p.avgTime * (p.calls - 1)) + call.responseTime) / p.calls;
  }

  return {
    totalCalls24h: last24h.length,
    byProvider,
    fallbackRate: last24h.length > 0
      ? last24h.filter(c => c.wasFallback).length / last24h.length
      : 0,
    avgResponseTime: last24h.length > 0
      ? last24h.reduce((sum, c) => sum + c.responseTime, 0) / last24h.length
      : 0,
  };
}

// =============================================================================
// AUDIT LOG (fire and forget)
// =============================================================================

/**
 * Log a gateway call to the audit table. Non-blocking.
 * Future: boardroom_gateway_audit table with full call details.
 */
export function logGatewayCall(details: GatewayAuditDetails): void {
  // For now: in-memory tracking via recordCall
  // Future: persist to boardroom_gateway_audit table
  recordCall({
    provider: details.provider,
    model: details.model,
    responseTime: details.responseTime,
    success: details.success,
    wasFallback: details.isFallback,
    timestamp: Date.now(),
    source: details.source,
  });
}