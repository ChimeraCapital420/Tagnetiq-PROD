// FILE: api/oracle/share.ts
// Conversation Sharing API
//
// Sprint N: Organic marketing through shared conversations
//
// PUBLIC (no auth):
//   GET ?token=xxx                    → View shared conversation
//   GET ?featured=true                → Featured conversation gallery
//   GET ?profile=slug                 → View public profile + gallery
//
// AUTHENTICATED:
//   POST { action: 'share', conversationId, title?, description?, tags? }
//   POST { action: 'unshare', conversationId }
//   POST { action: 'gallery' }                    → User's shared gallery
//   POST { action: 'analytics' }                  → Share performance stats
//   POST { action: 'profile' }                    → Get own public profile
//   POST { action: 'update_profile', ... }        → Update public profile

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  shareConversation,
  unshareConversation,
  viewSharedConversation,
  getFeaturedConversations,
  getUserGallery,
  getPublicProfile,
  updatePublicProfile,
  getProfileBySlug,
  getShareAnalytics,
} from '../../src/lib/oracle/sharing/index.js';

export const config = {
  maxDuration: 15,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── PUBLIC: GET endpoints (no auth) ───────────────────
  if (req.method === 'GET') {
    const { token, featured, profile } = req.query;

    // View a shared conversation
    if (token && typeof token === 'string') {
      const referrer = (req.headers.referer || req.headers.referrer || '') as string;
      const ua = (req.headers['user-agent'] || '') as string;
      const platform = /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';

      const conversation = await viewSharedConversation(supabaseAdmin, token, {
        referrer: extractReferrerDomain(referrer),
        platform,
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or no longer shared.' });
      }

      return res.status(200).json(conversation);
    }

    // Featured gallery
    if (featured === 'true') {
      const conversations = await getFeaturedConversations(supabaseAdmin, 20);
      return res.status(200).json({ conversations, count: conversations.length });
    }

    // Public profile
    if (profile && typeof profile === 'string') {
      const result = await getProfileBySlug(supabaseAdmin, profile);
      if (!result) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Provide ?token=, ?featured=true, or ?profile=slug' });
  }

  // ── AUTHENTICATED: POST endpoints ─────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'An "action" is required.' });
    }

    switch (action) {
      // ── Share a conversation ──────────────────────────
      case 'share': {
        const { conversationId, title, description, tags } = req.body;
        if (!conversationId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const result = await shareConversation(supabaseAdmin, user.id, conversationId, {
          title,
          description,
          tags,
        });

        if (!result) {
          return res.status(404).json({ error: 'Conversation not found or not yours.' });
        }

        return res.status(200).json({
          success: true,
          ...result,
          message: 'Conversation shared! Anyone with the link can view it.',
        });
      }

      // ── Unshare ───────────────────────────────────────
      case 'unshare': {
        const { conversationId: unshareId } = req.body;
        if (!unshareId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const success = await unshareConversation(supabaseAdmin, user.id, unshareId);
        return res.status(200).json({
          success,
          message: success ? 'Share link revoked.' : 'Failed to unshare.',
        });
      }

      // ── User's shared gallery ─────────────────────────
      case 'gallery': {
        const gallery = await getUserGallery(supabaseAdmin, user.id);
        return res.status(200).json({ conversations: gallery, count: gallery.length });
      }

      // ── Share analytics ───────────────────────────────
      case 'analytics': {
        const analytics = await getShareAnalytics(supabaseAdmin, user.id);
        return res.status(200).json(analytics);
      }

      // ── Get public profile ────────────────────────────
      case 'profile': {
        const profile = await getPublicProfile(supabaseAdmin, user.id);
        return res.status(200).json({ profile });
      }

      // ── Update public profile ─────────────────────────
      case 'update_profile': {
        const allowed = [
          'display_name', 'bio', 'avatar_url', 'oracle_name',
          'show_oracle_name', 'show_vault_stats', 'show_categories',
          'profile_slug',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (key in req.body) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid profile fields provided.' });
        }

        // Validate slug format
        if (updates.profile_slug) {
          const slug = updates.profile_slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
          if (slug.length < 3 || slug.length > 30) {
            return res.status(400).json({ error: 'Profile slug must be 3-30 characters (letters, numbers, hyphens).' });
          }
          updates.profile_slug = slug;
        }

        const success = await updatePublicProfile(supabaseAdmin, user.id, updates);
        return res.status(200).json({ success });
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: share, unshare, gallery, analytics, profile, update_profile`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Share API error:', errMsg);
    return res.status(500).json({ error: 'Sharing service hiccup. Try again.' });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function extractReferrerDomain(referrer: string): string {
  if (!referrer) return 'direct';
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace('www.', '');
    if (host.includes('facebook')) return 'facebook';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('youtube')) return 'youtube';
    if (host.includes('reddit')) return 'reddit';
    if (host.includes('linkedin')) return 'linkedin';
    return host;
  } catch {
    return 'unknown';
  }
}