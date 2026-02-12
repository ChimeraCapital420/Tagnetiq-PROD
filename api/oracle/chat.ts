// FILE: api/oracle/chat.ts
// Oracle Phase 2 Sprint B — Conversational AI with persistence + vault awareness
// Now saves conversations to Supabase so Oracle remembers across sessions
// Now queries vault items for portfolio questions
//
// Cost: ~$0.001 per message (gpt-4o-mini)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 30,
};

const openai = new OpenAI({ apiKey: process.env.TIER2_OPENAI_TOKEN });

const supabaseAdmin = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

function buildSystemPrompt(
  scanHistory: any[],
  vaultItems: any[],
  userProfile: any
): string {
  const userName = userProfile?.display_name || null;

  const basePrompt = `You are the Oracle — the AI brain of TagnetIQ, a multi-AI asset identification and resale intelligence platform. You operate across the entire $400B annual resale market.

YOU ARE NOT LIMITED TO COLLECTIBLES. TagnetIQ covers:
- VEHICLES: Cars, trucks, motorcycles, boats, RVs, parts (VIN decoding, auction values, Kelley Blue Book comps)
- REAL ESTATE: Properties, rental comps, flip analysis, neighborhood data
- LUXURY GOODS: Watches (Rolex, Omega, Patek), handbags (Hermès, Chanel, LV), jewelry, fine art
- COLLECTIBLES: Coins, stamps, trading cards (Pokémon, sports, MTG), comics, toys, action figures
- LEGO: Sets, minifigs, loose parts, retired sets
- STAR WARS: Vintage figures, vehicles, props, memorabilia
- SPORTS MEMORABILIA: Cards, jerseys, autographs, game-used equipment
- BOOKS & MEDIA: First editions, vinyl records, video games, rare media
- SNEAKERS: Jordans, Yeezys, Dunks, limited releases
- ELECTRONICS: Phones, laptops, cameras, audio equipment
- GROCERY & HOUSEHOLD: Barcode scanning, Amazon arbitrage, retail arbitrage, clearance flips
- AMAZON FBA: Product sourcing, price comparison, ROI calculation
- ANTIQUES & VINTAGE: Furniture, pottery, glassware, textiles, ephemera
- TOOLS & EQUIPMENT: Power tools, industrial equipment, musical instruments

THE HYDRA ENGINE:
TagnetIQ runs 8+ AI models simultaneously (OpenAI, Anthropic, Google, and specialized models) through the HYDRA consensus engine. When a user scans an item, multiple AIs analyze it independently and their results are blended into a consensus valuation. This is not a single-model guess — it's multi-AI verification.

AUTHORITY DATA SOURCES:
The platform cross-references AI analysis against real market data: eBay sold listings, Numista (coins), Brickset (LEGO), Discogs (vinyl), PSA (graded cards), NHTSA (vehicles), Google Books, Pokémon TCG API, UPCitemdb (barcodes), and more. New sources are added constantly.

PERSONALITY:
- You are warm, kind, and genuinely invested in this person's success — like a trusted friend who happens to be brilliant at finding value in everything
- You celebrate their wins ("That scan was a great find!"), encourage them through misses ("Not every item is a winner — that's how you build the eye"), and make them feel like they have an unfair advantage with you in their corner
- Keep responses SHORT for mobile: 2-3 sentences for simple questions, up to a paragraph for complex ones
- Use specific numbers, dates, and facts when you have them from scan history or vault
- Never say "I don't have access to" — if you have scan or vault data, USE it
- Be honest about buy/pass decisions but always frame passes constructively — "This one's not the move, but here's what to look for instead"
- Think in terms of ROI, flip potential, hold value, and market timing — but explain WHY, not just what
${userName ? `- The user's name is ${userName}. Use it naturally once per conversation — not every message, not robotically. Like a friend would.` : '- You don\'t know their name yet. That\'s fine — don\'t ask for it, just be warm.'}
- Remember: many users are new to resale. Never make them feel stupid for not knowing something. The whole point of Oracle is that they DON'T have to know everything — you do
- Match the user's energy — if they're excited, be excited with them. If they're frustrated, be calm and helpful. If they're just browsing, be casual
- You are NOT a corporate chatbot. No "How can I assist you today?" energy. You're the friend they text when they find something interesting at a garage sale
- Show genuine curiosity about what they're into. If someone scans a lot of one category, that's a passion — acknowledge it
- Light humor is welcome when natural. Never forced, never corny
- This conversation persists between sessions. If the user comes back later, you have context from before. Reference it naturally — "Last time we talked about that Rolex" — but don't be creepy about it

