// FILE: api/oracle/generate-speech.ts
// Oracle — Premium voice generation with ElevenLabs
// Accepts curated aliases (oracle-nova-en) AND direct ElevenLabs IDs (el-xxx)
// Sprint N: Energy-aware voiceSettings from useTts hook
// FIXED: Uses supabaseAdmin with service role key

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const config = {
  maxDuration: 15,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

  // 3. Raw ElevenLabs ID (alphanumeric, 20+ chars)
  if (/^[a-zA-Z0-9]{15,}$/.test(voiceId)) {
    return voiceId;
  }

  return null;
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

    // Merge energy-aware settings with defaults
    const mergedSettings = {
      stability: voiceSettings?.stability ?? DEFAULT_VOICE_SETTINGS.stability,
      similarity_boost: voiceSettings?.similarity_boost ?? DEFAULT_VOICE_SETTINGS.similarity_boost,
      style: voiceSettings?.style ?? DEFAULT_VOICE_SETTINGS.style,
      use_speaker_boost: true,
    };

    // Call ElevenLabs API
    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: mergedSettings,
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    const audioBuffer = await elevenLabsResponse.arrayBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.byteLength.toString());
    res.setHeader('Cache-Control', 'public, max-age=3600');

    res.status(200).end(Buffer.from(audioBuffer));

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    console.error('Voice generation error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
}
