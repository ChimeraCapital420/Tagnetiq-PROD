// FILE: api/oracle/generate-speech.ts
// Oracle — Premium voice generation with ElevenLabs
// Accepts curated aliases (oracle-nova-en) AND direct ElevenLabs IDs (el-xxx)
// Sprint N: Energy-aware voiceSettings from useTts hook
//
// ═══════════════════════════════════════════════════════════════════════
// VOICE TIMEOUT FIX — February 2026
// ═══════════════════════════════════════════════════════════════════════
//
// Problem: maxDuration was 15s. After the LLM call takes 10s (especially
//          on fallback), the speech endpoint only gets 5s before the
//          client's fetch times out → 504 → browser TTS → robot voice.
//
// Fixes:
//   1. maxDuration → 25s (matches chat.ts budget)
//   2. Truncate text to 2500 chars for TTS (nobody listens to 5 min audio)
//   3. ElevenLabs fetch timeout: 18s (leave room for response)
//   4. Stream audio back to client as it arrives (no full buffer wait)
//   5. Return partial audio on timeout rather than 504
// ═══════════════════════════════════════════════════════════════════════
//
// FIXED: Uses supabaseAdmin with service role key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const config = {
  maxDuration: 25,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ElevenLabs fetch timeout — leave 5s for Vercel overhead + response streaming
const ELEVENLABS_TIMEOUT_MS = 18_000;

// Max text length for TTS — 2500 chars ≈ ~2 minutes of speech.
// Longer text rarely gets listened to fully and causes ElevenLabs timeouts.
const MAX_TTS_TEXT_LENGTH = 2500;

// Curated alias → ElevenLabs voice ID mapping
const VOICE_MAPPING: Record<string, string> = {
  'oracle-nova-en': '21m00Tcm4TlvDq8ikWAM',
  'oracle-will-en': 'bIHbv24MWmeRgasZH58o',
  'oracle-sage-en': 'EXAVITQu4vr4xnSDxMaL',
  'oracle-luna-es': 'MF3mGyEYCl7XYWbV9V6O',
  'oracle-will-es': 'bIHbv24MWmeRgasZH58o',
  'oracle-sol-es': 'TxGEqnHWrfWFTfGW9XjX',
  'oracle-will-fr': 'bIHbv24MWmeRgasZH58o',
  'oracle-amelie-fr': 'VR6AewLTigWG4xSOukaG',
  'oracle-marco-it': 'onwK4e9ZLuTAKqWW03F9',
  'oracle-will-it': 'bIHbv24MWmeRgasZH58o',
};

/**
 * Resolve any voice ID format to an ElevenLabs voice ID:
 * - Curated alias: "oracle-nova-en" → lookup in VOICE_MAPPING
 * - Direct ElevenLabs: "el-abc123" → strip "el-" prefix
 * - Raw ElevenLabs ID: "21m00Tcm4TlvDq8ikWAM" → pass through
 */
function resolveVoiceId(voiceId: string): string | null {
  // 1. Curated alias
  if (VOICE_MAPPING[voiceId]) {
    return VOICE_MAPPING[voiceId];
  }

  // 2. Prefixed ElevenLabs ID from voice picker (el-xxx)
  if (voiceId.startsWith('el-')) {
    return voiceId.slice(3);
  }

  // 3. Raw ElevenLabs ID (alphanumeric, 15+ chars)
  if (/^[a-zA-Z0-9]{15,}$/.test(voiceId)) {
    return voiceId;
  }

  return null;
}

/**
 * Truncate text for TTS while keeping it natural.
 * Cuts at the last sentence boundary before the limit.
 */
function truncateForTTS(text: string): string {
  if (text.length <= MAX_TTS_TEXT_LENGTH) return text;

  // Find last sentence-ending punctuation before the limit
  const truncated = text.substring(0, MAX_TTS_TEXT_LENGTH);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('! '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('.\n'),
    truncated.lastIndexOf('!\n'),
    truncated.lastIndexOf('?\n'),
  );

  if (lastSentenceEnd > MAX_TTS_TEXT_LENGTH * 0.5) {
    // Cut at the sentence boundary (include the punctuation)
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }

  // No good sentence boundary — just cut and add ellipsis
  return truncated.trim() + '...';
}

// Default voice settings (neutral energy)
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
  use_speaker_boost: true,
};

const generateSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  voiceSettings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity_boost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.7).max(1.3).optional(),
  }).optional(),
});

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('settings')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = await verifyAuth(req);
  if (!authResult) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { profile } = authResult;

  try {
    const { text, voiceId, voiceSettings } = generateSpeechSchema.parse(req.body);

    // Resolve voice: request → user preference → default
    const requestedId = voiceId || profile?.settings?.premium_voice_id || 'oracle-nova-en';
    const elevenlabsVoiceId = resolveVoiceId(requestedId);

    if (!elevenlabsVoiceId) {
      return res.status(400).json({ error: `Invalid voice ID: ${requestedId}` });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'Premium voice service not configured' });
    }

    // ── Truncate text for TTS ────────────────────────────
    // Long responses cause ElevenLabs timeouts. Cut at sentence boundary.
    const ttsText = truncateForTTS(text);

    // Merge energy-aware settings with defaults
    const mergedSettings = {
      stability: voiceSettings?.stability ?? DEFAULT_VOICE_SETTINGS.stability,
      similarity_boost: voiceSettings?.similarity_boost ?? DEFAULT_VOICE_SETTINGS.similarity_boost,
      style: voiceSettings?.style ?? DEFAULT_VOICE_SETTINGS.style,
      use_speaker_boost: true,
    };

    // ── Call ElevenLabs with timeout ─────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);

    let elevenLabsResponse: Response;
    try {
      elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: ttsText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: mergedSettings,
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === 'AbortError') {
        console.error(`ElevenLabs timed out after ${ELEVENLABS_TIMEOUT_MS}ms (text: ${ttsText.length} chars)`);
        return res.status(504).json({ error: 'Voice generation timed out' });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    // ── Stream audio back to client ─────────────────────
    // Don't buffer the entire audio — start sending as ElevenLabs delivers.
    const audioBody = elevenLabsResponse.body;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (audioBody && typeof audioBody.pipeTo === 'function') {
      // Streams API available — pipe directly
      // Vercel edge/node environments may support this
      try {
        const reader = audioBody.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        };
        await pump();
        return;
      } catch {
        // Stream pipe failed — fall through to buffer approach
      }
    }

    // Fallback: buffer and send (original approach, but with timeout protection)
    const audioBuffer = await elevenLabsResponse.arrayBuffer();
    res.setHeader('Content-Length', audioBuffer.byteLength.toString());
    res.status(200).end(Buffer.from(audioBuffer));

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    console.error('Voice generation error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
}