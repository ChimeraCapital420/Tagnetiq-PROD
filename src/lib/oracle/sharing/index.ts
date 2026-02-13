// FILE: src/lib/oracle/sharing/index.ts
// Conversation Sharing & Public Profiles
//
// Sprint N: Every shared conversation is organic marketing.
//
// Flow:
//   1. User has a great conversation with their Oracle
//   2. They tap "Share" → generates a unique link
//   3. They post the link on social media
//   4. Anyone can view the conversation (no login required)
//   5. Viewer sees the Oracle's personality, the insights, the value
//   6. Viewer thinks "I want my own Oracle" → signs up
//
// That's the funnel. No ads. No marketing spend. Pure product-led growth.

import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface ShareResult {
  shareToken: string;
  shareUrl: string;
  ogTitle: string;
  ogDescription: string;
}

export interface PublicProfile {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  oracle_name: string | null;
  show_oracle_name: boolean;
  show_vault_stats: boolean;
  show_categories: boolean;
  total_shared: number;
  total_views: number;
  top_categories: string[];
  profile_slug: string | null;
}

export interface SharedConversationView {
  id: string;
  title: string;
  shareTitle: string | null;
  shareDescription: string | null;
  tags: string[];
  messages: Array<{ role: string; content: string; timestamp?: number }>;
  sharedAt: string;
  views: number;
  oracleName: string | null;
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    oracleName: string | null;
  } | null;
}

// =============================================================================
// SHARE A CONVERSATION
// =============================================================================

/**
 * Share a conversation — generates a unique link with metadata.
 * The user can customize the title and description for social previews.
 */
export async function shareConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  options?: {
    title?: string;
    description?: string;
    tags?: string[];
  }
): Promise<ShareResult | null> {
  const token = crypto.randomBytes(12).toString('base64url').substring(0, 16);

  // Get conversation for auto-generating OG metadata
  const { data: convo } = await supabase
    .from('oracle_conversations')
    .select('title, messages')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!convo) return null;

  // Auto-generate description from first exchange if not provided
  const autoDescription = options?.description || generateAutoDescription(convo.messages);
  const shareTitle = options?.title || convo.title;

  const { error } = await supabase
    .from('oracle_conversations')
    .update({
      privacy_level: 'shared',
      share_token: token,
      shared_at: new Date().toISOString(),
      share_title: shareTitle,
      share_description: autoDescription,
      share_tags: options?.tags || [],
    })
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) return null;

  // Update user's share count
  await supabase.rpc('increment_share_count', { uid: userId }).catch(() => {
    // Fallback: manual update if RPC doesn't exist yet
    supabase
      .from('public_profiles')
      .upsert({
        user_id: userId,
        total_shared: 1,
      }, { onConflict: 'user_id' })
      .then(() => {})
      .catch(() => {});
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tagnetiq.com';

  return {
    shareToken: token,
    shareUrl: `${baseUrl}/shared/${token}`,
    ogTitle: shareTitle,
    ogDescription: autoDescription,
  };
}

/**
 * Unshare a conversation — revoke the link.
 */
export async function unshareConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('oracle_conversations')
    .update({
      privacy_level: 'private',
      share_token: null,
      shared_at: null,
      share_title: null,
      share_description: null,
      share_tags: [],
    })
    .eq('id', conversationId)
    .eq('user_id', userId);

  return !error;
}

// =============================================================================
// VIEW SHARED CONVERSATIONS (PUBLIC — no auth)
// =============================================================================

/**
 * Get a shared conversation by token. Public endpoint.
 * Also tracks view analytics.
 */
export async function viewSharedConversation(
  supabase: SupabaseClient,
  shareToken: string,
  viewerInfo?: { referrer?: string; platform?: string }
): Promise<SharedConversationView | null> {
  const { data: convo } = await supabase
    .from('oracle_conversations')
    .select('id, user_id, title, share_title, share_description, share_tags, messages, shared_at, share_views')
    .eq('share_token', shareToken)
    .eq('privacy_level', 'shared')
    .single();

  if (!convo) return null;

  // Get Oracle name
  const { data: identity } = await supabase
    .from('oracle_identity')
    .select('oracle_name')
    .eq('user_id', convo.user_id)
    .single();

  // Get public profile
  const { data: profile } = await supabase
    .from('public_profiles')
    .select('display_name, bio, avatar_url, oracle_name')
    .eq('user_id', convo.user_id)
    .maybeSingle();

  // Track view (non-blocking)
  supabase
    .from('share_analytics')
    .insert({
      conversation_id: convo.id,
      share_token: shareToken,
      referrer: viewerInfo?.referrer || null,
      platform: viewerInfo?.platform || null,
    })
    .then(() => {})
    .catch(() => {});

  // Increment view count (non-blocking)
  supabase
    .from('oracle_conversations')
    .update({ share_views: (convo.share_views || 0) + 1 })
    .eq('id', convo.id)
    .then(() => {})
    .catch(() => {});

  // Sanitize messages — only user + assistant, no system prompts
  const cleanMessages = (convo.messages || [])
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

  return {
    id: convo.id,
    title: convo.title,
    shareTitle: convo.share_title,
    shareDescription: convo.share_description,
    tags: convo.share_tags || [],
    messages: cleanMessages,
    sharedAt: convo.shared_at,
    views: (convo.share_views || 0) + 1,
    oracleName: identity?.oracle_name || 'Oracle',
    profile: profile ? {
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      oracleName: profile.oracle_name,
    } : null,
  };
}

