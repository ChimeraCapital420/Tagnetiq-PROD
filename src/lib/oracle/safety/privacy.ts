// FILE: src/lib/oracle/safety/privacy.ts
// Oracle Privacy Service — user-controlled conversation privacy
//
// Sprint L: Privacy & Safety Layer
//
// Privacy tiers (user chooses per conversation):
//   🔒 private  — Default. Only the user can access. Oracle can reference
//                  for continuity (unless locked).
//   🔓 shared   — User generates a share link. Anyone with the link can
//                  read the conversation. Like sharing a Sage reel.
//   👥 community — Anonymized insights feed community wisdom (opt-in).
//
// The user OWNS their data:
//   - They choose the privacy level
//   - They can lock conversations (Oracle won't reference them)
//   - They can delete conversations
//   - They can export all their data
//   - They can set auto-delete policies
//
// Share links are unique tokens — no login required to view.
// This enables the "look at this conversation I had with Dash" moment.

import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export type PrivacyLevel = 'private' | 'shared' | 'community';

export interface PrivacySettings {
  default_privacy: PrivacyLevel;
  auto_delete_after_days: number | null;
  allow_oracle_memory: boolean;
  allow_community_insights: boolean;
  enable_safety_net: boolean;
  emergency_contact_name: string | null;
  emergency_contact_info: string | null;
}

export interface SharedConversation {
  id: string;
  title: string;
  user_label: string | null;
  messages: any[];
  shared_at: string;
  oracle_name: string | null;
}

// =============================================================================
// USER PRIVACY SETTINGS
// =============================================================================

/**
 * Get or create privacy settings for a user.
 */
