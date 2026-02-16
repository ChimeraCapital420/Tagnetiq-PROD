// FILE: src/lib/oracle/community/matchmaker.ts
// Finds compatible users for Oracle-mediated introductions
// PRIVACY: Double opt-in ONLY. No personal info shared until both consent.
// Oracle acts as intermediary — "I know someone who's into Pyrex too..."

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// TYPES
// =============================================================================

export interface PotentialMatch {
  matchUserId: string;
  sharedInterests: string[];
  complementaryInventory: boolean; // user A has what user B wants
  compatibilityScore: number;      // 0-100
  matchReason: string;             // human-readable description for Oracle
}

export interface IntroductionRequest {
  id?: string;
  initiator_id: string;
  target_id: string;
  shared_interests: string[];
  match_reason: string;
  initiator_consent: boolean;
  target_consent: boolean | null;  // null = pending
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at?: string;
}

// =============================================================================
// FIND POTENTIAL MATCHES
// =============================================================================

/**
 * Find users who share strong interest overlap with the given user.
 * Uses aggregated interests from memory summaries + scan categories.
 */
export async function findPotentialMatches(
  userId: string,
  maxResults = 5,
): Promise<PotentialMatch[]> {
  // Get this user's interests from memory summaries
  const { data: userMemories } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('interests_revealed, items_discussed')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!userMemories?.length) return [];

  // Extract user's interest categories
  const userInterests = new Set<string>();
  for (const m of userMemories) {
    for (const interest of (m.interests_revealed || [])) {
      userInterests.add(interest.category.toLowerCase());
    }
    for (const item of (m.items_discussed || [])) {
      if (item.category) userInterests.add(item.category.toLowerCase());
    }
  }

  if (userInterests.size === 0) return [];

  // Check user's privacy settings — are they open to introductions?
  const { data: userProfile } = await supabaseAdmin
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single();

  if (userProfile?.settings?.introductions_opted_out) return [];

  // Find other users with overlapping interests
  // This is a simplified approach — at scale, use a dedicated matching service
  const { data: otherMemories } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('user_id, interests_revealed, items_discussed')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!otherMemories?.length) return [];

  // Group by user and find overlap
  const userScores = new Map<string, {
    sharedInterests: Set<string>;
    complementary: boolean;
  }>();

  for (const m of otherMemories) {
    const otherId = m.user_id;
    if (!userScores.has(otherId)) {
      userScores.set(otherId, { sharedInterests: new Set(), complementary: false });
    }

    const entry = userScores.get(otherId)!;

    for (const interest of (m.interests_revealed || [])) {
      const cat = interest.category.toLowerCase();
      if (userInterests.has(cat)) {
        entry.sharedInterests.add(cat);
      }
    }

    // Check for complementary inventory (user A selling what user B wants)
    for (const item of (m.items_discussed || [])) {
      if (item.action === 'considering' || item.action === 'scanning') {
        // This user wants something — check if our user has it
        const wantedCategory = (item.category || '').toLowerCase();
        if (userInterests.has(wantedCategory)) {
          entry.complementary = true;
        }
      }
    }
  }

  // Check privacy settings for potential matches
  const candidateIds = Array.from(userScores.entries())
    .filter(([, data]) => data.sharedInterests.size >= 2)
    .map(([id]) => id);

  if (candidateIds.length === 0) return [];

  const { data: candidateProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, settings')
    .in('id', candidateIds.slice(0, 20));

  const openToIntros = new Set(
    (candidateProfiles || [])
      .filter(p => !p.settings?.introductions_opted_out)
      .map(p => p.id)
  );

  // Check for existing pending/active introductions to avoid duplicates
  const { data: existingIntros } = await supabaseAdmin
    .from('oracle_introductions')
    .select('target_id, initiator_id')
    .or(`initiator_id.eq.${userId},target_id.eq.${userId}`)
    .in('status', ['pending', 'accepted']);

  const alreadyConnected = new Set(
    (existingIntros || []).map(i =>
      i.initiator_id === userId ? i.target_id : i.initiator_id
    )
  );

  // Score and rank
  const matches: PotentialMatch[] = [];

  for (const [otherId, data] of userScores.entries()) {
    if (!openToIntros.has(otherId)) continue;
    if (alreadyConnected.has(otherId)) continue;
    if (data.sharedInterests.size < 2) continue;

    const shared = Array.from(data.sharedInterests);
    const score = Math.min(100,
      shared.length * 20 + (data.complementary ? 25 : 0)
    );

    const reason = data.complementary
      ? `Both collect ${shared.slice(0, 3).join(', ')}, and they may have items you're looking for`
      : `Shared passion for ${shared.slice(0, 3).join(', ')}`;

    matches.push({
      matchUserId: otherId,
      sharedInterests: shared,
      complementaryInventory: data.complementary,
      compatibilityScore: score,
      matchReason: reason,
    });
  }

  return matches
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, maxResults);
}

// =============================================================================
// CREATE INTRODUCTION REQUEST
// =============================================================================

export async function createIntroduction(
  initiatorId: string,
  targetId: string,
  sharedInterests: string[],
  matchReason: string,
): Promise<IntroductionRequest | null> {
  const intro: IntroductionRequest = {
    initiator_id: initiatorId,
    target_id: targetId,
    shared_interests: sharedInterests,
    match_reason: matchReason,
    initiator_consent: true,
    target_consent: null,
    status: 'pending',
  };

  const { data, error } = await supabaseAdmin
    .from('oracle_introductions')
    .insert(intro)
    .select()
    .single();

  if (error) {
    console.error('[Matchmaker] Failed to create introduction:', error.message);
    return null;
  }

  return data;
}

// =============================================================================
// RESPOND TO INTRODUCTION
// =============================================================================

export async function respondToIntroduction(
  introId: string,
  userId: string,
  accepted: boolean,
): Promise<boolean> {
  const { data: intro, error: fetchError } = await supabaseAdmin
    .from('oracle_introductions')
    .select('*')
    .eq('id', introId)
    .single();

  if (fetchError || !intro) return false;

  // Verify user is the target
  if (intro.target_id !== userId) return false;

  const { error } = await supabaseAdmin
    .from('oracle_introductions')
    .update({
      target_consent: accepted,
      status: accepted ? 'accepted' : 'declined',
    })
    .eq('id', introId);

  return !error;
}

// =============================================================================
// GET PENDING INTRODUCTIONS FOR USER
// =============================================================================

export async function getPendingIntroductions(
  userId: string,
): Promise<IntroductionRequest[]> {
  const { data, error } = await supabaseAdmin
    .from('oracle_introductions')
    .select('*')
    .eq('target_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) return [];
  return data || [];
}
