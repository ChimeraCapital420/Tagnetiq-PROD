// FILE: api/boardroom/lib/provider-caller/supabase.ts
// ═══════════════════════════════════════════════════════════════════════
// SHARED SUPABASE ADMIN CLIENT & COMPANY CONTEXT
// ═══════════════════════════════════════════════════════════════════════
//
// One connection, all routes. No duplicate clients.
// Service role key — full access for server-side operations.
//
// Company context = shared business knowledge loaded from DB.
// Cached 5 minutes. Used by chat, tasks, briefings.
//
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// SHARED SUPABASE ADMIN CLIENT
// =============================================================================
// Singleton — created once, reused across all API routes in the same
// serverless function instance.

let _supaAdmin: ReturnType<typeof createClient> | null = null;

/**
 * Get the shared Supabase admin client.
 * Singleton — created once, reused across all API routes in the same
 * serverless function instance.
 */
export function getSupaAdmin() {
  if (!_supaAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
    _supaAdmin = createClient(url, key);
  }
  return _supaAdmin;
}

// =============================================================================
// COMPANY CONTEXT
// =============================================================================
// Shared business knowledge loaded from boardroom_company_context table.
// Used by chat, tasks, and briefings to ground responses in real company info.

/** Cache company context for 5 minutes to avoid repeated DB calls */
let _companyContextCache: { text: string; timestamp: number } | null = null;
const COMPANY_CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch company context from boardroom_company_context table.
 * Cached for 5 minutes. Shared by all API routes.
 */
export async function getCompanyContext(): Promise<string> {
  const now = Date.now();
  if (_companyContextCache && (now - _companyContextCache.timestamp) < COMPANY_CONTEXT_TTL) {
    return _companyContextCache.text;
  }

  try {
    const { data } = await getSupaAdmin()
      .from('boardroom_company_context')
      .select('title, content, category')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (!data || data.length === 0) {
      _companyContextCache = { text: '', timestamp: now };
      return '';
    }

    let context = '\n\n# === TAGNETIQ COMPANY KNOWLEDGE ===\n';
    let currentCategory = '';

    for (const item of data) {
      if (item.category && item.category !== currentCategory) {
        currentCategory = item.category;
        context += `\n## ${currentCategory}\n`;
      }
      context += `${item.content}\n\n`;
    }

    _companyContextCache = { text: context, timestamp: now };
    return context;
  } catch (err: any) {
    console.warn('[Gateway] Failed to load company context:', err.message);
    return _companyContextCache?.text || '';
  }
}