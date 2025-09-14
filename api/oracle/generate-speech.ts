// FILE: api/oracle/generate-speech.ts
// Premium voice generation endpoint with ElevenLabs integration

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY_KEY!
);

// Map of our voice IDs to ElevenLabs voice IDs
// REPLACE THESE WITH THE SAME IDs YOU USED IN voices.ts
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
  'oracle-will-it': 'bIHbv24MWmeRgasZH58o'
};

const generateSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional()
});

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  
  // Get user profile with settings
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

  const { user, profile } = authResult;
  
  // Check if premium voices are enabled for this user
  const hasPremiumAccess = true; // In production, check subscription status
  
  if (!hasPremiumAccess) {
    return res.status(403).json({ error: 'Premium voices not enabled for this account' });
  }

  try {
    const { text, voiceId } = generateSpeechSchema.parse(req.body);
    
    // Use provided voiceId or fall back to user's preference
    const selectedVoiceId = voiceId || profile?.settings?.premium_voice_id || 'oracle-nova-en';
    
    // Validate voice ID
    const elevenlabsVoiceId = VOICE_MAPPING[selectedVoiceId];
    if (!elevenlabsVoiceId) {
      return res.status(400).json({ error: 'Invalid voice ID' });
    }

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${elevenlabsVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Set response headers
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Stream the audio directly to the client
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    // Convert stream to node response
    const nodeStream = require('stream');
    const readableStream = nodeStream.Readable.from(stream);
    readableStream.pipe(res);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    console.error('Voice generation error:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
}