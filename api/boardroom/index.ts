// FILE: api/boardroom/index.ts
// Executive Boardroom - Dashboard data including tasks, capabilities, and execution status
//
// Sprint 6: Added execution_queue (pending actions, kill switch, autonomy settings)
//           to the GET response so the mobile dashboard shows action status.

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

// Verify user has boardroom access
async function verifyBoardroomAccess(userId: string): Promise<{ hasAccess: boolean; accessLevel: string | null }> {
  const { data, error } = await supaAdmin
    .from('boardroom_access')
    .select('access_level, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { hasAccess: false, accessLevel: null };
  }

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { hasAccess: false, accessLevel: null };
  }

  return { hasAccess: true, accessLevel: data.access_level };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);
    
    // Verify boardroom access
    const { hasAccess, accessLevel } = await verifyBoardroomAccess(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // GET - Get board members, meetings, tasks, capabilities, and execution status
    if (req.method === 'GET') {
      // Get all board members with their capabilities
      const { data: members, error: membersError } = await supaAdmin
        .from('boardroom_members')
        .select(`
          id, slug, name, role, title, ai_provider, avatar_url, 
          personality, expertise, voice_style, display_order,
          boardroom_member_capabilities (
            capability, description, autonomous
          )
        `)
        .eq('is_active', true)
        .order('display_order');

      if (membersError) throw membersError;

      // Get user's recent meetings
      const { data: meetings, error: meetingsError } = await supaAdmin
        .from('boardroom_meetings')
        .select('id, title, meeting_type, status, participants, started_at, concluded_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (meetingsError) throw meetingsError;

      // Get pending action items (legacy)
      const { data: actionItems } = await supaAdmin
        .from('boardroom_action_items')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: false })
        .limit(10);

      // ============================================
      // Get task statistics
      // ============================================
      
      // Pending tasks
      const { count: pendingTasksCount } = await supaAdmin
        .from('boardroom_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress']);

      // Completed tasks (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentCompletedTasks } = await supaAdmin
        .from('boardroom_tasks')
        .select('id, title, assigned_to, task_type, completed_at, deliverable_type')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false })
        .limit(10);

      // Tasks by member (for workload visualization)
      const { data: tasksByMember } = await supaAdmin
        .from('boardroom_tasks')
        .select('assigned_to, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress', 'completed']);

      // Aggregate tasks by member
      const memberWorkload: Record<string, { pending: number; completed: number }> = {};
      (tasksByMember || []).forEach(task => {
        if (!memberWorkload[task.assigned_to]) {
          memberWorkload[task.assigned_to] = { pending: 0, completed: 0 };
        }
        if (task.status === 'completed') {
          memberWorkload[task.assigned_to].completed++;
        } else {
          memberWorkload[task.assigned_to].pending++;
        }
      });

      // ============================================
      // Get today's briefing if exists
      // ============================================
      const today = new Date().toISOString().split('T')[0];
      const { data: todaysBriefing } = await supaAdmin
        .from('boardroom_briefings')
        .select('id, briefing_type, summary, read_at, created_at')
        .eq('user_id', user.id)
        .eq('briefing_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // ============================================
      // Get scheduled actions
      // ============================================
      const { data: scheduledActions } = await supaAdmin
        .from('boardroom_scheduled_actions')
        .select('id, member_slug, action_type, schedule, last_run, next_run, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // ============================================
      // Sprint 6: Execution Gateway Status
      // ============================================

      // Pending actions awaiting CEO approval (mobile badge count)
      const { count: pendingActionsCount } = await supaAdmin
        .from('board_action_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');

      // Recent executed actions (last 7 days, for the dashboard feed)
      const { data: recentExecutions } = await supaAdmin
        .from('board_action_queue')
        .select('id, member_slug, action_type, title, status, impact_level, executed_at, created_at')
        .eq('user_id', user.id)
        .in('status', ['executed', 'auto_approved', 'failed'])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      // Autonomy settings (kill switch, sandbox mode, spend caps)
      const { data: autonomySettings } = await supaAdmin
        .from('user_autonomy_settings')
        .select('autonomy_enabled, sandbox_mode, kill_switch_activated, kill_switch_reason, spent_today, spent_this_month, max_spend_per_day, max_spend_per_month')
        .eq('user_id', user.id)
        .maybeSingle();

      // Pending autonomy confirmations (from guardrails)
      const { count: pendingConfirmationsCount } = await supaAdmin
        .from('autonomy_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'awaiting_confirmation');

      // ============================================
      // Format member capabilities for easier use
      // ============================================
      const formattedMembers = (members || []).map(member => ({
        ...member,
        capabilities: (member.boardroom_member_capabilities || []).map((cap: any) => ({
          name: cap.capability,
          description: cap.description,
          autonomous: cap.autonomous,
        })),
        workload: memberWorkload[member.slug] || { pending: 0, completed: 0 },
      }));

      // Remove the raw join data
      formattedMembers.forEach((m: any) => delete m.boardroom_member_capabilities);

      return res.status(200).json({
        // Core data
        members: formattedMembers,
        meetings: meetings || [],
        action_items: actionItems || [],
        access_level: accessLevel,
        
        // Task system
        tasks: {
          pending_count: pendingTasksCount || 0,
          recent_completed: recentCompletedTasks || [],
          by_member: memberWorkload,
        },
        
        // Briefings
        todays_briefing: todaysBriefing || null,
        
        // Automation
        scheduled_actions: scheduledActions || [],

        // Sprint 6: Execution gateway status
        execution: {
          pending_approvals: pendingActionsCount || 0,
          pending_confirmations: pendingConfirmationsCount || 0,
          recent_executions: recentExecutions || [],
          autonomy: autonomySettings
            ? {
                enabled: autonomySettings.autonomy_enabled,
                sandbox: autonomySettings.sandbox_mode,
                kill_switch: autonomySettings.kill_switch_activated,
                kill_reason: autonomySettings.kill_switch_reason,
                spent_today: autonomySettings.spent_today,
                spent_this_month: autonomySettings.spent_this_month,
                daily_limit: autonomySettings.max_spend_per_day,
                monthly_limit: autonomySettings.max_spend_per_month,
              }
            : null,
        },
        
        // Quick stats
        stats: {
          total_members: formattedMembers.length,
          active_meetings: (meetings || []).filter(m => m.status === 'active').length,
          pending_tasks: pendingTasksCount || 0,
          tasks_completed_this_week: (recentCompletedTasks || []).length,
          has_unread_briefing: todaysBriefing && !todaysBriefing.read_at,
          // Sprint 6 stats
          pending_approvals: pendingActionsCount || 0,
          kill_switch_active: autonomySettings?.kill_switch_activated || false,
        },
      });
    }

    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Boardroom error:', message);
    return res.status(500).json({ error: message });
  }
}