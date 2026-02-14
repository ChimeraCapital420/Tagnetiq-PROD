// FILE: api/oracle/see.ts
// Oracle Eyes — Give your Oracle the ability to SEE
//
// MODES:
//   'glance'   → Quick casual look, Oracle comments naturally
//   'identify' → "What is this?" — focused identification
//   'room_scan'→ Wide shot, extract multiple objects + positions
//   'hunt_scan'→ Store/estate sale, flag valuable items
//   'read'     → Article/document/label — extract and remember text
//   'remember' → "Remember where I put this" — spatial memory bookmark
//
// FLOW:
//   1. Image in (base64 from phone camera, glasses, or gallery)
//   2. Fast vision ID via Google Flash (2-3s, cheapest vision model)
//   3. Store visual memory in oracle_visual_memory table
//   4. Feed identification into Oracle chat for conversational response
//   5. Return response + memory_id (for follow-up questions)
//
// COST: ~$0.003 per look (1 vision call + 1 gpt-4o-mini chat)
// vs HYDRA full scan: ~$0.08 (8 providers)
//
// INTEGRATION:
//   - Phone camera: Direct capture
//   - Ray-Ban Meta: Share target → TagnetIQ → auto-route to see.ts
//   - Future HUD glasses: Direct camera API
//   - Gallery: User picks existing photo
//
// Sprint: Oracle Eyes (foundation for visual memory, room scan, auction copilot)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';
import { checkOracleAccess } from '../../src/lib/oracle/tier.js';
import {
  getOrCreateIdentity,
  buildSystemPrompt,
} from '../../src/lib/oracle/index.js';
import { routeMessage, callOracle } from '../../src/lib/oracle/providers/index.js';
import type { OracleMessage } from '../../src/lib/oracle/providers/index.js';

