// FILE: src/lib/oracle/identity/manager.ts
// Oracle Identity CRUD — get, create, update
//
// Every user gets exactly ONE Oracle identity (enforced by DB constraint).
// The identity stores personality, trust level, conversation counts,
// and AI DNA from HYDRA scan data (Sprint C.1).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OracleIdentity } from '../types.js';
import { detectEnergy } from '../personality/energy.js';

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

export async function getOrCreateIdentity(
  supabase: SupabaseClient,
  userId: string
): Promise<OracleIdentity> {
  const { data: existing } = await supabase
    .from('oracle_identity')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing as OracleIdentity;

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

export async function updateIdentityAfterChat(
  supabase: SupabaseClient,
  identity: OracleIdentity,
  userMessage: string,
  scanHistory: any[]
): Promise<void> {
  if (!identity.id) return;

  const updates: Record<string, any> = {
    conversation_count: identity.conversation_count + 1,
    total_messages: identity.total_messages + 2,
    last_interaction_at: new Date().toISOString(),
  };

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

  updates.user_energy = detectEnergy(userMessage);

  const newTrust = Math.min(10, Math.floor((identity.conversation_count + 1) / 5) + 1);
  if (newTrust > identity.trust_level) {
    updates.trust_level = newTrust;
  }

  if ((identity.conversation_count + 1) % 5 === 0 && scanHistory.length >= 3) {
    try {
      const { buildAiDna } = await import('./ai-dna.js');
      const dna = buildAiDna(scanHistory);
      updates.ai_dna = dna.aiDna;
      updates.dominant_provider = dna.dominantProvider;
      updates.provider_affinity = dna.providerAffinity;
    } catch (err: any) {
      console.warn('AI DNA computation failed (non-fatal):', err.message);
    }
  }

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

export async function claimOracleName(
  supabase: SupabaseClient,
  identityId: string,
  name: string,
  chosenBy: 'oracle' | 'user' = 'oracle'
): Promise<boolean> {
  const cleanName = name.trim();

  const { data: reserved } = await supabase
    .from('oracle_reserved_names')
    .select('name')
    .ilike('name', cleanName)
    .single();

  if (reserved) return false;

  const { error } = await supabase
    .from('oracle_identity')
    .update({
      oracle_name: cleanName,
      name_chosen_at: new Date().toISOString(),
      name_chosen_by: chosenBy,
    })
    .eq('id', identityId);

  if (error) {
    if (error.code === '23505') return false;
    console.error('Name claim error:', error.message);
    return false;
  }

  return true;
}
