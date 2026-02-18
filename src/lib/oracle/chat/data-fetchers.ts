// FILE: src/lib/oracle/chat/data-fetchers.ts
// ═══════════════════════════════════════════════════════════════════════
// Oracle Chat Module — Data Fetchers (Phase 2 Extraction)
// ═══════════════════════════════════════════════════════════════════════
//
// Extracted from api/oracle/chat.ts — the ~200-line lightweight vs full
// mode Promise.all blocks. Two functions, one return shape: ChatContext.
//
// fetchLightweightContext() — 8 parallel calls
//   Core identity + memory + concierge. Used for follow-up messages
//   and mobile quick-chat. Liberation 3 (emotional moments) and
//   Liberation 4 (personal details) included even here — cheap (~350
//   tokens combined) and essential for relationship depth at ALL tiers.
//
// fetchFullContext() — 16 parallel calls
//   Everything. Vault, scans, Argos, visual memory, recall, safety
//   history, promises, interests. First message of a session or when
//   the client signals full context is needed.
//
// ZERO LOGIC CHANGES — pure code movement from chat.ts handler.
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatContext } from './types.js';

// ── Oracle Modules (moved from chat.ts imports) ─────────
import { getOrCreateIdentity } from '../index.js';

import {
  getRelevantMemories,
  getExpertiseLevel,
  getUnfulfilledPromises,
  getAggregatedInterests,
  getEmotionalMoments,
} from '../memory/index.js';

import { getPersonalDetails } from '../memory/personal-details.js';

import { getTrustMetrics } from '../trust/tracker.js';

import {
  getPrivacySettings,
  getRecentSafetyContext,
} from '../safety/index.js';

import { fetchArgosContext } from '../prompt/argos-context.js';

import { recallMemories } from '../eyes/index.js';

// ── Detectors (for conditional recall) ──────────────────
import { isRecallQuestion } from './detectors.js';

// =============================================================================
// DEFAULTS — match the original `let` declarations in chat.ts
// =============================================================================

const DEFAULT_EXPERTISE = {
  level: 'learning',
  indicators: [] as string[],
  conversationsAnalyzed: 0,
};

const DEFAULT_RECENT_SAFETY = {
  hasRecentEvents: false,
  lastEventType: null as string | null,
  daysSinceLastEvent: null as number | null,
};

const DEFAULT_ARGOS = {
  unreadCount: 0,
  hasProactiveContent: false,
};

// =============================================================================
// LIGHTWEIGHT CONTEXT
// =============================================================================

/**
 * Fetch lightweight context for follow-up messages and mobile quick-chat.
 *
 * 8 parallel calls:
 *   identity, memories, trust, expertise, profile, privacy,
 *   emotional moments (L3), personal details (L4)
 *
 * Everything else gets safe defaults — no vault, scans, argos, visual memory.
 */
export async function fetchLightweightContext(
  supabase: SupabaseClient,
  userId: string,
  message: string,
  access: any,
): Promise<ChatContext> {
  const results = await Promise.all([
    getOrCreateIdentity(supabase, userId),
    getRelevantMemories(userId, message, 3).catch(() => []),
    getTrustMetrics(userId).catch(() => null),
    getExpertiseLevel(userId).catch(() => DEFAULT_EXPERTISE),
    supabase
      .from('profiles')
      .select('display_name, settings')
      .eq('id', userId)
      .single()
      .then(r => r.data)
      .catch(() => null),
    getPrivacySettings(supabase, userId).catch(() => null),
    getEmotionalMoments(userId, 5).catch(() => []),          // Liberation 3
    getPersonalDetails(userId, 20).catch(() => []),           // Liberation 4
  ]);

  return {
    // Identity
    identity: results[0],

    // User data (lightweight defaults)
    profile: results[4],
    scanHistory: [],
    vaultItems: [],

    // Memory systems
    relevantMemories: results[1],
    emotionalMoments: results[6],
    personalDetails: results[7],
    unfulfilledPromises: [],
    aggregatedInterests: [],

    // Visual memory (not loaded in lightweight)
    visualMemories: [],
    recallResult: null,

    // Safety & trust
    privacySettings: results[5],
    recentSafety: DEFAULT_RECENT_SAFETY,
    trustMetrics: results[2],

    // Expertise
    expertiseLevel: results[3],

    // Argos (not loaded in lightweight)
    argosData: DEFAULT_ARGOS,

    // Tier access (passed through)
    access,
    userTier: access.tier.current,
  };
}