export const config = {
  maxDuration: 30,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// TYPES
// =============================================================================

type VisionMode = 'glance' | 'identify' | 'room_scan' | 'hunt_scan' | 'read' | 'remember';

interface SeeRequest {
  image: string;           // base64 image data
  mode?: VisionMode;       // defaults to 'glance'
  question?: string;       // optional user question about what they're seeing
  locationHint?: string;   // "kitchen", "ARC thrift store", "storage unit #4"
  conversationId?: string; // link to existing Oracle conversation
  source?: string;         // 'phone_camera' | 'glasses_meta' | 'gallery_import'
  // Auction copilot fields
  budgetLimit?: number;    // "stop me at $350"
  currentBid?: number;     // current auction bid amount
}

interface IdentifiedObject {
  name: string;
  category: string;
  estimated_value: number | null;
  confidence: number;
  position_hint: string;
}

// =============================================================================
// VISION PROMPTS — one per mode
// =============================================================================

const VISION_PROMPTS: Record<VisionMode, string> = {
  glance: `Describe what you see in this image in 1-2 natural sentences, as if you're casually noting something interesting. If you recognize specific items, name them. Be conversational, not clinical.

Respond with ONLY this JSON:
{
  "description": "<natural language description>",
  "objects": [{"name": "<item>", "category": "<type>", "estimated_value": null, "confidence": 0.8, "position_hint": "<where in frame>"}],
  "extracted_text": null
}`,

  identify: `Identify the primary item in this image as specifically as possible. Include brand, model, year, variant, condition — anything that helps narrow it down for resale value research.

Respond with ONLY this JSON:
{
  "description": "<detailed identification>",
  "objects": [{"name": "<specific item name>", "category": "<category>", "estimated_value": <rough estimate or null>, "confidence": 0.9, "position_hint": "center"}],
  "extracted_text": null
}`,

  room_scan: `Analyze this room/space image. Identify ALL notable objects you can see, their approximate positions, and any items that might have resale value. Be thorough — scan shelves, tables, walls, floors.

Respond with ONLY this JSON:
{
  "description": "<overview of the space and what's in it>",
  "objects": [
    {"name": "<item 1>", "category": "<type>", "estimated_value": <number or null>, "confidence": 0.7, "position_hint": "<left/right/center/shelf/wall/floor>"},
    {"name": "<item 2>", "category": "<type>", "estimated_value": <number or null>, "confidence": 0.7, "position_hint": "<position>"}
  ],
  "extracted_text": null
}`,

  hunt_scan: `You are helping a resale hunter scan a store, estate sale, or storage unit. Identify EVERY item you can see that might have resale value. Focus on:
- Brand names visible on items
- Vintage or collectible items
- Electronics, tools, appliances
- Designer clothing/accessories
- Anything that looks underpriced for what it is

Flag items worth investigating with higher confidence scores.

Respond with ONLY this JSON:
{
  "description": "<overview focusing on valuable finds>",
  "objects": [
    {"name": "<item>", "category": "<type>", "estimated_value": <rough resale estimate>, "confidence": 0.8, "position_hint": "<where to look>"}
  ],
  "extracted_text": null
}`,

  read: `Extract ALL text visible in this image. This could be an article, document, label, sign, book page, or screen. Preserve the text as accurately as possible, including formatting and structure.

Respond with ONLY this JSON:
{
  "description": "<what type of document/text this appears to be>",
  "objects": [],
  "extracted_text": "<full extracted text content>"
}`,

  remember: `The user wants to remember where they put something. Describe the location, surroundings, and the specific item placement so it can be recalled later. Be precise about spatial relationships — "on the second shelf, behind the blue book, next to the lamp."

Respond with ONLY this JSON:
{
  "description": "<precise description of item placement and surroundings>",
  "objects": [{"name": "<item being remembered>", "category": "personal", "estimated_value": null, "confidence": 0.9, "position_hint": "<very specific location description>"}],
  "extracted_text": null
}`,
};

// =============================================================================
// FAST VISION — Single provider, optimized for speed
// =============================================================================

async function runFastVision(
  imageBase64: string,
  mode: VisionMode,
  userQuestion?: string
): Promise<{ description: string; objects: IdentifiedObject[]; extractedText: string | null; raw: any }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('Vision provider not configured (GOOGLE_AI_API_KEY)');
  }

  // Build prompt — base mode prompt + optional user question
  let prompt = VISION_PROMPTS[mode];
  if (userQuestion) {
    prompt += `\n\nThe user is also asking: "${userQuestion}"\nIncorporate your answer into the description.`;
  }

  // Google Gemini Flash — fastest, cheapest vision model (~2s, ~$0.001)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('Vision API error:', response.status, errText);
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON response
  try {
    // Clean markdown fences if present
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON in response');

    const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));

    return {
      description: parsed.description || 'Image processed',
      objects: Array.isArray(parsed.objects) ? parsed.objects : [],
      extractedText: parsed.extracted_text || null,
      raw: parsed,
    };
  } catch (parseErr) {
    // Fallback — use raw text as description
    console.warn('Vision response not JSON, using raw text');
    return {
      description: text.substring(0, 500),
      objects: [],
      extractedText: mode === 'read' ? text : null,
      raw: { text },
    };
  }
}

// =============================================================================
// STORE VISUAL MEMORY
// =============================================================================

