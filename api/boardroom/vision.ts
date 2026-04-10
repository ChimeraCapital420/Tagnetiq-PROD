// FILE: api/boardroom/vision.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARD VISION — Lightweight Image Intelligence Endpoint
// ═══════════════════════════════════════════════════════════════════════
//
// Option B Vision Pipeline for the Midas Hand Board:
//   1. Receive image from admin user (William or Keith)
//   2. Run GPT-4o vision with board-context prompt
//   3. Return structured analysis BEFORE it reaches board members
//   4. Each member then applies their domain lens to the analysis
//      via Layer 10 in the prompt builder (media-context.ts)
//
// This is NOT a HYDRA scan. No consensus. No market data.
// It's pure vision intelligence — "what are we looking at?"
// optimized for board-level strategic analysis.
//
// Output structure is richer than a simple description:
//   - What it is (identification)
//   - Key observable details (condition, markings, text, numbers)
//   - Strategic context (why this might matter to a board)
//   - Domain signals (financial figures, legal text, tech indicators)
//   - Questions this raises (for the board to address)
//
// Admin-only: boardroom_access check enforced.
// Cost: ~$0.01 per image (GPT-4o vision, ~500 token output)
// Mobile-first: image compressed client-side before upload.
//
// ═══════════════════════════════════════════════════════════════════════

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 30 };

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// =============================================================================
// OPENAI KEY
// =============================================================================

function getOpenAIKey(): string | null {
  const candidates = ['OPENAI_API_KEY', 'OPEN_AI_API_KEY'];
  for (const key of candidates) {
    const val = process.env[key];
    if (val && val.trim().length > 0) return val.trim();
  }
  return null;
}

// =============================================================================
// VISION PROMPT
// =============================================================================
// Board-context prompt — extracts everything a C-suite needs to know
// before 15 AI board members apply their individual domain lenses.

const BOARD_VISION_SYSTEM = `You are a senior intelligence analyst preparing a visual briefing for an executive board of directors. 

Analyze the image with the precision and depth a C-suite requires. Extract everything that could be strategically relevant — financial figures, legal text, technical systems, people, properties, products, documents, market indicators.

Return a structured JSON object with these exact fields:

{
  "identification": "What this is — be specific. Product, document, property, person, situation.",
  "keyDetails": [
    "Specific observable detail 1 — numbers, text, conditions, brands, models",
    "Specific observable detail 2",
    "..."
  ],
  "financialSignals": "Any visible financial data — prices, revenue figures, valuations, costs, margins. 'None visible' if absent.",
  "legalSignals": "Any visible legal text, contracts, agreements, regulatory markings, compliance indicators. 'None visible' if absent.",
  "technicalSignals": "Any visible technology, systems, infrastructure, code, equipment. 'None visible' if absent.",
  "strategicContext": "Why a business executive should care about this. What decision does this inform?",
  "riskFlags": "Anything that looks like a red flag — damage, disputes, hidden clauses, missing information, deception indicators. 'None identified' if clean.",
  "questionsForBoard": [
    "Question 1 the board should address about this",
    "Question 2",
    "Question 3"
  ],
  "confidence": "high | medium | low — how clearly visible and interpretable is the image",
  "summary": "2-3 sentence executive summary. Lead with the most important finding."
}

Be precise. Use specific numbers and text when visible. Do not guess what isn't visible.
Return ONLY valid JSON — no markdown, no preamble.`;

// =============================================================================
// IMAGE VALIDATION
// =============================================================================