CAPABILITIES:
- Full knowledge of the user's scan history AND vault contents (provided below)
- Expert across ALL resale categories — not just collectibles
- Can discuss values, authentication, market trends, sourcing strategies, selling platforms
- Can answer "What's my collection worth?" using real vault data
- Can compare items, spot patterns in their behavior, suggest next moves
- Can advise on where to sell (eBay, Mercari, Facebook Marketplace, Poshmark, StockX, GOAT, Amazon FBA, local consignment)
- Can coach on negotiation, pricing strategy, listing optimization
- Can have casual conversation too — not every message needs to be about buying and selling

RULES:
- Reference scans and vault items by name with specific details
- For items NOT in history, answer from general resale knowledge
- If asked to scan/analyze something new, tell them to use the scanner
- Always be actionable — don't just inform, advise on what to DO. But read the room — sometimes the user just wants to chat
- If someone shares a personal win or milestone, celebrate it genuinely before jumping to analysis
- Respond in the same language the user writes in
- If a user seems focused on one category, proactively suggest adjacent categories — but gently
- NEVER start with "Great question!" or "That's a great question!" — just answer naturally
- NEVER use "Happy to help" — you're not a customer service bot, you're a friend`;

  // ── Scan History Context ──────────────────────────────────
  let scanContext = '\n\n## USER SCAN HISTORY\n';

  if (scanHistory.length === 0) {
    scanContext += 'No scans yet. The user is new — give them a warm welcome. Let them know TagnetIQ covers the entire resale market (not just collectibles). Be encouraging, not overwhelming. Suggest they scan their first item to see the HYDRA engine in action.';
  } else {
    scanContext += `${scanHistory.length} total scans. Most recent first:\n\n`;

    for (const scan of scanHistory.slice(0, 25)) {
      const result = scan.analysis_result || {};
      scanContext += `---\n`;
      scanContext += `ITEM: ${scan.item_name || result.itemName || 'Unknown'}\n`;
      scanContext += `SCANNED: ${new Date(scan.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n`;
      scanContext += `VALUE: ${result.estimatedValue || scan.estimated_value || 'Unknown'}\n`;
      scanContext += `DECISION: ${result.decision || scan.decision || 'N/A'}\n`;
      scanContext += `CONFIDENCE: ${result.confidence || scan.confidence || 'N/A'}\n`;
      scanContext += `CATEGORY: ${result.category || scan.category || 'general'}\n`;

      if (result.summary_reasoning) {
        scanContext += `SUMMARY: ${result.summary_reasoning.substring(0, 250)}\n`;
      }

      if (result.valuation_factors && result.valuation_factors.length > 0) {
        scanContext += `FACTORS: ${result.valuation_factors.slice(0, 4).join('; ')}\n`;
      }

      if (result.consensusRatio) {
        scanContext += `AI CONSENSUS: ${result.consensusRatio}\n`;
      }

      scanContext += '\n';
    }

    if (scanHistory.length > 25) {
      scanContext += `... and ${scanHistory.length - 25} older scans not shown.\n`;
    }

    // Summary stats
    const categories = [...new Set(scanHistory.map((s: any) => s.category || s.analysis_result?.category || 'general'))];
    const buyCount = scanHistory.filter((s: any) => (s.decision || s.analysis_result?.decision) === 'BUY').length;
    const passCount = scanHistory.filter((s: any) => (s.decision || s.analysis_result?.decision) === 'PASS').length;

    let totalValue = 0;
    for (const scan of scanHistory) {
      const val = scan.estimated_value || parseFloat(String(scan.analysis_result?.estimatedValue || '0').replace(/[^0-9.]/g, ''));
      if (!isNaN(val)) totalValue += val;
    }

    scanContext += `\n## SCAN STATS\n`;
    scanContext += `Total scans: ${scanHistory.length}\n`;
    scanContext += `BUY recommendations: ${buyCount}\n`;
    scanContext += `PASS recommendations: ${passCount}\n`;
    scanContext += `Categories explored: ${categories.join(', ')}\n`;
    scanContext += `Total estimated value scanned: $${totalValue.toLocaleString()}\n`;

    // Pattern notes
    if (scanHistory.length >= 5) {
      scanContext += '\n## PATTERNS (reference naturally, don\'t list robotically)\n';

      if (categories.length === 1) {
        scanContext += `User is focused on ${categories[0]} — they clearly have a passion here. Acknowledge it.\n`;
      } else if (categories.length >= 4) {
        scanContext += `User explores many categories — they're curious and versatile.\n`;
      }

      if (buyCount > passCount * 2) {
        scanContext += `User scans a lot of winners — they have a good eye. Let them know.\n`;
      } else if (passCount > buyCount * 2) {
        scanContext += `User gets a lot of PASS results — they might be learning. Be encouraging.\n`;
      }

      const lastScanDate = new Date(scanHistory[0].created_at);
      const daysSinceLastScan = Math.floor((Date.now() - lastScanDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastScan === 0) {
        scanContext += `User scanned today — they're active right now.\n`;
      } else if (daysSinceLastScan >= 7) {
        scanContext += `It's been ${daysSinceLastScan} days since their last scan. Warm "good to see you" vibe if natural.\n`;
      }
    }
  }

  // ── Vault Context ─────────────────────────────────────────
  let vaultContext = '\n\n## USER VAULT (their saved collection)\n';

  if (vaultItems.length === 0) {
    vaultContext += 'Vault is empty. If they ask about their collection, let them know they can save scanned items to their vault to track value over time.\n';
  } else {
    let vaultTotal = 0;
    vaultContext += `${vaultItems.length} items in vault:\n\n`;

    for (const item of vaultItems.slice(0, 20)) {
      const value = parseFloat(String(item.estimated_value || '0').replace(/[^0-9.]/g, ''));
      if (!isNaN(value)) vaultTotal += value;

      vaultContext += `- ${item.item_name || 'Unnamed item'}`;
      if (item.estimated_value) vaultContext += ` | Value: $${item.estimated_value}`;
      if (item.category) vaultContext += ` | Category: ${item.category}`;
      if (item.condition) vaultContext += ` | Condition: ${item.condition}`;
      vaultContext += '\n';
    }

    if (vaultItems.length > 20) {
      vaultContext += `... and ${vaultItems.length - 20} more items.\n`;
    }

    vaultContext += `\nTotal vault value: ~$${vaultTotal.toLocaleString()}\n`;
    vaultContext += `When asked "what's my collection worth?" — use this number and break it down by category if possible.\n`;
  }

  // ── User Profile ──────────────────────────────────────────
  let profileContext = '';
  if (userProfile) {
    profileContext = '\n\n## USER PROFILE\n';
    if (userProfile.display_name) profileContext += `Name: ${userProfile.display_name}\n`;
    if (userProfile.settings?.interests) profileContext += `Interests: ${JSON.stringify(userProfile.settings.interests)}\n`;
    if (userProfile.settings?.language) profileContext += `Preferred language: ${userProfile.settings.language}\n`;
  }

  return basePrompt + scanContext + vaultContext + profileContext;
}

// =============================================================================
// QUICK CHIPS
// =============================================================================

function getQuickChips(scanHistory: any[], vaultItems: any[]): Array<{ label: string; message: string }> {
  const chips: Array<{ label: string; message: string }> = [];

  if (scanHistory.length === 0) {
    chips.push(
      { label: '👋 What can you do?', message: 'What can you help me with?' },
      { label: '🎯 How to start', message: 'How do I get started with TagnetIQ?' },
      { label: '💰 Best items to flip', message: 'What are the best items to flip for profit right now?' },
      { label: '🏪 Sourcing tips', message: 'Where should I source items to resell?' },
    );
  } else {
    const lastScan = scanHistory[0];
    const lastItemName = lastScan?.item_name || lastScan?.analysis_result?.itemName;

    if (lastItemName) {
      chips.push({
        label: `📊 ${lastItemName.substring(0, 18)}...`,
        message: `Tell me more about the ${lastItemName} I scanned — where should I sell it and for how much?`
      });
    }

    // Vault chip if they have items
    if (vaultItems.length > 0) {
      chips.push({ label: '💎 Vault value', message: 'What\'s my collection worth right now?' });
    } else {
      chips.push({ label: '📈 My best finds', message: 'What are my most valuable scans so far?' });
    }

    // Category-aware chips
    const categories = [...new Set(scanHistory.slice(0, 20).map((s: any) => s.category || s.analysis_result?.category || 'general'))];

    if (categories.includes('vehicles') || categories.includes('vehicles-value')) {
      chips.push({ label: '🚗 Vehicle market', message: 'What\'s happening in the used vehicle market right now?' });
    } else if (categories.includes('luxury-goods') || categories.includes('luxury-watches')) {
      chips.push({ label: '⌚ Luxury trends', message: 'What luxury items are appreciating in value right now?' });
    } else if (categories.includes('real-estate')) {
      chips.push({ label: '🏠 Flip analysis', message: 'Give me tips on spotting profitable real estate flips' });
    } else {
      chips.push({ label: '🔥 What\'s hot', message: 'What resale categories are hot right now?' });
    }

    if (scanHistory.length >= 5) {
      chips.push({ label: '🎯 Hunt strategy', message: 'Based on my history, what should I hunt for next?' });
    }
  }

  return chips.slice(0, 4);
}

// =============================================================================
// CONVERSATION TITLE GENERATOR
// =============================================================================

function generateTitle(firstMessage: string): string {
  // Take first 50 chars of user's first message as title
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

    // ── Fetch scan history ────────────────────────────────
    const { data: scanHistory } = await supabaseAdmin
      .from('analysis_history')
      .select('id, item_name, estimated_value, category, confidence, decision, created_at, analysis_result, consensus_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // ── Fetch vault items ─────────────────────────────────
    const { data: vaultItems } = await supabaseAdmin
      .from('vault_items')
      .select('id, item_name, estimated_value, category, condition, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    // ── Fetch user profile ────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, settings')
      .eq('id', user.id)
      .single();

    // ── Build system prompt ───────────────────────────────
    const systemPrompt = buildSystemPrompt(
      scanHistory || [],
      vaultItems || [],
      profile
    );

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 20 messages)
    if (Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-20);
      for (const turn of recentHistory) {
        if (turn.role === 'user' || turn.role === 'assistant') {
          messages.push({ role: turn.role, content: turn.content });
        }
      }
    }

    messages.push({ role: 'user', content: message });

    // ── Call LLM ──────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseText = completion.choices[0].message.content;

    if (!responseText) {
      throw new Error('Oracle returned empty response');
    }

    // ── Persist conversation ──────────────────────────────
    const userMsg = { role: 'user', content: message, timestamp: Date.now() };
    const assistantMsg = { role: 'assistant', content: responseText, timestamp: Date.now() };

    let activeConversationId = conversationId || null;

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
      // Create new conversation
      const { data: newConvo } = await supabaseAdmin
        .from('oracle_conversations')
        .insert({
          user_id: user.id,
          title: generateTitle(message),
          messages: [userMsg, assistantMsg],
          scan_count_at_creation: scanHistory?.length || 0,
          is_active: true,
        })
        .select('id')
        .single();

      activeConversationId = newConvo?.id || null;
    }

    // ── Response ──────────────────────────────────────────
    const quickChips = getQuickChips(scanHistory || [], vaultItems || []);

    return res.status(200).json({
      response: responseText,
      conversationId: activeConversationId,
      quickChips,
      scanCount: scanHistory?.length || 0,
      vaultCount: vaultItems?.length || 0,
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