// =============================================================================
// FULL CONTEXT
// =============================================================================

/**
 * Fetch full context for first messages and deep sessions.
 *
 * 16 parallel calls:
 *   identity, analysis_history, vault_items, profile, argos, privacy,
 *   recent safety, visual memory, recall (conditional), memories,
 *   expertise, trust, promises, interests, emotional moments (L3),
 *   personal details (L4)
 *
 * Everything loaded — vault, scans, Argos alerts, visual memory, recall.
 */
export async function fetchFullContext(
  supabase: SupabaseClient,
  userId: string,
  message: string,
  access: any,
): Promise<ChatContext> {
  const isRecall = isRecallQuestion(message);

  const [
    _identity, scanResult, vaultResult, profileResult,
    _argosData, _privacySettings, _recentSafety,
    visualMemoryResult, _recallResult,
    _relevantMemories, _expertiseLevel, _trustMetrics,
    _unfulfilledPromises, _aggregatedInterests,
    _emotionalMoments, _personalDetails,
  ] = await Promise.all([
    getOrCreateIdentity(supabase, userId),
    supabase
      .from('analysis_history')
      .select('id, item_name, estimated_value, category, confidence, decision, created_at, analysis_result, consensus_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('vault_items')
      .select('id, item_name, estimated_value, category, condition, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('profiles')
      .select('display_name, settings')
      .eq('id', userId)
      .single(),
    fetchArgosContext(supabase, userId),
    getPrivacySettings(supabase, userId).catch(() => null),
    getRecentSafetyContext(supabase, userId).catch(() => DEFAULT_RECENT_SAFETY),
    supabase
      .from('oracle_visual_memory')
      .select('id, mode, description, objects, extracted_text, location_hint, source, observed_at')
      .eq('user_id', userId)
      .is('forgotten_at', null)
      .order('observed_at', { ascending: false })
      .limit(30)
      .then(res => res)
      .catch(() => ({ data: [], error: null })),
    isRecall
      ? recallMemories(supabase, userId, { question: message }).catch(() => null)
      : Promise.resolve(null),
    getRelevantMemories(userId, message, 5).catch(() => []),
    getExpertiseLevel(userId).catch(() => DEFAULT_EXPERTISE),
    getTrustMetrics(userId).catch(() => null),
    getUnfulfilledPromises(userId).catch(() => []),
    getAggregatedInterests(userId).catch(() => []),
    getEmotionalMoments(userId, 5).catch(() => []),
    getPersonalDetails(userId, 30).catch(() => []),
  ]);

  return {
    // Identity
    identity: _identity,

    // User data
    profile: profileResult.data,
    scanHistory: scanResult.data || [],
    vaultItems: vaultResult.data || [],

    // Memory systems
    relevantMemories: _relevantMemories,
    emotionalMoments: _emotionalMoments,
    personalDetails: _personalDetails,
    unfulfilledPromises: _unfulfilledPromises,
    aggregatedInterests: _aggregatedInterests,

    // Visual memory
    visualMemories: visualMemoryResult.data || [],
    recallResult: _recallResult,

    // Safety & trust
    privacySettings: _privacySettings,
    recentSafety: _recentSafety,
    trustMetrics: _trustMetrics,

    // Expertise
    expertiseLevel: _expertiseLevel,

    // Argos
    argosData: _argosData,

    // Tier access (passed through)
    access,
    userTier: access.tier.current,
  };
}