function validateBase64Image(raw: string): {
  valid: boolean;
  clean: string;
  sizeKB: number;
  error?: string;
} {
  const clean = raw.includes(',') ? raw.split(',')[1] : raw;

  if (!clean || clean.length < 1000) {
    return { valid: false, clean: '', sizeKB: 0, error: 'Image too small or empty.' };
  }

  const sizeKB = Math.round(clean.length * 0.75 / 1024);

  // Cap at 4MB — GPT-4o vision limit
  if (sizeKB > 4096) {
    return { valid: false, clean: '', sizeKB, error: 'Image too large. Please use a compressed image under 4MB.' };
  }

  return { valid: true, clean, sizeKB };
}

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const user = await verifyUser(req);

    // ── Boardroom access check ────────────────────────────────────────
    const { data: accessRow } = await supabaseAdmin
      .from('boardroom_access')
      .select('access_level')
      .eq('user_id', user.id)
      .single();

    if (!accessRow) {
      return res.status(403).json({ error: 'Boardroom access required.' });
    }

    // ── Input ─────────────────────────────────────────────────────────
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      context,          // Optional: "this is a business listing I photographed"
      memberSlug,       // Optional: hint for which member will receive this
    } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const validation = validateBase64Image(imageBase64);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const openaiKey = getOpenAIKey();
    if (!openaiKey) {
      return res.status(503).json({ error: 'Vision engine not configured.' });
    }

    // Determine image media type
    const imageMediaType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    // Build user prompt — add context if provided
    const userPrompt = context
      ? `Analyze this image. Context from the user: "${context}"`
      : 'Analyze this image for the board.';

    console.log(`[BoardVision] ${user.id.substring(0, 8)} | ${validation.sizeKB}KB | member: ${memberSlug || 'all'}`);

    // ── GPT-4o Vision Call ─────────────────────────────────────────────
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: BOARD_VISION_SYSTEM,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageMediaType};base64,${validation.clean}`,
                  detail: 'high',  // High detail for document/financial image reading
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,  // Low temp — we want factual extraction, not creativity
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[BoardVision] OpenAI error: ${response.status}`, errText.substring(0, 200));
      if (response.status === 401) return res.status(503).json({ error: 'Vision API key invalid.' });
      if (response.status === 429) return res.status(503).json({ error: 'Vision rate limit — try again.' });
      return res.status(503).json({ error: 'Vision analysis failed.' });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';

    if (!raw || raw.length < 50) {
      return res.status(503).json({ error: 'Vision returned empty analysis.' });
    }

    // ── Parse structured analysis ──────────────────────────────────────
    let analysis: Record<string, any>;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      // If JSON parse fails, wrap the raw text as a summary
      console.warn('[BoardVision] JSON parse failed — using raw text');
      analysis = {
        identification: 'Visual analysis',
        summary: raw.substring(0, 500),
        keyDetails: [],
        financialSignals: 'See summary',
        legalSignals: 'None identified',
        technicalSignals: 'None identified',
        strategicContext: 'See summary',
        riskFlags: 'None identified',
        questionsForBoard: [],
        confidence: 'medium',
      };
    }

    // ── Build content string for MediaAttachment ───────────────────────
    // This is what gets injected into each board member's prompt via Layer 10.
    // Structured so domain extraction hints in media-context.ts work correctly.
    const contentLines: string[] = [];

    contentLines.push(`## BOARD VISION ANALYSIS`);
    contentLines.push(`**What this is:** ${analysis.identification || 'Unknown'}`);
    contentLines.push(`**Confidence:** ${analysis.confidence || 'medium'}`);
    contentLines.push('');

    if (analysis.keyDetails && analysis.keyDetails.length > 0) {
      contentLines.push('**Key Observable Details:**');
      analysis.keyDetails.forEach((d: string) => contentLines.push(`- ${d}`));
      contentLines.push('');
    }

    if (analysis.financialSignals && analysis.financialSignals !== 'None visible') {
      contentLines.push(`**Financial Signals:** ${analysis.financialSignals}`);
    }

    if (analysis.legalSignals && analysis.legalSignals !== 'None visible') {
      contentLines.push(`**Legal Signals:** ${analysis.legalSignals}`);
    }

    if (analysis.technicalSignals && analysis.technicalSignals !== 'None visible') {
      contentLines.push(`**Technical Signals:** ${analysis.technicalSignals}`);
    }

    if (analysis.strategicContext) {
      contentLines.push(`\n**Strategic Context:** ${analysis.strategicContext}`);
    }

    if (analysis.riskFlags && analysis.riskFlags !== 'None identified') {
      contentLines.push(`\n**⚠️ Risk Flags:** ${analysis.riskFlags}`);
    }

    if (analysis.questionsForBoard && analysis.questionsForBoard.length > 0) {
      contentLines.push('\n**Questions for the Board:**');
      analysis.questionsForBoard.forEach((q: string) => contentLines.push(`- ${q}`));
    }

    const content = contentLines.join('\n');

    console.log(`[BoardVision] Complete: ${analysis.identification?.substring(0, 50)} | ${content.length} chars`);

    return res.status(200).json({
      type: 'image',
      identification: analysis.identification,
      summary: analysis.summary,
      content,
      analysis,             // Full structured analysis for any UI that wants it
      confidence: analysis.confidence,
      sizeKB: validation.sizeKB,
      memberSlug: memberSlug || null,
      model: 'gpt-4o',
    });

  } catch (error: any) {
    const msg = error.message || 'Vision failed';
    if (msg.includes('Authentication')) return res.status(401).json({ error: msg });
    if (error.name === 'TimeoutError') return res.status(408).json({ error: 'Vision timed out. Try a clearer photo.' });
    console.error('[BoardVision] Error:', msg);
    return res.status(500).json({ error: 'Vision analysis failed.' });
  }
}