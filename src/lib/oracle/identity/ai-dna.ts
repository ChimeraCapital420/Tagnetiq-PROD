// FILE: src/lib/oracle/identity/ai-dna.ts
// AI DNA — Provider Affinity from HYDRA Scan Data
//
// Sprint C.1 — IMPLEMENTED
//
// This module analyzes the user's scan history (HYDRA consensus votes)
// to determine which AI providers work best for THIS specific user.
// The results shape the Oracle's personality subtly:
//
//   Heavy Google/vision user  → Oracle is visually descriptive
//   Heavy DeepSeek user       → Oracle is analytical, methodical
//   Heavy xAI/Perplexity      → Oracle references current market data
//
// All computation is server-side. Zero client payload.
// Called from identity/manager.ts every 5 conversations when scanHistory >= 3.

import type { AiDnaProfile, ProviderStats } from '../types.js';

// =============================================================================
// PROVIDER NAME NORMALIZATION MAP
// =============================================================================

/**
 * Maps raw model strings and provider IDs from HYDRA consensus_data
 * to canonical provider names. Handles all known variants.
 */
const PROVIDER_ALIASES: Record<string, string> = {
  // Google / Gemini
  'google':             'google',
  'gemini':             'google',
  'google-gemini':      'google',
  'gemini-2.0-flash':   'google',
  'gemini-1.5-flash':   'google',
  'gemini-1.5-pro':     'google',
  'gemini-pro':         'google',
  'gemini-pro-vision':  'google',

  // OpenAI / GPT
  'openai':             'openai',
  'gpt':                'openai',
  'gpt-4':              'openai',
  'gpt-4o':             'openai',
  'gpt-4o-mini':        'openai',
  'gpt-4-turbo':        'openai',
  'gpt-4-vision':       'openai',
  'chatgpt':            'openai',

  // Anthropic / Claude
  'anthropic':          'anthropic',
  'claude':             'anthropic',
  'claude-3':           'anthropic',
  'claude-3.5':         'anthropic',
  'claude-sonnet':      'anthropic',
  'claude-haiku':       'anthropic',
  'claude-opus':        'anthropic',
  'claude-sonnet-4-20250514': 'anthropic',
  'claude-3-5-sonnet-20241022': 'anthropic',

  // DeepSeek
  'deepseek':           'deepseek',
  'deepseek-chat':      'deepseek',
  'deepseek-reasoner':  'deepseek',
  'deepseek-coder':     'deepseek',

  // Perplexity
  'perplexity':         'perplexity',
  'pplx':               'perplexity',
  'sonar':              'perplexity',
  'sonar-pro':          'perplexity',

  // xAI / Grok
  'xai':                'xai',
  'grok':               'xai',
  'grok-2':             'xai',
  'grok-beta':          'xai',

  // Mistral
  'mistral':            'mistral',
  'mistral-large':      'mistral',
  'mistral-medium':     'mistral',
  'mixtral':            'mistral',

  // Groq (inference platform)
  'groq':               'groq',
  'llama':              'groq',
  'llama3':             'groq',
  'llama-3':            'groq',

  // Meta (direct)
  'meta':               'meta',
  'meta-llama':         'meta',

  // Amazon Bedrock
  'bedrock':            'bedrock',
  'amazon':             'bedrock',
  'nova':               'bedrock',
  'amazon-nova':        'bedrock',
};

// =============================================================================
// PROVIDER ROLE MAPPING (mirrors HYDRA pipeline/types.ts PROVIDER_ROLES)
// =============================================================================

type ProviderRole = 'vision' | 'reasoning' | 'web' | 'speed' | 'balanced';