/**
 * Get featured conversations (public gallery).
 */
export async function getFeaturedConversations(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<any[]> {
  const { data } = await supabase
    .from('oracle_conversations')
    .select('id, title, share_title, share_description, share_tags, share_token, shared_at, share_views, user_id')
    .eq('privacy_level', 'shared')
    .eq('is_featured', true)
    .order('shared_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Get a user's shared conversation gallery.
 */
export async function getUserGallery(
  supabase: SupabaseClient,
  userId: string
): Promise<any[]> {
  const { data } = await supabase
    .from('oracle_conversations')
    .select('id, title, share_title, share_description, share_tags, share_token, shared_at, share_views')
    .eq('user_id', userId)
    .eq('privacy_level', 'shared')
    .order('shared_at', { ascending: false })
    .limit(50);

  return data || [];
}

// =============================================================================
// PUBLIC PROFILES
// =============================================================================

/**
 * Get or create a public profile.
 */
export async function getPublicProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PublicProfile> {
  const { data: existing } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  // Create from user's existing profile data
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  const { data: identity } = await supabase
    .from('oracle_identity')
    .select('oracle_name')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: created } = await supabase
    .from('public_profiles')
    .insert({
      user_id: userId,
      display_name: userProfile?.display_name || null,
      oracle_name: identity?.oracle_name || null,
    })
    .select('*')
    .single();

  return created || {
    display_name: null,
    bio: null,
    avatar_url: null,
    oracle_name: null,
    show_oracle_name: true,
    show_vault_stats: false,
    show_categories: true,
    total_shared: 0,
    total_views: 0,
    top_categories: [],
    profile_slug: null,
  };
}

/**
 * Update public profile.
 */
export async function updatePublicProfile(
  supabase: SupabaseClient,
  userId: string,
  updates: Partial<PublicProfile>
): Promise<boolean> {
  await getPublicProfile(supabase, userId); // Ensure exists

  const { error } = await supabase
    .from('public_profiles')
    .update(updates)
    .eq('user_id', userId);

  return !error;
}

/**
 * Get a public profile by slug (for public profile pages).
 */
export async function getProfileBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ profile: PublicProfile; gallery: any[] } | null> {
  const { data: profile } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('profile_slug', slug)
    .single();

  if (!profile) return null;

  const gallery = await getUserGallery(supabase, profile.user_id);

  return { profile, gallery };
}

// =============================================================================
// SHARE ANALYTICS
// =============================================================================

/**
 * Get share analytics for a user's conversations.
 */
export async function getShareAnalytics(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  totalShares: number;
  totalViews: number;
  topConversations: any[];
  referrerBreakdown: Record<string, number>;
}> {
  // Get user's shared conversations with view counts
  const { data: shared } = await supabase
    .from('oracle_conversations')
    .select('id, title, share_title, share_views, shared_at, share_token')
    .eq('user_id', userId)
    .eq('privacy_level', 'shared')
    .order('share_views', { ascending: false })
    .limit(10);

  const totalViews = (shared || []).reduce((sum, s) => sum + (s.share_views || 0), 0);

  // Get referrer breakdown from analytics
  const { data: analytics } = await supabase
    .from('share_analytics')
    .select('referrer')
    .in('conversation_id', (shared || []).map(s => s.id));

  const referrerBreakdown: Record<string, number> = {};
  for (const a of (analytics || [])) {
    const ref = a.referrer || 'direct';
    referrerBreakdown[ref] = (referrerBreakdown[ref] || 0) + 1;
  }

  return {
    totalShares: (shared || []).length,
    totalViews,
    topConversations: shared || [],
    referrerBreakdown,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function generateAutoDescription(messages: any[]): string {
  if (!Array.isArray(messages) || messages.length === 0) return '';

  // Find first user message and first assistant response
  const firstUser = messages.find((m: any) => m.role === 'user');
  const firstAssistant = messages.find((m: any) => m.role === 'assistant');

  if (!firstUser || !firstAssistant) return '';

  const userPreview = firstUser.content.substring(0, 60);
  const assistantPreview = firstAssistant.content.substring(0, 80);

  return `"${userPreview}..." — "${assistantPreview}..."`;
}