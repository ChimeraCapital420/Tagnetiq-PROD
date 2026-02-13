// FILE: src/lib/oracle/types.ts
// All Oracle type definitions — single source of truth
//
// Sprint C:   OracleIdentity, QuickChip, ProviderStats
// Sprint C.1: AiDnaProfile (AI DNA — IMPLEMENTED)
// Sprint D+:  Add new types here

// =============================================================================
// ORACLE IDENTITY (matches oracle_identity table)
// =============================================================================

export interface OracleIdentity {
  id: string;
  user_id: string;

  // Identity
  oracle_name: string | null;
  name_chosen_at: string | null;
  name_chosen_by: string;

  // Personality (evolves over time)
  personality_notes: string;
  personality_traits: string[];
  communication_style: string;
  humor_level: string;
  expertise_areas: string[];

  // Relationship
  trust_level: number;
  conversation_count: number;
  total_messages: number;
  first_interaction_at: string;
  last_interaction_at: string;

  // Preferences
  preferred_response_length: string;
  user_energy: string;
  favorite_categories: string[];

  // ── AI DNA (Sprint C.1 — columns added via ALTER TABLE) ──
  ai_dna?: AiDnaProfile | null;
  dominant_provider?: string | null;
  provider_affinity?: Record<string, ProviderStats> | null;
}

// =============================================================================
// AI DNA (Sprint C.1 — IMPLEMENTED in identity/ai-dna.ts)
// =============================================================================

export interface ProviderStats {
  /** Total scans where this provider participated */
  scans: number;
  /** Times this provider's vote matched the consensus decision */
  wins: number;
  /** Average confidence score (0-1) */
  avg_confidence: number;
  /** Average response time in milliseconds */
  avg_speed_ms: number;
  /** Running total of confidence (for incremental avg calculation) */
  total_confidence: number;
  /** Running total of speed (for incremental avg calculation) */
  total_speed: number;
  /** Win rate as percentage (0-100) — derived from wins/scans */
  win_rate: number;
  /** Categories this provider performed best in */
  strong_categories: string[];
}

export interface AiDnaProfile {
  /** Provider with highest confidence on vision/image scans */
  vision_champion: string | null;
  /** Provider with highest win rate on reasoning tasks */
  reasoning_champion: string | null;
  /** Provider with best web/market search results */
  web_champion: string | null;
  /** Provider with fastest average response time */
  speed_champion: string | null;
  /** Normalized weights (0-1) mapping provider → personality influence */
  provider_personality_blend: Record<string, number>;
  /** Total provider vote interactions analyzed */
  total_provider_interactions: number;
  /** Timestamp of last DNA computation */
  last_computed_at: string;
  /** Number of scans analyzed to build this DNA */
  scans_analyzed: number;
}

// =============================================================================
// PROVIDER → PERSONALITY TRAIT MAPPING (used by prompt/ai-dna-block.ts)
// =============================================================================

/**
 * Each AI provider maps to personality traits the Oracle absorbs.
 * The Oracle NEVER mentions these providers — it just subtly adopts
 * their communication strengths as its own personality.
 */
export interface ProviderPersonalityMap {
  /** Canonical provider name (google, openai, anthropic, etc.) */
  provider: string;
  /** Personality traits this provider imparts */
  traits: string[];
  /** Communication style influence */
  style: string;
  /** How the Oracle describes this influence (without naming the provider) */
  oracleVoice: string;
}

// =============================================================================
// QUICK CHIPS
// =============================================================================

export interface QuickChip {
  label: string;
  message: string;
}

// =============================================================================
// CHAT RESPONSE (returned from handler)
// =============================================================================

export interface OracleChatResponse {
  response: string;
  conversationId: string | null;
  quickChips: QuickChip[];
  scanCount: number;
  vaultCount: number;
  oracleName: string | null;
}

// =============================================================================
// PERSONALITY EVOLUTION RESULT
// =============================================================================

export interface PersonalityEvolution {
  personality_notes: string;
  traits: string[];
  communication_style: string;
  humor_level: string;
  preferred_response_length: string;
}