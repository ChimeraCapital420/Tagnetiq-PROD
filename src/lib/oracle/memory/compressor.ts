// FILE: src/lib/oracle/memory/compressor.ts
// Compresses Oracle conversations into structured memory summaries
// Runs after conversation ends or hits message threshold
// Target: ~500 tokens per summary — cheap to store, fast to inject into prompt

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

interface ItemMention {
  name: string;
  category?: string;
  estimatedValue?: number;
  action?: 'bought' | 'sold' | 'considering' | 'passed' | 'scanning';
}

// =============================================================================
// COMPRESSION PROMPT
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
  "items_discussed": [
    { "name": "1952 Topps Mickey Mantle", "category": "sports cards", "estimatedValue": 50000, "action": "considering" }
  ]
}

Intensity levels: casual (mentioned once), interested (asked questions), passionate (discussed at length), obsessed (keeps coming back to it)
Expertise levels: newcomer (asks basic questions), learning (understands basics), intermediate (uses terminology), advanced (discusses market dynamics), expert (teaches others)`;

// =============================================================================
// COMPRESS CONVERSATION
// =============================================================================

export async function compressConversation(
  userId: string,
  conversationId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<MemorySummary | null> {
  // Need at least 4 meaningful messages to compress
  const meaningful = messages.filter(m =>
    m.role !== 'system' && m.content.trim().length > 10
  );
  if (meaningful.length < 4) return null;

  // Format messages for compression (limit to prevent token overflow)
  const truncated = meaningful.slice(-40); // Last 40 messages max
  const transcript = truncated
    .map(m => `${m.role === 'user' ? 'USER' : 'ORACLE'}: ${m.content.substring(0, 500)}`)
    .join('\n');

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
          { role: 'system', content: COMPRESSION_PROMPT },
          { role: 'user', content: `CONVERSATION:\n${transcript}` },
        ],
        max_tokens: 800,
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

    const summary: MemorySummary = {
      user_id: userId,
      conversation_id: conversationId,
      summary: parsed.summary || '',
      topics: parsed.topics || [],
      interests_revealed: parsed.interests_revealed || [],
      promises_made: parsed.promises_made || [],
      expertise_signals: parsed.expertise_signals || { level: 'learning', indicators: [] },
      emotional_markers: parsed.emotional_markers || [],
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

    console.log(`[Memory] Compressed conversation ${conversationId} → ${summary.token_count} tokens, ${summary.topics.length} topics`);
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
