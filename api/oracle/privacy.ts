// FILE: api/oracle/privacy.ts
// Privacy & Safety Management API
//
// Sprint L: User-controlled conversation privacy
//
// Endpoints (action-based):
//   POST { action: 'settings' }                          → Get privacy settings
//   POST { action: 'update_settings', ... }              → Update privacy settings
//   POST { action: 'share', conversationId }             → Make conversation shareable (returns link)
//   POST { action: 'unshare', conversationId }           → Revoke share link
//   POST { action: 'lock', conversationId }              → Lock conversation (Oracle won't reference)
//   POST { action: 'unlock', conversationId }            → Unlock conversation
//   POST { action: 'delete', conversationId }            → Permanently delete conversation
//   POST { action: 'shared_list' }                       → List user's shared conversations
//   POST { action: 'export' }                            → Export all Oracle data
//   GET  ?token=xxx                                      → View shared conversation (public, no auth)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import {
  getPrivacySettings,
  updatePrivacySettings,
  setConversationPrivacy,
  lockConversation,
  unlockConversation,
  deleteConversation,
  getSharedConversation,
  getUserSharedConversations,
  exportUserData,
} from '../../src/lib/oracle/safety/index.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── PUBLIC: View shared conversation (GET with token) ─
  if (req.method === 'GET') {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Share token is required.' });
    }

    const conversation = await getSharedConversation(supabaseAdmin, token);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or no longer shared.' });
    }

    return res.status(200).json(conversation);
  }

  // ── AUTHENTICATED: Everything else ────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { action } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'An "action" string is required.' });
    }

    switch (action) {
      // ── Get privacy settings ──────────────────────────
      case 'settings': {
        const settings = await getPrivacySettings(supabaseAdmin, user.id);
        return res.status(200).json({ settings });
      }

      // ── Update privacy settings ───────────────────────
      case 'update_settings': {
        const allowed = [
          'default_privacy', 'auto_delete_after_days', 'allow_oracle_memory',
          'allow_community_insights', 'enable_safety_net',
          'emergency_contact_name', 'emergency_contact_info',
        ];

        const updates: Record<string, any> = {};
        for (const key of allowed) {
          if (key in req.body) updates[key] = req.body[key];
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: 'No valid settings provided.' });
        }

        const success = await updatePrivacySettings(supabaseAdmin, user.id, updates);
        return res.status(200).json({ success });
      }

      // ── Share a conversation (generate link) ──────────
      case 'share': {
        const { conversationId } = req.body;
        if (!conversationId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const result = await setConversationPrivacy(
          supabaseAdmin, user.id, conversationId, 'shared'
        );

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || '';
        const shareUrl = `${baseUrl}/api/oracle/privacy?token=${result.shareToken}`;

        return res.status(200).json({
          success: true,
          shareToken: result.shareToken,
          shareUrl,
          message: 'Conversation is now shareable. Anyone with the link can view it.',
        });
      }

      // ── Revoke share link ─────────────────────────────
      case 'unshare': {
        const { conversationId: unshareId } = req.body;
        if (!unshareId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        await setConversationPrivacy(supabaseAdmin, user.id, unshareId, 'private');
        return res.status(200).json({
          success: true,
          message: 'Share link revoked. Conversation is private again.',
        });
      }

      // ── Lock conversation ─────────────────────────────
      case 'lock': {
        const { conversationId: lockId } = req.body;
        if (!lockId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const success = await lockConversation(supabaseAdmin, user.id, lockId);
        return res.status(200).json({
          success,
          message: success
            ? 'Conversation locked. Oracle will not reference it in future sessions.'
            : 'Failed to lock conversation.',
        });
      }

      // ── Unlock conversation ───────────────────────────
      case 'unlock': {
        const { conversationId: unlockId } = req.body;
        if (!unlockId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const success = await unlockConversation(supabaseAdmin, user.id, unlockId);
        return res.status(200).json({ success });
      }

      // ── Delete conversation permanently ───────────────
      case 'delete': {
        const { conversationId: deleteId } = req.body;
        if (!deleteId) {
          return res.status(400).json({ error: '"conversationId" is required.' });
        }

        const success = await deleteConversation(supabaseAdmin, user.id, deleteId);
        return res.status(200).json({
          success,
          message: success ? 'Conversation permanently deleted.' : 'Failed to delete.',
        });
      }

      // ── List shared conversations ─────────────────────
      case 'shared_list': {
        const shared = await getUserSharedConversations(supabaseAdmin, user.id);
        return res.status(200).json({ conversations: shared, count: shared.length });
      }

      // ── Export all data ───────────────────────────────
      case 'export': {
        const exportData = await exportUserData(supabaseAdmin, user.id);
        return res.status(200).json(exportData);
      }

      default:
        return res.status(400).json({
          error: `Unknown action: "${action}". Valid: settings, update_settings, share, unshare, lock, unlock, delete, shared_list, export`,
        });
    }

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Privacy API error:', errMsg);
    return res.status(500).json({ error: 'Privacy service hiccup. Try again.' });
  }
}