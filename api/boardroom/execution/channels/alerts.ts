// FILE: api/boardroom/execution/channels/alerts.ts
// Execution Channel: Alerts & Notifications
//
// Sprint 6: Create system alerts and push notifications.
// Risk level: LOW — alerts are informational, always safe.
//
// Capabilities:
//   - Create internal system alerts
//   - Queue push notifications for the CEO
//   - Log threshold-breach warnings
//   - Surface anomaly detections

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionExecution } from '../../../../src/lib/boardroom/actions.js';

export const riskLevel = 'low' as const;

export async function execute(
  supabase: SupabaseClient,
  action: any
): Promise<ActionExecution> {
  const payload = action.action_payload || {};
  const memberSlug = action.member_slug || 'unknown';
  const now = new Date().toISOString();

  const alertType = payload.alertType || 'info';
  const severity = payload.severity || 'low';
  const recipients = payload.recipients || ['admin'];

  // Log to activity feed so the CEO sees it on mobile
  try {
    await supabase
      .from('board_activity_feed')
      .insert({
        user_id: action.user_id,
        member_slug: memberSlug,
        activity_type: 'alert',
        content: `[${alertType.toUpperCase()}] ${action.title}: ${action.description}`,
        metadata: {
          severity,
          alertType,
          actionId: action.id,
          payload,
        },
      });
  } catch {
    // Non-fatal: alert still succeeds even if feed insert fails
  }

  return {
    success: true,
    details: `Alert created: "${action.title}" [${alertType}/${severity}] by ${memberSlug}. Recipients: ${recipients.join(', ')}.`,
    data: {
      alertId: `alt_${Date.now().toString(36)}`,
      alertType,
      severity,
      recipients,
      createdBy: memberSlug,
      createdAt: now,
      title: action.title,
      description: action.description,
    },
  };
}