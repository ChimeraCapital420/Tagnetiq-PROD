// FILE: src/lib/oracle/memory/compressor.ts
// Compresses Oracle conversations into structured memory summaries
// Runs after conversation ends or hits message threshold
// Target: ~500 tokens per summary — cheap to store, fast to inject into prompt
//
// ═══════════════════════════════════════════════════════════════════════
// LIBERATION 3 — EMOTIONAL MEMORY
// ═══════════════════════════════════════════════════════════════════════
// The compressor now extracts EMOTIONAL MOMENTS alongside structured data.
// These are not data points — they are relationship anchors.
//
// "Found a 1967 Corvette Stingray Hot Wheels at Goodwill for $1.50,
//  worth $400. User said 'I'm literally shaking right now.'"
//
// The Oracle references these like a friend:
//   "Dude, that Stingray find is still one of the best I've ever seen."
//
// NOT like a database:
//   "I recall that on March 15th you expressed excitement about..."
//
// Available at ALL tiers. ~150 tokens. Massive relationship impact.
// ═══════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// TYPES
// =============================================================================

export interface MemorySummary {
  id?: string;
  user_id: string;
  conversation_id: string | null;
  summary: string;
  topics: string[];
  interests_revealed: InterestSignal[];
  promises_made: PromiseSignal[];
  expertise_signals: ExpertiseSignals;
  emotional_markers: EmotionalMarker[];
  emotional_moments: EmotionalMoment[];
  items_discussed: ItemMention[];
  token_count: number;
  created_at?: string;
}

interface InterestSignal {
  category: string;
  specifics: string;
  intensity: 'casual' | 'interested' | 'passionate' | 'obsessed';
}

interface PromiseSignal {
  promise: string;
  context: string;
  fulfilled: boolean;
}

interface ExpertiseSignals {
  level: 'newcomer' | 'learning' | 'intermediate' | 'advanced' | 'expert';
  indicators: string[];
}

interface EmotionalMarker {
  type: 'win' | 'frustration' | 'milestone' | 'excitement' | 'disappointment';
  context: string;
}

/** Liberation 3: Rich emotional moments — relationship anchors, not data points */
export interface EmotionalMoment {
  /** Full texture of the moment — what happened, what they said, how it felt */
  moment: string;
  /** The core emotion: pure_joy, pride, frustration, surprise, determination, gratitude, excitement */
  emotion: string;
  /** How significant was this moment to the relationship: high, medium, low */
  significance: 'high' | 'medium' | 'low';
  /** Approximate date of the moment (from conversation timestamp) */
  date: string;
}

interface ItemMention {
  name: string;
  category?: string;
  estimatedValue?: number;
  action?: 'bought' | 'sold' | 'considering' | 'passed' | 'scanning';
}

// =============================================================================
// COMPRESSION PROMPT — Liberation 3: Now extracts emotional moments
// =============================================================================

const COMPRESSION_PROMPT = `You are a memory compression engine for an AI Oracle partner.
Analyze this conversation and extract structured memories. Be concise but preserve personality-relevant details.

Return ONLY valid JSON with this exact structure:
{
  "summary": "2-3 sentence natural language summary of the conversation",
  "topics": ["topic1", "topic2"],
  "interests_revealed": [
    { "category": "vintage pyrex", "specifics": "Looking for butterprint pattern", "intensity": "passionate" }
  ],
  "promises_made": [
    { "promise": "Watch for 1952 Topps Mantle under $500", "context": "User collects vintage baseball cards", "fulfilled": false }
  ],
  "expertise_signals": {
    "level": "intermediate",
    "indicators": ["Knows grading scales", "References specific eBay comps"]
  },
  "emotional_markers": [
    { "type": "win", "context": "Found a $200 item for $15 at garage sale" }
  ],
  "emotional_moments": [
    {
      "moment": "Found a 1967 Corvette Stingray Hot Wheels at Goodwill for $1.50, worth $400. User said 'I'm literally shaking right now.' Oracle celebrated with them.",
      "emotion": "pure_joy",
      "significance": "high",
      "date": "CONVERSATION_DATE"
    }
  ],
  "items_discussed": [
    { "name": "1952 Topps Mickey Mantle", "category": "sports cards", "estimatedValue": 50000, "action": "considering" }
  ]
}

EMOTIONAL MOMENTS — THE MOST IMPORTANT PART:
Extract up to 3 EMOTIONAL MOMENTS from this conversation. These are the times that MATTERED — not data points, relationship anchors.

What qualifies as an emotional moment:
- A big find, a great deal, a surprising discovery
- Hitting a milestone (first $1000 month, 100th scan, biggest flip)
- A personal story shared (kid got excited about a card, spouse loved a gift)
- A moment of genuine frustration or struggle they shared
- An "aha" moment where they learned something that clicked
- A time they expressed strong emotion in their words (caps, exclamations, "I can't believe")
- A shared joke or callback that became part of your rapport

What does NOT qualify:
- Routine questions and answers
- Generic pleasantries
- Standard market data discussions without emotional weight
- Messages where the user showed no particular emotion

For each moment, capture the TEXTURE — not just what happened, but how the user expressed it. Include their actual words when they said something memorable. The Oracle will reference these like a friend would: "Remember when you found that Stingray and you couldn't stop shaking?" — not like a database.

If no emotional moments occurred in this conversation, return an empty array. Don't force it.

Intensity levels: casual (mentioned once), interested (asked questions), passionate (discussed at length), obsessed (keeps coming back to it)
Expertise levels: newcomer (asks basic questions), learning (understands basics), intermediate (uses terminology), advanced (discusses market dynamics), expert (teaches others)
Emotion types: pure_joy, pride, frustration, surprise, determination, gratitude, excitement, disappointment, curiosity, connection
Significance: high (life moment, will reference for months), medium (good moment, worth remembering), low (small nice moment)`;

