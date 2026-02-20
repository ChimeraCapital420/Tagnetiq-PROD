// FILE: api/boardroom/execution/channels/github.ts
// Execution Channel: GitHub (STUB)
//
// Sprint 6: Future channel for repo management, issue creation, PR reviews.
// Status: NOT YET IMPLEMENTED
//
// Planned capabilities:
//   - Create issues from board insights
//   - Triage and label incoming issues
//   - Draft PR descriptions
//   - Monitor CI/CD pipeline health

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionExecution } from '../../../../src/lib/boardroom/actions.js';

export const riskLevel = 'medium' as const;

export async function execute(
  _supabase: SupabaseClient,
  action: any
): Promise<ActionExecution> {
  return {
    success: false,
    details: `GitHub channel not yet implemented. Action "${action.title}" logged for future execution.`,
    data: {
      channel: 'github',
      status: 'not_implemented',
      action: action.action_payload,
      memberSlug: action.member_slug,
      loggedAt: new Date().toISOString(),
    },
  };
}