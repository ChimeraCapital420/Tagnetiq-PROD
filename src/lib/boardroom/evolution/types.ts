// FILE: src/lib/boardroom/evolution/types.ts
// ═══════════════════════════════════════════════════════════════════════
// EVOLUTION ENGINE TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js';

// Re-export for convenience — modules import SupabaseClient from here
export type { SupabaseClient };

// ============================================================================
// BOARD MEMBER
// ============================================================================

export interface BoardMember {
  slug: string;
  name: string;
  title: string;
  role: string;
  ai_provider: string;
  ai_model: string;
  personality: Record<string, any>;
  expertise: string[];
  system_prompt: string;
  evolved_prompt: string | null;
  voice_style: string;
  ai_dna: Record<string, number>;
  dominant_provider: string | null;
  provider_affinity: Record<string, any>;
  personality_evolution: Record<string, any>;
  trust_level: number;
  total_interactions: number;
  cross_domain_assists: number;
  current_energy: string;
  last_active_at: string | null;
  is_active: boolean;
  display_order: number;
}

// ============================================================================
// INTERACTION TRACKING
// ============================================================================

export interface InteractionResult {
  memberSlug: string;
  providerUsed: string;
  modelUsed: string;
  responseTime: number;
  wasFallback: boolean;
  wasCrossDomain: boolean;
  topicCategory: string;
  messageType: 'chat' | 'analysis' | 'decision' | 'cross_domain' | 'autonomous';
  // ── Phase 0 additions ──
  founderEnergy?: string;
  founderArc?: string;
  memoryHit?: boolean;
  feedInjected?: boolean;
}

export interface InteractionOutcome {
  memberSlug: string;
  interactionId?: string;
  wasHelpful?: boolean;
  wasActedOn?: boolean;
  followUpCount?: number;
  responseLength?: number;
  energyShift?: string;
}

// ============================================================================
// SPRINT 4: PERSONALITY EVOLUTION
// ============================================================================

export interface PersonalityEvolutionData {
  generation: number;
  voice_signature: string | null;
  catchphrases: string[];
  cross_member_opinions: Record<string, string>;
  inside_references: Array<{ reference: string; context: string }>;
  expertise_evolution: string | null;
  communication_style: string | null;
  last_evolved_at: string;
}

export interface EvolutionHistoryEntry {
  id: string;
  member_slug: string;
  generation: number;
  evolved_prompt: string | null;
  voice_signature: string | null;
  catchphrases: string[];
  cross_member_opinions: Record<string, string>;
  inside_references: Array<{ reference: string; context: string }>;
  expertise_evolution: string | null;
  communication_style: string | null;
  trigger_interaction_count: number;
  evolved_at: string;
}