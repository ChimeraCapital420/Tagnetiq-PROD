// FILE: api/oracle/generate-speech.ts
// Oracle Phase 1 — Premium voice generation with ElevenLabs
// FIXED: Removed edge runtime + require('stream') — was crashing on Vercel Edge
// FIXED: SUPABASE_ANON_KEY_KEY → SUPABASE_ANON_KEY (typo)
// FIXED: Proper Node.js streaming using arrayBuffer → Buffer → res.end()

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const config = {
  maxDuration: 15,
};

const supabase = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // FIXED: was SUPABASE_ANON_KEY_KEY
);

// Map our voice IDs → ElevenLabs voice IDs
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

const generateSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
});

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
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
    const { text, voiceId } = generateSpeechSchema.parse(req.body);

    // Use provided voiceId or fall back to user's preference
    const selectedVoiceId = voiceId || profile?.settings?.premium_voice_id || 'oracle-nova-en';

    // Validate voice ID
    const elevenlabsVoiceId = VOICE_MAPPING[selectedVoiceId];
    if (!elevenlabsVoiceId) {
      return res.status(400).json({ error: 'Invalid voice ID' });
    }

    // Check ElevenLabs API key
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'Premium voice service not configured' });
    }

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
          model_id: 'eleven_multilingual_v2', // Upgraded from v1 for better multilingual
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text();
      console.error('ElevenLabs API error:', elevenLabsResponse.status, errorText);
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    // FIXED: Proper Node.js streaming — read full buffer and send
    // This works reliably on Vercel Serverless (not Edge)
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