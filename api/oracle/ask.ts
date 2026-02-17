// FILE: api/oracle/ask.ts
// ═══════════════════════════════════════════════════════════════════════
// ██  DEPRECATED — KILL THE FOSSIL  ██████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════
//
// This endpoint is a COMPATIBILITY SHIM. All requests are forwarded to
// the real Oracle pipeline in chat.ts with lightweight: true.
//
// WHAT CHANGED:
//   BEFORE: Hardcoded gpt-4o-mini, 200 max_tokens, generic system prompt,
//           zero identity, zero memory, zero personality. A lobotomy.
//   AFTER:  Full Oracle pipeline — identity, memory, concierge, personality,
//           tier-routed models, safety scanning. The real Oracle, lightweight.
//
// The fossil is dead. Any surface still hitting /api/oracle/ask now gets
// the same soul as /api/oracle/chat — just with fewer heavy context fetches.
//
// TODO: Audit all callers and migrate to /api/oracle/chat directly.
//       Once migrated, delete this file. It's a tombstone, not a feature.
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import chatHandler from './chat.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Map old ask.ts shape → chat.ts shape ────────────────
  const { question, conversationHistory, analysisContext } = req.body || {};

  req.body = {
    message: question,
    conversationHistory: conversationHistory || [],
    lightweight: true,
    analysisContext: analysisContext || null,
  };

  console.log('[ask.ts] DEPRECATED: Forwarding to chat pipeline (lightweight)');

  // ── Forward to the real Oracle ──────────────────────────
  return chatHandler(req, res);
}