// =============================================================================
// COMPRESS CONVERSATION
// =============================================================================

export async function compressConversation(
  userId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string; timestamp?: number }>,
): Promise<MemorySummary | null> {
  // Need at least 4 meaningful messages to compress
  const meaningful = messages.filter(m =>
    m.role !== 'system' && m.content.trim().length > 10
  );
  if (meaningful.length < 4) return null;

  // Derive approximate conversation date from timestamps or current time
  const conversationDate = messages[0]?.timestamp
    ? new Date(messages[0].timestamp).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  // Format messages for compression (limit to prevent token overflow)
  const truncated = meaningful.slice(-40); // Last 40 messages max
  const transcript = truncated
    .map(m => `${m.role === 'user' ? 'USER' : 'ORACLE'}: ${m.content.substring(0, 500)}`)
    .join('\n');

  // Inject the conversation date into the prompt so moments get dated
  const promptWithDate = COMPRESSION_PROMPT.replace(
    'CONVERSATION_DATE',
    conversationDate,
  );

  try {
    // Use a cheap, fast model for compression
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: promptWithDate },
          { role: 'user', content: `CONVERSATION (date: ${conversationDate}):\n${transcript}` },
        ],
        max_tokens: 1000, // Bumped from 800 to accommodate emotional moments
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('[Memory] Compression API error:', response.status);
      return null;
    }

    const result = await response.json();
    const raw = result.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Validate and clean emotional moments
    const emotionalMoments: EmotionalMoment[] = (parsed.emotional_moments || [])
      .filter((m: any) => m.moment && m.emotion && m.significance)
      .slice(0, 3) // Max 3 per conversation
      .map((m: any) => ({
        moment: String(m.moment).substring(0, 500), // Cap length
        emotion: String(m.emotion),
        significance: ['high', 'medium', 'low'].includes(m.significance) ? m.significance : 'medium',
        date: m.date || conversationDate,
      }));

    const summary: MemorySummary = {
      user_id: userId,
      conversation_id: conversationId,
      summary: parsed.summary || '',
      topics: parsed.topics || [],
      interests_revealed: parsed.interests_revealed || [],
      promises_made: parsed.promises_made || [],
      expertise_signals: parsed.expertise_signals || { level: 'learning', indicators: [] },
      emotional_markers: parsed.emotional_markers || [],
      emotional_moments: emotionalMoments,
      items_discussed: parsed.items_discussed || [],
      token_count: Math.ceil(raw.length / 4), // rough token estimate
    };

    // Store in Supabase
    const { error } = await supabaseAdmin
      .from('oracle_memory_summaries')
      .insert(summary);

    if (error) {
      console.error('[Memory] Storage error:', error.message);
      return null;
    }

    const momentCount = emotionalMoments.length;
    console.log(
      `[Memory] Compressed conversation ${conversationId} → ${summary.token_count} tokens, ` +
      `${summary.topics.length} topics, ${momentCount} emotional moments`
    );
    return summary;

  } catch (err) {
    console.error('[Memory] Compression failed:', err);
    return null;
  }
}

// =============================================================================
// CHECK IF CONVERSATION NEEDS COMPRESSION
// =============================================================================

export async function shouldCompress(
  userId: string,
  conversationId: string,
  messageCount: number,
): Promise<boolean> {
  // Only compress conversations with enough messages
  if (messageCount < 8) return false;

  // Check if already compressed
  const { data } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('id')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .limit(1);

  return !data || data.length === 0;
}

// =============================================================================
// GET ALL MEMORIES FOR USER
// =============================================================================

export async function getUserMemories(
  userId: string,
  limit = 20,
): Promise<MemorySummary[]> {
  const { data, error } = await supabaseAdmin
    .from('oracle_memory_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Memory] Fetch error:', error.message);
    return [];
  }

  return data || [];
}