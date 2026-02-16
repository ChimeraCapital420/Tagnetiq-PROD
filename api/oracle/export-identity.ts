// FILE: api/oracle/export-identity.ts
// Identity Passport — the Oracle's portable soul file
// GET: Returns a complete JSON document that IS this Oracle
// Can be imported into any compatible system: robot, glasses, car, new device
// This is THE architectural foundation for hardware portability

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all identity data in parallel
    const [
      identityResult,
      profileResult,
      memoriesResult,
      gamificationResult,
      conversationCountResult,
      scanCountResult,
      vaultCountResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('oracle_identity')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabaseAdmin
        .from('profiles')
        .select('display_name, settings')
        .eq('id', user.id)
        .single(),
      supabaseAdmin
        .from('oracle_memory_summaries')
        .select('summary, topics, interests_revealed, expertise_signals, emotional_markers, items_discussed, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabaseAdmin
        .from('oracle_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabaseAdmin
        .from('analysis_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabaseAdmin
        .from('vault_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    const identity = identityResult.data;
    const profile = profileResult.data;
    const memories = memoriesResult.data || [];
    const gamification = gamificationResult.data;

    if (!identity) {
      return res.status(404).json({ error: 'No Oracle identity found' });
    }

    // Build the soul file
    const passport = {
      // ── Passport metadata ─────────────────────────────
      _format: 'tagnetiq-oracle-passport',
      _version: '1.0.0',
      _exported_at: new Date().toISOString(),
      _platform: 'TagnetIQ',

      // ── Core identity ─────────────────────────────────
      identity: {
        oracle_name: identity.oracle_name,
        name_chosen_by: identity.name_chosen_by,
        personality_notes: identity.personality_notes,
        personality_traits: identity.personality_traits || [],
        communication_style: identity.communication_style,
        humor_level: identity.humor_level,
        preferred_response_length: identity.preferred_response_length,
      },

      // ── AI DNA (what makes this Oracle unique) ────────
      ai_dna: identity.ai_dna || null,
      dominant_provider: identity.dominant_provider || null,

      // ── Relationship with user ────────────────────────
      relationship: {
        user_name: profile?.display_name || null,
        trust_level: identity.trust_level,
        trust_metrics: identity.trust_metrics || null,
        conversation_count: identity.conversation_count,
        total_messages: identity.total_messages,
        first_interaction: identity.first_interaction_at,
        last_interaction: identity.last_interaction_at,
        user_energy_baseline: identity.user_energy,
      },

      // ── Knowledge domains ─────────────────────────────
      expertise: {
        favorite_categories: identity.favorite_categories || [],
        expertise_areas: identity.expertise_areas || [],
        total_scans: scanCountResult.count || 0,
        total_vault_items: vaultCountResult.count || 0,
        total_conversations: conversationCountResult.count || 0,
      },

      // ── Voice profile ─────────────────────────────────
      voice: {
        voice_profile: identity.voice_profile || null,
        preferred_voice_id: profile?.settings?.premium_voice_id || null,
        tts_voice_uri: profile?.settings?.tts_voice_uri || null,
      },

      // ── Long-term memory (compressed) ─────────────────
      memories: memories.map(m => ({
        summary: m.summary,
        topics: m.topics,
        interests: m.interests_revealed,
        expertise_signals: m.expertise_signals,
        emotional_markers: m.emotional_markers,
        items_discussed: m.items_discussed,
        date: m.created_at,
      })),

      // ── Aggregated knowledge ──────────────────────────
      aggregated: {
        all_topics: [...new Set(memories.flatMap(m => m.topics || []))],
        all_interests: extractUniqueInterests(memories),
        emotional_patterns: extractEmotionalPatterns(memories),
      },

      // ── Gamification / achievements ───────────────────
      achievements: gamification ? {
        total_points: gamification.total_points || 0,
        badges_earned: gamification.badges_earned || [],
        current_streak: gamification.current_streak || 0,
        longest_streak: gamification.longest_streak || 0,
        total_profit: gamification.total_profit || 0,
      } : null,

      // ── Reconstruction instructions ───────────────────
      _reconstruction_notes: [
        'This file contains everything needed to reconstruct this Oracle on any compatible device.',
        'The identity section defines WHO the Oracle is.',
        'The ai_dna section defines HOW the Oracle thinks.',
        'The relationship section defines the bond with this specific user.',
        'The memories section contains compressed conversation knowledge.',
        'The voice section defines how the Oracle should sound.',
        'Import this file into any TagnetIQ-compatible system to restore the Oracle.',
      ],
    };

    // Set download headers
    const filename = `oracle-${identity.oracle_name || 'passport'}-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.status(200).json(passport);
  } catch (error) {
    console.error('[Identity Passport] Error:', error);
    return res.status(500).json({ error: 'Failed to export identity' });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function extractUniqueInterests(memories: any[]): Array<{ name: string; intensity: string }> {
  const interestMap = new Map<string, string>();

  for (const mem of memories) {
    const interests = mem.interests_revealed || [];
    for (const interest of interests) {
      if (interest.category || interest.name) {
        const key = interest.category || interest.name;
        const existing = interestMap.get(key);
        // Keep highest intensity
        if (!existing || intensityRank(interest.intensity) > intensityRank(existing)) {
          interestMap.set(key, interest.intensity || 'casual');
        }
      }
    }
  }

  return Array.from(interestMap.entries()).map(([name, intensity]) => ({ name, intensity }));
}

function intensityRank(intensity: string): number {
  const ranks: Record<string, number> = { casual: 1, interested: 2, enthusiastic: 3, passionate: 4, obsessed: 5 };
  return ranks[intensity] || 0;
}

function extractEmotionalPatterns(memories: any[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const mem of memories) {
    const markers = mem.emotional_markers || [];
    for (const marker of markers) {
      const emotion = typeof marker === 'string' ? marker : marker.emotion || marker.type;
      if (emotion) {
        counts[emotion] = (counts[emotion] || 0) + 1;
      }
    }
  }

  return counts;
}