const PROVIDER_ROLES: Record<string, ProviderRole> = {
  google:     'vision',
  openai:     'balanced',
  anthropic:  'reasoning',
  deepseek:   'reasoning',
  perplexity: 'web',
  xai:        'web',
  mistral:    'reasoning',
  groq:       'speed',
  meta:       'balanced',
  bedrock:    'balanced',
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Normalize raw provider name from consensus_data vote.
 * Handles model strings, provider IDs, and display names.
 *
 * @example
 *   normalizeProviderName('gpt-4o')           → 'openai'
 *   normalizeProviderName('Google')            → 'google'
 *   normalizeProviderName('claude-sonnet-4-20250514') → 'anthropic'
 *   normalizeProviderName('unknown-model-v2')  → null
 */
export function normalizeProviderName(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const cleaned = raw.trim().toLowerCase();

  // Direct match
  if (PROVIDER_ALIASES[cleaned]) return PROVIDER_ALIASES[cleaned];

  // Prefix match — e.g. "google-gemini-1.5-custom" → "google"
  for (const [alias, canonical] of Object.entries(PROVIDER_ALIASES)) {
    if (cleaned.startsWith(alias)) return canonical;
  }

  // Substring match — e.g. "my-custom-claude-3-wrapper" → "anthropic"
  for (const [alias, canonical] of Object.entries(PROVIDER_ALIASES)) {
    if (alias.length >= 4 && cleaned.includes(alias)) return canonical;
  }

  return null;
}

/**
 * Build AI DNA profile from user's HYDRA scan history.
 *
 * Analyzes consensus votes from scan records to determine:
 * 1. Per-provider stats (scans, wins, confidence, speed)
 * 2. Champion providers per role (vision, reasoning, web, speed)
 * 3. Personality blend weights for the Oracle prompt
 *
 * @param scanHistory - Array of scan records from analysis_history table.
 *   Each record should have either:
 *     - `consensus_data.votes` (HYDRA v9+ pipeline)
 *     - `analysis_result.votes` (legacy HYDRA)
 *     - `analysis_result.hydraConsensus.votes` (early format)
 */
export function buildAiDna(scanHistory: any[]): {
  aiDna: AiDnaProfile;
  dominantProvider: string | null;
  providerAffinity: Record<string, ProviderStats>;
} {
  const providerMap: Record<string, ProviderStats> = {};
  let totalInteractions = 0;

  // ── Phase 1: Extract votes from each scan ─────────────────────────
  for (const scan of scanHistory) {
    const votes = extractVotes(scan);
    if (!votes || votes.length === 0) continue;

    // Determine consensus decision for this scan
    const consensusDecision = extractConsensusDecision(scan);
    const category = scan.category
      || scan.detected_category
      || scan.analysis_result?.category
      || 'general';

    for (const vote of votes) {
      const provider = normalizeProviderName(
        vote.providerName || vote.providerId || vote.provider || ''
      );
      if (!provider) continue;

      // Initialize provider if first encounter
      if (!providerMap[provider]) {
        providerMap[provider] = {
          scans: 0,
          wins: 0,
          avg_confidence: 0,
          avg_speed_ms: 0,
          total_confidence: 0,
          total_speed: 0,
          win_rate: 0,
          strong_categories: [],
        };
      }

      const stats = providerMap[provider];
      stats.scans += 1;
      totalInteractions += 1;

      // Confidence
      const confidence = parseFloat(vote.confidence?.toString() || '0') || 0;
      stats.total_confidence += confidence;

      // Speed
      const speed = parseInt(vote.responseTime?.toString() || '0', 10) || 0;
      stats.total_speed += speed;

      // Win = this provider's decision matched the consensus
      const voteDecision = (vote.decision || '').toUpperCase();
      if (consensusDecision && voteDecision === consensusDecision) {
        stats.wins += 1;
      }

      // Track category performance (simple — just count appearances)
      if (category !== 'general' && !stats.strong_categories.includes(category)) {
        stats.strong_categories.push(category);
      }
    }
  }

  // ── Phase 2: Calculate averages ───────────────────────────────────
  for (const stats of Object.values(providerMap)) {
    if (stats.scans > 0) {
      stats.avg_confidence = stats.total_confidence / stats.scans;
      stats.avg_speed_ms = stats.total_speed / stats.scans;
      stats.win_rate = (stats.wins / stats.scans) * 100;
    }
    // Trim strong_categories to top 5
    stats.strong_categories = stats.strong_categories.slice(0, 5);
  }

  // ── Phase 3: Determine champions ──────────────────────────────────
  const champions = determineChampions(providerMap);

  // ── Phase 4: Build personality blend ──────────────────────────────
  const blend = buildPersonalityBlend(providerMap, totalInteractions);

  // ── Phase 5: Find dominant provider ───────────────────────────────
  const dominantProvider = findDominantProvider(providerMap);

  const aiDna: AiDnaProfile = {
    vision_champion: champions.vision,
    reasoning_champion: champions.reasoning,
    web_champion: champions.web,
    speed_champion: champions.speed,
    provider_personality_blend: blend,
    total_provider_interactions: totalInteractions,
    last_computed_at: new Date().toISOString(),
    scans_analyzed: scanHistory.length,
  };

  return {
    aiDna,
    dominantProvider,
    providerAffinity: providerMap,
  };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Extract votes array from a scan record.
 * Handles multiple data shapes from different HYDRA versions.
 */
function extractVotes(scan: any): any[] | null {
  // HYDRA v9+ pipeline format
  if (scan.consensus_data?.votes && Array.isArray(scan.consensus_data.votes)) {
    return scan.consensus_data.votes;
  }

  // Standard HYDRA format
  if (scan.analysis_result?.votes && Array.isArray(scan.analysis_result.votes)) {
    return scan.analysis_result.votes;
  }

  // Early HYDRA format with nested hydraConsensus
  if (scan.analysis_result?.hydraConsensus?.votes) {
    return scan.analysis_result.hydraConsensus.votes;
  }

  // Flat votes array on the scan record itself
  if (scan.votes && Array.isArray(scan.votes)) {
    return scan.votes;
  }

  return null;
}

/**
 * Extract the consensus decision from a scan record.
 */
function extractConsensusDecision(scan: any): string | null {
  const decision =
    scan.consensus_data?.consensus?.decision
    || scan.analysis_result?.consensus?.decision
    || scan.analysis_result?.hydraConsensus?.consensus?.decision
    || scan.analysis_result?.decision
    || scan.decision
    || null;

  return decision ? decision.toUpperCase() : null;
}

/**
 * Determine champion providers for each role.
 * Champions are selected by highest win_rate within their role category,
 * with avg_confidence as tiebreaker.
 */
function determineChampions(
  providerMap: Record<string, ProviderStats>
): { vision: string | null; reasoning: string | null; web: string | null; speed: string | null } {
  const champions = { vision: null as string | null, reasoning: null as string | null, web: null as string | null, speed: null as string | null };

  // Minimum scans to qualify as champion
  const MIN_SCANS = 2;

  // Best vision provider — highest confidence among vision-role providers
  champions.vision = findBestInRole('vision', providerMap, MIN_SCANS, 'avg_confidence');

  // Best reasoning provider — highest win rate among reasoning-role providers
  champions.reasoning = findBestInRole('reasoning', providerMap, MIN_SCANS, 'win_rate');

  // Best web provider — highest win rate among web-role providers
  champions.web = findBestInRole('web', providerMap, MIN_SCANS, 'win_rate');

  // Speed champion — lowest avg_speed_ms among all providers with enough scans
  let fastestProvider: string | null = null;
  let fastestSpeed = Infinity;
  for (const [name, stats] of Object.entries(providerMap)) {
    if (stats.scans >= MIN_SCANS && stats.avg_speed_ms > 0 && stats.avg_speed_ms < fastestSpeed) {
      fastestSpeed = stats.avg_speed_ms;
      fastestProvider = name;
    }
  }
  champions.speed = fastestProvider;

  return champions;
}

/**
 * Find the best provider for a given role.
 */
function findBestInRole(
  role: ProviderRole,
  providerMap: Record<string, ProviderStats>,
  minScans: number,
  sortBy: 'win_rate' | 'avg_confidence'
): string | null {
  const candidates = Object.entries(providerMap)
    .filter(([name, stats]) => {
      const providerRole = PROVIDER_ROLES[name] || 'balanced';
      return (providerRole === role || providerRole === 'balanced') && stats.scans >= minScans;
    })
    .sort((a, b) => b[1][sortBy] - a[1][sortBy]);

  return candidates.length > 0 ? candidates[0][0] : null;
}

/**
 * Build personality blend weights (0-1) from provider interaction data.
 *
 * The blend is a normalized distribution of "personality influence" —
 * providers with more scans and higher win rates get more influence
 * over the Oracle's communication style.
 */
function buildPersonalityBlend(
  providerMap: Record<string, ProviderStats>,
  totalInteractions: number
): Record<string, number> {
  if (totalInteractions === 0) return {};

  const blend: Record<string, number> = {};
  let totalWeight = 0;

  for (const [provider, stats] of Object.entries(providerMap)) {
    // Weight = (scan share) × (win rate factor) × (confidence factor)
    const scanShare = stats.scans / totalInteractions;
    const winFactor = 0.5 + (stats.win_rate / 200); // 0.5–1.0 range
    const confFactor = 0.5 + (stats.avg_confidence / 2); // 0.5–1.0 range

    const weight = scanShare * winFactor * confFactor;
    blend[provider] = weight;
    totalWeight += weight;
  }

  // Normalize to 0-1 range
  if (totalWeight > 0) {
    for (const provider of Object.keys(blend)) {
      blend[provider] = parseFloat((blend[provider] / totalWeight).toFixed(3));
    }
  }

  return blend;
}

/**
 * Find the single most dominant provider (highest blend weight).
 */
function findDominantProvider(providerMap: Record<string, ProviderStats>): string | null {
  let best: string | null = null;
  let bestScore = 0;

  for (const [name, stats] of Object.entries(providerMap)) {
    // Score = scans × win_rate × avg_confidence
    const score = stats.scans * (stats.win_rate / 100) * stats.avg_confidence;
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}