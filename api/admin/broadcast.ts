// FILE: api/admin/broadcast.ts
// Admin-only endpoint to send a broadcast message to all active users.
// Each user receives the broadcast in their existing direct conversation
// with TagnetIQ Official (or a new one is created if they don't have one).
//
// Auth: Requires authenticated user with profiles.is_admin = true.
//
// POST /api/admin/broadcast
// Body: {
//   title?: string,           // Optional bold title at top of message
//   body: string,             // Required, max 5000 chars
//   dryRun?: boolean,         // If true, returns recipient count without sending
//   excludeAdmins?: boolean,  // Skip other admins (useful for non-critical broadcasts)
// }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supaAdmin } from '../_lib/supaAdmin.js';
import { verifyUser } from '../_lib/security.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60, // Allow up to 60s for large user bases
};

const BATCH_SIZE = 50;
const MAX_BODY_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const SYSTEM_USER_ID = process.env.TAGNETIQ_SYSTEM_USER_ID;
  if (!SYSTEM_USER_ID) {
    return res.status(500).json({
      error: 'TAGNETIQ_SYSTEM_USER_ID environment variable is not configured. See messenger-sprint-setup.sql Step 5.'
    });
  }

  try {
    // 1. Authenticate
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Verify admin status
    const { data: profile, error: profileError } = await supaAdmin
      .from('profiles')
      .select('is_admin, screen_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      console.warn(`[Broadcast] Non-admin attempted access: ${user.id}`);
      return res.status(403).json({ error: 'Admin access required' });
    }

    // 3. Validate input
    const { title, body, dryRun, excludeAdmins } = req.body || {};

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    if (body.length > MAX_BODY_LENGTH) {
      return res.status(400).json({ 
        error: `Message body too long. Maximum ${MAX_BODY_LENGTH} characters.` 
      });
    }

    if (title && typeof title === 'string' && title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({ 
        error: `Title too long. Maximum ${MAX_TITLE_LENGTH} characters.` 
      });
    }

    // 4. Build recipient list
    let recipientQuery = supaAdmin
      .from('profiles')
      .select('id')
      .neq('id', SYSTEM_USER_ID)
      .neq('role', 'system');

    if (excludeAdmins) {
      recipientQuery = recipientQuery.eq('is_admin', false);
    }

    const { data: recipients, error: recipientsError } = await recipientQuery;

    if (recipientsError) {
      console.error('[Broadcast] Failed to fetch recipients:', recipientsError);
      return res.status(500).json({ error: 'Failed to load recipient list' });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(200).json({ 
        recipientCount: 0, 
        message: 'No eligible recipients found' 
      });
    }

    // 5. Dry run — return count without sending
    if (dryRun) {
      return res.status(200).json({
        dryRun: true,
        recipientCount: recipients.length,
        bodyPreview: body.substring(0, 200),
        titlePreview: title || null,
      });
    }

    // 6. Format the message
    const formattedMessage = title && title.trim().length > 0
      ? `**${title.trim()}**\n\n${body.trim()}`
      : body.trim();

    // 7. Send to all recipients in batches
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (recipient) => {
        try {
          // Find existing direct conversation with system user, or create one
          const { data: existing } = await supaAdmin
            .from('secure_conversations')
            .select('id')
            .eq('seller_id', SYSTEM_USER_ID)
            .eq('buyer_id', recipient.id)
            .is('listing_id', null)
            .limit(1)
            .maybeSingle();

          let conversationId = existing?.id;

          if (!conversationId) {
            const { data: newConvo, error: convoError } = await supaAdmin
              .from('secure_conversations')
              .insert({
                buyer_id: recipient.id,
                seller_id: SYSTEM_USER_ID,
                listing_id: null,
                conversation_type: 'direct',
              })
              .select('id')
              .single();

            if (convoError) {
              throw new Error(`Conversation creation failed: ${convoError.message}`);
            }
            conversationId = newConvo!.id;
          }

          // Insert the broadcast message
          const { error: msgError } = await supaAdmin
            .from('secure_messages')
            .insert({
              conversation_id: conversationId,
              sender_id: SYSTEM_USER_ID,
              encrypted_content: formattedMessage, // Stored as plaintext per Path 2 — no E2E encryption claim
              read: false,
            });

          if (msgError) {
            throw new Error(`Message insert failed: ${msgError.message}`);
          }

          successCount++;
        } catch (error: any) {
          failureCount++;
          if (errors.length < 10) {
            errors.push(`User ${recipient.id.substring(0, 8)}: ${error.message}`);
          }
        }
      }));
    }

    // 8. Audit log
    try {
      await supaAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'admin_broadcast_sent',
        resource_type: 'broadcast',
        metadata: {
          sender: profile.screen_name,
          recipient_count: recipients.length,
          success_count: successCount,
          failure_count: failureCount,
          title: title || null,
          body_length: body.length,
          excluded_admins: !!excludeAdmins,
        },
      });
    } catch (auditError) {
      console.warn('[Broadcast] Audit log failed (non-fatal):', auditError);
    }

    // 9. Return result
    return res.status(200).json({
      success: true,
      recipientCount: recipients.length,
      successCount,
      failureCount,
      errors: errors.length > 0 ? errors : undefined,
      message: failureCount === 0
        ? `Broadcast sent successfully to ${successCount} users`
        : `Broadcast sent to ${successCount} users, ${failureCount} failed`,
    });

  } catch (error: any) {
    console.error('[Broadcast] Unexpected error:', error);
    return res.status(500).json({ 
      error: error.message || 'Broadcast failed',
    });
  }
}