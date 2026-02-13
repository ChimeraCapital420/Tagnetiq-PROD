// FILE: api/oracle/chat.ts
// Oracle Chat Handler — ORCHESTRATION ONLY
//
// All business logic lives in src/lib/oracle/:
//   identity/   → Oracle CRUD, name ceremony, AI DNA
//   personality/ → Evolution via LLM, energy detection
//   prompt/      → System prompt builder + sections
//   chips/       → Dynamic quick chips
//   tier.ts      → Sprint D: Tier gating + message counting
//
// This file just wires them together and handles HTTP.
//
// Sprint C:   Identity, name ceremony, personality evolution
// Sprint C.1: AI DNA (provider affinity → personality)
// Sprint D:   Tier-gated Oracle (Free: 5/day, Pro: unlimited, Elite: full)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

// ── Oracle Modules ──────────────────────────────────────
import {
  getOrCreateIdentity,
  updateIdentityAfterChat,
  checkForNameCeremony,
  buildSystemPrompt,
  getQuickChips,
  evolvePersonality,
} from '../../src/lib/oracle/index.js';

import { checkOracleAccess } from '../../src/lib/oracle/tier.js';

export const config = {
  maxDuration: 30,
};

// ── Clients ─────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TITLE GENERATOR
// =============================================================================

function generateTitle(firstMessage: string): string {
  const clean = firstMessage.trim().replace(/\n/g, ' ');
  if (clean.length <= 50) return clean;
  return clean.substring(0, 47) + '...';
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);
    const { message, conversationHistory, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'A valid "message" string is required.' });
    }

    // ── 0. TIER GATE — check access before anything expensive ──
    const access = await checkOracleAccess(supabaseAdmin, user.id);

    if (!access.allowed) {
      return res.status(429).json({
        error: 'message_limit_reached',
        message: access.blockedReason,
        upgradeCta: access.upgradeCta,
        tier: {
          current: access.tier.current,
          messagesUsed: access.usage.messagesUsed,
          messagesLimit: access.usage.messagesLimit,
          messagesRemaining: 0,
        },
      });
    }

    // ── 1. Fetch all data in parallel ─────────────────────
    const [identity, scanResult, vaultResult, profileResult] = await Promise.all([
      getOrCreateIdentity(supabaseAdmin, user.id),
      supabaseAdmin
        .from('analysis_history')
        .select('id, item_name, estimated_value, category, confidence, decision, created_at, analysis_result, consensus_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('vault_items')
        .select('id, item_name, estimated_value, category, condition, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabaseAdmin
        .from('profiles')
        .select('display_name, settings')
        .eq('id', user.id)
        .single(),
    ]);

    const scanHistory = scanResult.data || [];
    const vaultItems = vaultResult.data || [];
    const profile = profileResult.data;

    // ── 2. Build system prompt ────────────────────────────
    const systemPrompt = buildSystemPrompt(identity, scanHistory, vaultItems, profile);

    // ── 3. Assemble conversation messages ─────────────────
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-20);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // ── 4. Call LLM ───────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0].message.content;
    if (!responseText) throw new Error('Oracle returned empty response');

    // ── 5. Non-blocking background tasks ──────────────────
    // Name ceremony: check if Oracle named itself in this response
    checkForNameCeremony(supabaseAdmin, identity, responseText).catch(() => {});

    // Identity update: increment counts, detect energy, update categories, AI DNA
    updateIdentityAfterChat(supabaseAdmin, identity, message, scanHistory).catch(() => {});

    // Personality evolution: runs every ~10 conversations
    evolvePersonality(openai, supabaseAdmin, identity, conversationHistory || []).catch(() => {});

    // ── 6. Persist conversation ───────────────────────────
    const userMsg = { role: 'user', content: message, timestamp: Date.now() };
    const assistantMsg = { role: 'assistant', content: responseText, timestamp: Date.now() };

    let activeConversationId = conversationId || null;

    try {
      if (activeConversationId) {
        // Append to existing conversation
        const { data: existing } = await supabaseAdmin
          .from('oracle_conversations')
          .select('messages')
          .eq('id', activeConversationId)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          const updatedMessages = [...(existing.messages as any[]), userMsg, assistantMsg];
          await supabaseAdmin
            .from('oracle_conversations')
            .update({ messages: updatedMessages })
            .eq('id', activeConversationId);
        }
      } else {
        // Start new conversation
        const { data: newConvo } = await supabaseAdmin
          .from('oracle_conversations')
          .insert({
            user_id: user.id,
            title: generateTitle(message),
            messages: [userMsg, assistantMsg],
            scan_count_at_creation: scanHistory.length,
            is_active: true,
          })
          .select('id')
          .single();

        activeConversationId = newConvo?.id || null;
      }
    } catch (convError: any) {
      console.warn('Conversation persistence failed (non-fatal):', convError.message);
    }

    // ── 7. Response (includes tier info for client UI) ────
    const quickChips = getQuickChips(scanHistory, vaultItems, identity);

    return res.status(200).json({
      response: responseText,
      conversationId: activeConversationId,
      quickChips,
      scanCount: scanHistory.length,
      vaultCount: vaultItems.length,
      oracleName: identity.oracle_name,
      tier: {
        current: access.tier.current,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Oracle chat error:', errMsg);
    return res.status(500).json({ error: 'Oracle is thinking too hard. Try again.' });
  }
}