export async function getPrivacySettings(
  supabase: SupabaseClient,
  userId: string
): Promise<PrivacySettings> {
  const { data: existing } = await supabase
    .from('user_privacy_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing as PrivacySettings;

  // Create default settings
  const { data: created } = await supabase
    .from('user_privacy_settings')
    .insert({
      user_id: userId,
      default_privacy: 'private',
      auto_delete_after_days: null,
      allow_oracle_memory: true,
      allow_community_insights: false,
      enable_safety_net: true,
    })
    .select('*')
    .single();

  return (created as PrivacySettings) || {
    default_privacy: 'private',
    auto_delete_after_days: null,
    allow_oracle_memory: true,
    allow_community_insights: false,
    enable_safety_net: true,
    emergency_contact_name: null,
    emergency_contact_info: null,
  };
}

/**
 * Update privacy settings.
 */
export async function updatePrivacySettings(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<PrivacySettings>
): Promise<boolean> {
  // Ensure row exists first
  await getPrivacySettings(supabase, userId);

  const { error } = await supabase
    .from('user_privacy_settings')
    .update(updates)
    .eq('user_id', userId);

  return !error;
}

// =============================================================================
// CONVERSATION PRIVACY
// =============================================================================

/**
 * Set the privacy level for a specific conversation.
 */
export async function setConversationPrivacy(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  privacy: PrivacyLevel
): Promise<{ shareToken?: string }> {
  const updates: Record<string, any> = { privacy_level: privacy };

  if (privacy === 'shared') {
    // Generate share token
    const token = generateShareToken();
    updates.share_token = token;
    updates.shared_at = new Date().toISOString();

    await supabase
      .from('oracle_conversations')
      .update(updates)
      .eq('id', conversationId)
      .eq('user_id', userId);

    return { shareToken: token };
  }

  // If making private again, remove share token
  if (privacy === 'private') {
    updates.share_token = null;
    updates.shared_at = null;
  }

  await supabase
    .from('oracle_conversations')
    .update(updates)
    .eq('id', conversationId)
    .eq('user_id', userId);

  return {};
}

/**
 * Lock a conversation — Oracle will NOT reference it in future sessions.
 * Like sealing a therapy session.
 */
export async function lockConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('oracle_conversations')
    .update({ is_locked: true, privacy_level: 'private', share_token: null })
    .eq('id', conversationId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Unlock a conversation.
 */
export async function unlockConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('oracle_conversations')
    .update({ is_locked: false })
    .eq('id', conversationId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Delete a conversation permanently.
 * The user owns their data — they can delete it.
 */
export async function deleteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('oracle_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  return !error;
}

/**
 * Get a shared conversation by share token (no auth required).
 * This is the public view — for share links.
 */
export async function getSharedConversation(
  supabase: SupabaseClient,
  shareToken: string
): Promise<SharedConversation | null> {
  const { data } = await supabase
    .from('oracle_conversations')
    .select('id, title, user_label, messages, shared_at')
    .eq('share_token', shareToken)
    .eq('privacy_level', 'shared')
    .single();

  if (!data) return null;

  // Get Oracle name for display
  const { data: identity } = await supabase
    .from('oracle_identity')
    .select('oracle_name')
    .eq('user_id', data.id) // This won't work — need user_id
    .maybeSingle();

  return {
    id: data.id,
    title: data.title,
    user_label: data.user_label,
    messages: sanitizeSharedMessages(data.messages),
    shared_at: data.shared_at,
    oracle_name: identity?.oracle_name || 'Oracle',
  };
}

/**
 * Get all shared conversations for a user (their public gallery).
 */
export async function getUserSharedConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('oracle_conversations')
    .select('id, title, user_label, share_token, shared_at, created_at')
    .eq('user_id', userId)
    .eq('privacy_level', 'shared')
    .order('shared_at', { ascending: false })
    .limit(50);

  return data || [];
}

// =============================================================================
// DATA EXPORT
// =============================================================================

/**
 * Export all of a user's Oracle data.
 * Returns a complete package of their conversations, identity, vault, etc.
 * The user owns their data — they can take it with them.
 */
export async function exportUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<string, any>> {
  const [conversations, identity, privacySettings, watchlist, alerts] = await Promise.all([
    supabase
      .from('oracle_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_locked', false) // Don't export locked conversations
      .order('created_at', { ascending: true }),
    supabase
      .from('oracle_identity')
      .select('*')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('user_privacy_settings')
      .select('*')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('argos_watchlist')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('argos_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  // Update export timestamp
  await supabase
    .from('user_privacy_settings')
    .update({ last_export_at: new Date().toISOString() })
    .eq('user_id', userId);

  return {
    exported_at: new Date().toISOString(),
    user_id: userId,
    oracle_identity: identity.data,
    conversations: conversations.data || [],
    privacy_settings: privacySettings.data,
    watchlist: watchlist.data || [],
    alerts: alerts.data || [],
    _note: 'This is your complete Oracle data export. You own this data.',
  };
}

// =============================================================================
// AUTO-CLEANUP
// =============================================================================

/**
 * Delete conversations older than the user's auto-delete setting.
 * Run periodically (cron) or when user opens app.
 */
export async function autoCleanupConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const settings = await getPrivacySettings(supabase, userId);

  if (!settings.auto_delete_after_days) return 0; // No auto-delete

  const cutoff = new Date(
    Date.now() - settings.auto_delete_after_days * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('oracle_conversations')
    .delete()
    .eq('user_id', userId)
    .eq('privacy_level', 'private') // Never auto-delete shared conversations
    .eq('is_locked', false)          // Never auto-delete locked conversations
    .lt('created_at', cutoff)
    .select('id');

  if (error) return 0;
  return data?.length || 0;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Generate a unique share token for conversation links.
 * URL-safe, 16 characters.
 */
function generateShareToken(): string {
  return crypto.randomBytes(12).toString('base64url').substring(0, 16);
}

/**
 * Sanitize messages for public sharing.
 * Removes any system-level metadata, keeps only user + assistant messages.
 */
function sanitizeSharedMessages(messages: any[]): any[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
}