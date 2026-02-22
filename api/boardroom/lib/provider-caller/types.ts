// FILE: api/boardroom/lib/provider-caller/types.ts
// ═══════════════════════════════════════════════════════════════════════
// ALL TYPE DEFINITIONS FOR THE BOARD'S AI GATEWAY
// ═══════════════════════════════════════════════════════════════════════
//
// Single source of truth for every interface used across the gateway.
// Import from here — never define gateway types inline elsewhere.
//
// ═══════════════════════════════════════════════════════════════════════

export interface ProviderCallResult {
  /** The AI response text */
  text: string;
  /** Which provider actually served the response */
  provider: string;
  /** Which model was used */
  model: string;
  /** Total response time in milliseconds */
  responseTime: number;
  /** Whether a fallback provider was used */
  isFallback: boolean;
  /** Estimated token counts (approximate) */
  tokenEstimate: {
    input: number;
    output: number;
    estimatedCost: number;
  };
}

export interface CallOptions {
  /** Max tokens to generate (default: 2048) */
  maxTokens?: number;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Override timeout in ms */
  timeoutMs?: number;
  /** Task context for audit logging */
  taskContext?: {
    memberSlug?: string;
    taskType?: string;
    meetingId?: string;
    source?: 'chat' | 'task' | 'briefing' | 'sandbox' | 'execution';
  };
  /** Skip fallback chain, fail hard on primary */
  noFallback?: boolean;
}

export interface GatewayHealthStatus {
  providers: Record<string, {
    configured: boolean;
    lastCallTime: number | null;
    lastError: string | null;
    fallbackRate: number;
    avgResponseTime: number;
  }>;
  localTowers: Record<string, {
    ip: string;
    port: string;
    reachable: boolean;
    lastChecked: number | null;
  }>;
}

export interface CallRecord {
  provider: string;
  model: string;
  responseTime: number;
  success: boolean;
  wasFallback: boolean;
  timestamp: number;
  source?: string;
}

export interface GatewayAuditDetails {
  memberSlug?: string;
  provider: string;
  model: string;
  source: string;
  responseTime: number;
  isFallback: boolean;
  success: boolean;
  tokenEstimate?: { input: number; output: number; estimatedCost: number };
  errorMessage?: string;
}

export interface TowerHealthResult {
  reachable: boolean;
  responseTime: number;
  models?: string[];
  error?: string;
}

export interface GatewayMetrics {
  totalCalls24h: number;
  byProvider: Record<string, {
    calls: number;
    failures: number;
    fallbacks: number;
    avgTime: number;
  }>;
  fallbackRate: number;
  avgResponseTime: number;
}

/** Standard message format for AI provider calls */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}