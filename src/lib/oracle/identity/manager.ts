// FILE: src/lib/oracle/identity/manager.ts
// Oracle Identity CRUD — get, create, update
//
// Every user gets exactly ONE Oracle identity (enforced by DB constraint).
// The identity stores personality, trust level, conversation counts,
// and eventually AI DNA from HYDRA scan data.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OracleIdentity } from '../types.js';
import { detectUserEnergy } from '../personality/energy.js';

// =============================================================================
// DEFAULT IDENTITY (fallback if DB write fails)
// =============================================================================

function createDefaultIdentity(userId: string): OracleIdentity {
  return {
    id: '',
    user_id: userId,
    oracle_name: null,
    name_chosen_at: null,
    name_chosen_by: 'oracle',
    personality_notes: '',
    personality_traits: [],
    communication_style: 'balanced',
    humor_level: 'moderate',
    expertise_areas: [],
    trust_level: 1,
    conversation_count: 0,
    total_messages: 0,
    preferred_response_length: 'short',
    user_energy: 'neutral',
    favorite_categories: [],
    first_interaction_at: new Date().toISOString(),
    last_interaction_at: new Date().toISOString(),
  };
}

// =============================================================================
// GET OR CREATE
// =============================================================================

/**
 * Fetch the user's Oracle identity, or create one if none exists.
 * DB constraint ensures one Oracle per user.
 */
export async function getOrCreateIdentity(
  supabase: SupabaseClient,
  userId: string
): Promise<OracleIdentity> {
  // Try to fetch existing
  const { data: existing } = await supabase
    .from('oracle_identity')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing as OracleIdentity;

  // Create new identity
  const { data: created, error } = await supabase
    .from('oracle_identity')
    .insert({ user_id: userId })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to create Oracle identity:', error.message);
    return createDefaultIdentity(userId);
  }

  return created as OracleIdentity;
}

// =============================================================================
// UPDATE AFTER CHAT
// =============================================================================

/**
 * Update Oracle identity after each conversation turn.
 * Increments counts, detects energy, updates categories, grows trust.
 * Non-blocking — caller should .catch() this.
 */
export async function updateIdentityAfterChat(
  supabase: SupabaseClient,
  identity: OracleIdentity,
  userMessage: string,
  scanHistory: any[]
): Promise<void> {
  if (!identity.id) return; // Skip if fallback identity

  const updates: Record<string, any> = {
    conversation_count: identity.conversation_count + 1,
    total_messages: identity.total_messages + 2, // user + oracle
    last_interaction_at: new Date().toISOString(),
  };

  // ── Update favorite categories from scan history ────────
  if (scanHistory.length > 0) {
    const categoryCounts: Record<string, number> = {};
    for (const scan of scanHistory) {
      const cat = scan.category || scan.analysis_result?.category || 'general';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
    updates.favorite_categories = topCategories;
    updates.expertise_areas = topCategories;
  }

  // ── Detect user energy ──────────────────────────────────
  updates.user_energy = detectUserEnergy(userMessage);

  // ── Trust grows with usage ──────────────────────────────
  const newTrust = Math.min(10, Math.floor((identity.conversation_count + 1) / 5) + 1);
  if (newTrust > identity.trust_level) {
    updates.trust_level = newTrust;
  }

  // ── Sprint C.1 hook: AI DNA update every 5 conversations ──
  // When ai-dna.ts is implemented, uncomment:
  // if ((identity.conversation_count + 1) % 5 === 0 && scanHistory.length >= 3) {
  //   const { buildAiDna } = await import('./ai-dna.js');
  //   const dna = buildAiDna(scanHistory);
  //   updates.ai_dna = dna.aiDna;
  //   updates.dominant_provider = dna.dominantProvider;
  //   updates.provider_affinity = dna.providerAffinity;
  // }

  try {
    await supabase
      .from('oracle_identity')
      .update(updates)
      .eq('id', identity.id);
  } catch (err: any) {
    console.warn('Identity update failed (non-fatal):', err.message);
  }
}

// =============================================================================
// CLAIM NAME
// =============================================================================

/**
 * Attempt to claim a globally unique name for an Oracle.
 * Returns true if successful, false if name is taken or reserved.
 * The UNIQUE constraint on oracle_name handles race conditions.
 */
export async function claimOracleName(
  supabase: SupabaseClient,
  identityId: string,
  name: string,
  chosenBy: 'oracle' | 'user' = 'oracle'
): Promise<boolean> {
  const cleanName = name.trim();

  // Check reserved names
  const { data: reserved } = await supabase
    .from('oracle_reserved_names')
    .select('name')
    .ilike('name', cleanName)
    .single();

  if (reserved) return false;

  // Try to claim (UNIQUE constraint handles race conditions)
  const { error } = await supabase
    .from('oracle_identity')
    .update({
      oracle_name: cleanName,
      name_chosen_at: new Date().toISOString(),
      name_chosen_by: chosenBy,
    })
    .eq('id', identityId);

  if (error) {
    // Unique constraint violation = name already taken
    if (error.code === '23505') return false;
    console.error('Name claim error:', error.message);
    return false;
  }

  return true;
}