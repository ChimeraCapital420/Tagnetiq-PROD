// FILE: src/lib/oracle/chat/types.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Shared Types
// ═══════════════════════════════════════════════════════════════════════
// All TypeScript interfaces for the chat pipeline.
// Used by validators, detectors, context-builders, data-fetchers,
// prompt-assembler, response-pipeline, and persistence.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest } from '@vercel/node';
import type { BuildPromptParams } from '../prompt/builder.js';
import type { RoutingResult, OracleMessage } from '../providers/index.js';

// =============================================================================
// REQUEST / RESPONSE
// =============================================================================

/** Raw client context sent from useOracleChat hook (Liberation 2) */
export interface ClientContext {
  detectedIntent?: string;
  detectedEnergy?: string;
  localContext?: string[];
  deviceType?: 'mobile' | 'tablet' | 'desktop' | string;
  timestamp?: number;
}

/** Cached market data sent from client (Liberation 7) */
export interface CachedMarketData {
  result: any;
  cachedAt: string;
}

/** Validated + parsed request body */
export interface ChatRequest {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  conversationId: string | null;
  lightweight: boolean;
  analysisContext: AnalysisContext | null;
  clientContext: ClientContext | null;
  cachedMarketData: CachedMarketData | null;
}

/** Analysis context passed from ask.ts compatibility layer */
export interface AnalysisContext {
  itemName?: string;
  estimatedValue?: number;
  summary_reasoning?: string;
  valuation_factors?: string[];
  category?: string;
  confidence?: number;
}

/** Content creation detection result */
export interface ContentDetectionResult {
  isCreation: boolean;
  mode?: string;
  platform?: string;
}

/** Market item reference extracted from message */
export interface MarketItemRef {
  itemName: string;
  category?: string;
}

// =============================================================================
// CONTEXT — gathered data for prompt building
// =============================================================================

/** Everything fetched for a single chat turn (lightweight or full) */
export interface ChatContext {
  // Identity
  identity: any;

  // User data
  profile: any;
  scanHistory: any[];
  vaultItems: any[];

  // Memory systems
  relevantMemories: any[];
  emotionalMoments: any[];      // Liberation 3
  personalDetails: any[];       // Liberation 4
  unfulfilledPromises: any[];
  aggregatedInterests: any[];

  // Visual memory (full mode only)
  visualMemories: any[];
  recallResult: any | null;

  // Safety & trust
  privacySettings: any;
  recentSafety: {
    hasRecentEvents: boolean;
    lastEventType: string | null;
    daysSinceLastEvent: number | null;
  };
  trustMetrics: any;

  // Expertise
  expertiseLevel: {
    level: string;
    indicators: string[];
    conversationsAnalyzed: number;
  };

  // Argos (full mode only)
  argosData: {
    unreadCount: number;
    hasProactiveContent: boolean;
    watchlistCount?: number;
  };

  // Tier access
  access: any;
  userTier: string;
}

// =============================================================================
// RESPONSE PIPELINE
// =============================================================================

/** Result from the AI call (single or multi-perspective) */
export interface CallResult {
  text: string;
  providerId: string;
  model: string;
  responseTime: number;
  isFallback: boolean;
}

/** Final assembled response sent to client */
export interface ChatResponse {
  response: string;
  conversationId: string | null;
  quickChips: any[];
  scanCount: number;
  vaultCount: number;
  memoryCount: number;
  oracleName: string;
  energy: string;
  energyArc: string;
  recallUsed: boolean;
  recallCount: number;
  contentHint?: ContentDetectionResult;
  lightweight: boolean;
  tier: {
    current: string;
    messagesUsed: number;
    messagesLimit: number;
    messagesRemaining: number;
  };
  argos: {
    unreadAlerts: number;
    hasProactiveContent: boolean;
  };
  marketData?: {
    result: any;
    itemName: string;
    cachedAt: string;
  };
  _provider: {
    used: string;
    model: string;
    intent: string;
    responseTime: number;
    isFallback: boolean;
    deviceType: string;
    multiPerspective: boolean;
    continued: boolean;
  };
}