async function storeVisualMemory(
  userId: string,
  mode: VisionMode,
  vision: { description: string; objects: IdentifiedObject[]; extractedText: string | null },
  options: {
    locationHint?: string;
    source?: string;
    imageUrl?: string;
  }
): Promise<string | null> {
  try {
    // Calculate total estimated value for valuable items
    const totalValue = vision.objects.reduce((sum, obj) => sum + (obj.estimated_value || 0), 0);
    const hasValuable = vision.objects.some(obj => (obj.estimated_value || 0) > 5);

    const { data, error } = await supabaseAdmin
      .from('oracle_visual_memory')
      .insert({
        user_id: userId,
        mode,
        description: vision.description,
        objects: vision.objects,
        extracted_text: vision.extractedText,
        location_hint: options.locationHint || null,
        source: options.source || 'phone_camera',
        image_url: options.imageUrl || null,
        has_valuable_items: hasValuable,
        total_estimated_value: totalValue > 0 ? totalValue : null,
        observed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to store visual memory:', error.message);
      return null;
    }

    return data?.id || null;
  } catch (err: any) {
    console.error('Visual memory storage error:', err.message);
    return null;
  }
}

// =============================================================================
// BUILD ORACLE RESPONSE — conversational layer on top of vision
// =============================================================================

async function buildOracleResponse(
  userId: string,
  mode: VisionMode,
  vision: { description: string; objects: IdentifiedObject[]; extractedText: string | null },
  userQuestion?: string,
  budgetContext?: { budgetLimit?: number; currentBid?: number }
): Promise<string> {
  // Get Oracle identity for personality
  const identity = await getOrCreateIdentity(supabaseAdmin, userId);

  // Fetch minimal scan history for context (last 10 only — speed matters)
  const { data: recentScans } = await supabaseAdmin
    .from('analysis_history')
    .select('item_name, estimated_value, category, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Build a lightweight system prompt
  const oracleName = identity.oracle_name || 'Oracle';
  const personality = identity.personality_snapshot || '';

  let systemPrompt = `You are ${oracleName}, the user's AI assistant with the ability to SEE through their camera. You just looked at something for them. Be conversational, warm, and knowledgeable.${personality ? `\n\nYour personality: ${personality}` : ''}

WHAT YOU SAW:
${vision.description}

${vision.objects.length > 0 ? `OBJECTS IDENTIFIED:\n${vision.objects.map(o => `- ${o.name} (${o.category})${o.estimated_value ? ` ~$${o.estimated_value}` : ''}${o.position_hint ? ` [${o.position_hint}]` : ''}`).join('\n')}` : ''}

${vision.extractedText ? `TEXT CONTENT:\n${vision.extractedText.substring(0, 1000)}` : ''}

${recentScans && recentScans.length > 0 ? `\nUSER'S RECENT SCANS (for context):\n${recentScans.slice(0, 5).map(s => `- ${s.item_name}: $${s.estimated_value} (${s.category})`).join('\n')}` : ''}`;

  // Mode-specific instructions
  const modeInstructions: Record<VisionMode, string> = {
    glance: 'Comment naturally on what you see. Be brief and conversational — like a friend glancing at something. If you spot anything interesting or valuable, mention it casually.',
    identify: 'Give a detailed identification. If this item has resale value, mention it. If you need more info to be precise (like a closer photo of a label or serial number), ask.',
    room_scan: 'Describe the space and call out notable items. Organize by area/position. Highlight anything that catches your eye as potentially valuable or interesting.',
    hunt_scan: 'You are in HUNT MODE. Focus on items with resale value. For each valuable find, give a quick estimate and why it is worth investigating. Be direct — the user is moving fast through a store.',
    read: 'Summarize what the text says. The user might ask questions about it later, so capture the key points. If it is an article, give the main takeaway.',
    remember: 'Confirm you have noted where this item is. Be very specific about the location so you can help the user find it later. Repeat the placement details back to them.',
  };

  systemPrompt += `\n\nMODE: ${mode}\n${modeInstructions[mode]}`;

  // Auction copilot context
  if (budgetContext?.budgetLimit) {
    systemPrompt += `\n\nAUCTION MODE: User has a budget limit of $${budgetContext.budgetLimit}.`;
    if (budgetContext.currentBid) {
      const remaining = budgetContext.budgetLimit - budgetContext.currentBid;
      const pctUsed = (budgetContext.currentBid / budgetContext.budgetLimit * 100).toFixed(0);
      systemPrompt += ` Current bid is $${budgetContext.currentBid} (${pctUsed}% of budget, $${remaining} remaining).`;
      if (remaining <= 0) {
        systemPrompt += ' BUDGET EXCEEDED — strongly advise the user to stop bidding unless they explicitly want to go over.';
      } else if (remaining < budgetContext.budgetLimit * 0.1) {
        systemPrompt += ' WARNING: Very close to budget limit. Alert the user.';
      }
    }
    // If we have objects with values, compare to budget
    const totalItemValue = vision.objects.reduce((sum, o) => sum + (o.estimated_value || 0), 0);
    if (totalItemValue > 0) {
      systemPrompt += ` Estimated value of items visible: ~$${totalItemValue}. ${totalItemValue > budgetContext.budgetLimit ? 'Value exceeds budget — could still be a good deal but user should be cautious.' : 'Value appears to be within budget range.'}`;
    }
  }

  // Build messages
  const messages: OracleMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (userQuestion) {
    messages.push({ role: 'user', content: userQuestion });
  } else {
    // Default prompt based on mode
    const defaultQuestions: Record<VisionMode, string> = {
      glance: 'What do you see?',
      identify: 'What is this? Tell me everything you can.',
      room_scan: 'Scan this room. What do you see?',
      hunt_scan: 'Hunt mode — what should I grab?',
      read: 'What does this say? Give me the key points.',
      remember: 'Remember where I put this.',
    };
    messages.push({ role: 'user', content: defaultQuestions[mode] });
  }

  // Route and call — use the same provider infrastructure as chat.ts
  const routing = routeMessage(userQuestion || 'visual identification', identity, {
    conversationLength: 0,
  });

  const result = await callOracle(routing, messages);
  return result.text || 'I saw something but I am having trouble describing it. Can you show me again?';
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

    // ── Tier gate ─────────────────────────────────────────
    const access = await checkOracleAccess(supabaseAdmin, user.id);
    if (!access.allowed) {
      return res.status(429).json({
        error: 'message_limit_reached',
        message: access.blockedReason,
        tier: {
          current: access.tier.current,
          messagesUsed: access.usage.messagesUsed,
          messagesLimit: access.usage.messagesLimit,
          messagesRemaining: 0,
        },
      });
    }

    // ── Parse request ─────────────────────────────────────
    const {
      image,
      mode = 'glance',
      question,
      locationHint,
      conversationId,
      source = 'phone_camera',
      budgetLimit,
      currentBid,
    } = req.body as SeeRequest;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'A base64 "image" string is required.' });
    }

    const validModes: VisionMode[] = ['glance', 'identify', 'room_scan', 'hunt_scan', 'read', 'remember'];
    const visionMode: VisionMode = validModes.includes(mode as VisionMode) ? mode as VisionMode : 'glance';

    const startTime = Date.now();
    console.log(`👁️ Oracle Eyes: mode=${visionMode}, source=${source}, question="${question || 'none'}"`);

    // ── 1. Fast vision identification ─────────────────────
    const visionStart = Date.now();
    const vision = await runFastVision(image, visionMode, question);
    const visionTime = Date.now() - visionStart;

    console.log(`  🔍 Vision: ${vision.objects.length} objects, ${visionTime}ms`);
    if (vision.objects.length > 0) {
      console.log(`  📦 Objects: ${vision.objects.map(o => o.name).join(', ')}`);
    }

    // ── 2. Store visual memory (non-blocking but awaited with timeout) ──
    const memoryPromise = storeVisualMemory(user.id, visionMode, vision, {
      locationHint,
      source,
    });

    // ── 3. Build conversational Oracle response ───────────
    const oracleResponse = await buildOracleResponse(
      user.id,
      visionMode,
      vision,
      question,
      budgetLimit ? { budgetLimit, currentBid } : undefined
    );

    // Wait for memory storage (max 2s)
    const memoryId = await Promise.race([
      memoryPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);

    const totalTime = Date.now() - startTime;

    console.log(`  💬 Oracle response: ${oracleResponse.length} chars`);
    console.log(`  ⏱️ Total: ${totalTime}ms (vision: ${visionTime}ms)`);

    // ── 4. Response ───────────────────────────────────────
    return res.status(200).json({
      response: oracleResponse,
      memoryId,
      vision: {
        description: vision.description,
        objects: vision.objects,
        extractedText: vision.extractedText,
        objectCount: vision.objects.length,
        mode: visionMode,
      },
      // Hunt mode extras
      ...(visionMode === 'hunt_scan' && {
        huntFinds: vision.objects
          .filter(o => (o.estimated_value || 0) > 5)
          .sort((a, b) => (b.estimated_value || 0) - (a.estimated_value || 0)),
        totalEstimatedValue: vision.objects.reduce((sum, o) => sum + (o.estimated_value || 0), 0),
      }),
      // Auction copilot extras
      ...(budgetLimit && {
        auction: {
          budgetLimit,
          currentBid: currentBid || 0,
          remaining: budgetLimit - (currentBid || 0),
          atLimit: (currentBid || 0) >= budgetLimit,
        },
      }),
      conversationId,
      tier: {
        current: access.tier.current,
        messagesUsed: access.usage.messagesUsed,
        messagesLimit: access.usage.messagesLimit,
        messagesRemaining: access.usage.messagesRemaining,
      },
      _timing: {
        vision: visionTime,
        total: totalTime,
      },
    });

  } catch (error: any) {
    const errMsg = error.message || 'An unexpected error occurred.';
    if (errMsg.includes('Authentication')) {
      return res.status(401).json({ error: errMsg });
    }
    console.error('Oracle see error:', errMsg);
    return res.status(500).json({ error: 'Oracle blinked. Try showing me again.' });
  }
}