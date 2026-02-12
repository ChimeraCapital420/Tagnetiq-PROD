// FILE: src/lib/oracle/types.ts
// All Oracle type definitions — single source of truth
//
// Sprint C:   OracleIdentity, QuickChip, ProviderStats
// Sprint C.1: AiDnaProfile (AI DNA — placeholder ready)
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
  ai_dna?: Record<string, any>;
  dominant_provider?: string | null;
  provider_affinity?: Record<string, any>;
}

// =============================================================================
// AI DNA (Sprint C.1 — interfaces ready, implementation in identity/ai-dna.ts)
// =============================================================================

export interface ProviderStats {
  scans: number;
  wins: number;
  avg_confidence: number;
  avg_speed_ms: number;
  total_confidence: number;
  total_speed: number;
}

export interface AiDnaProfile {
  vision_champion: string | null;
  reasoning_champion: string | null;
  web_champion: string | null;
  speed_champion: string | null;
  provider_personality_blend: Record<string, number>;
  total_provider_interactions: number;
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