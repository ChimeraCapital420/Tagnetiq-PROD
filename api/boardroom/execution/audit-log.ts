// FILE: api/boardroom/execution/audit-log.ts
// Execution Audit Log — Immutable trail of every action ever taken
//
// Sprint 6: Who, what, when, why, result, cost.
//
// Queries BOTH:
//   - board_action_queue (trust-gated board actions)
//   - autonomy_ledger (guardrail-checked autonomous actions)
//
// Endpoints:
//   GET /api/boardroom/execution/audit-log
//     ?type=board|autonomy|all (default: all)
//     ?member=slug             (filter by member)
//     ?status=pending|executed|failed|blocked_by_guardrail
//     ?limit=50                (default: 50, max: 200)
//     ?offset=0                (pagination)
//     ?from=ISO_DATE           (filter by date range start)
//     ?to=ISO_DATE             (filter by date range end)
//
// Mobile-first: compact entries, newest first, designed for scrolling.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../../_lib/security.js';
import { getSupaAdmin } from '../lib/provider-caller.js';

export const config = {
  maxDuration: 10,
};

interface AuditEntry {
  id: string;
  source: 'board_action' | 'autonomy_ledger';
  type: string;
  title: string;
  description: string;
  member: string | null;
  initiatedBy: string;
  status: string;
  cost: number | null;
  isSandbox: boolean;
  blockedBy: string | null;
  blockReason: string | null;
  createdAt: string;
  executedAt: string | null;
  result: any | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const supabase = getSupaAdmin();

  try {
    const user = await verifyUser(req);

    // Verify boardroom access
    const { data: access } = await supabase
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!access) {
      return res.status(403).json({ error: 'Boardroom access required.' });
    }

    // Parse query params
    const type = (req.query.type as string) || 'all';
    const member = req.query.member as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const entries: AuditEntry[] = [];

    // ── Board Action Queue ────────────────────────────
    if (type === 'all' || type === 'board') {
      let boardQuery = supabase
        .from('board_action_queue')
        .select('*, boardroom_members(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (member) boardQuery = boardQuery.eq('member_slug', member);
      if (status) boardQuery = boardQuery.eq('status', status);
      if (from) boardQuery = boardQuery.gte('created_at', from);
      if (to) boardQuery = boardQuery.lte('created_at', to);

      boardQuery = boardQuery.range(offset, offset + limit - 1);

      const { data: boardActions } = await boardQuery;

      for (const a of boardActions || []) {
        entries.push({
          id: a.id,
          source: 'board_action',
          type: a.action_type,
          title: a.title,
          description: a.description,
          member: a.member_slug,
          initiatedBy: a.boardroom_members?.name || a.member_slug,
          status: a.status,
          cost: a.estimated_cost,
          isSandbox: false,
          blockedBy: null,
          blockReason: a.rejection_reason,
          createdAt: a.created_at,
          executedAt: a.executed_at,
          result: a.execution_result,
        });
      }
    }

    // ── Autonomy Ledger ───────────────────────────────
    if (type === 'all' || type === 'autonomy') {
      let ledgerQuery = supabase
        .from('autonomy_ledger')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (status) ledgerQuery = ledgerQuery.eq('status', status);
      if (from) ledgerQuery = ledgerQuery.gte('created_at', from);
      if (to) ledgerQuery = ledgerQuery.lte('created_at', to);

      // Filter by member via initiator_detail (autonomy ledger stores member slug there)
      if (member) ledgerQuery = ledgerQuery.eq('initiator_detail', member);

      ledgerQuery = ledgerQuery.range(offset, offset + limit - 1);

      const { data: ledgerEntries } = await ledgerQuery;

      for (const l of ledgerEntries || []) {
        entries.push({
          id: l.id,
          source: 'autonomy_ledger',
          type: l.action_type,
          title: l.action_description.split(':')[0] || l.action_type,
          description: l.action_description,
          member: l.initiator_detail || null,
          initiatedBy: l.initiated_by,
          status: l.status,
          cost: l.financial_amount,
          isSandbox: l.is_sandbox,
          blockedBy: l.blocked_by,
          blockReason: l.block_reason,
          createdAt: l.created_at,
          executedAt: l.confirmed_at,
          result: l.sandbox_result,
        });
      }
    }

    // Sort merged entries by date (newest first)
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Trim to limit after merge
    const trimmed = entries.slice(0, limit);

    // Summary stats for the header on mobile
    const summary = {
      total: trimmed.length,
      executed: trimmed.filter(e => e.status === 'executed' || e.status === 'confirmed').length,
      pending: trimmed.filter(e => e.status === 'pending' || e.status === 'awaiting_confirmation').length,
      blocked: trimmed.filter(e => e.status === 'blocked_by_guardrail' || e.status === 'rejected').length,
      failed: trimmed.filter(e => e.status === 'failed').length,
      sandboxed: trimmed.filter(e => e.isSandbox).length,
    };

    return res.status(200).json({
      entries: trimmed,
      summary,
      pagination: { limit, offset, hasMore: entries.length > limit },
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Audit log error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
}