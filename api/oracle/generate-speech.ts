// FILE: api/oracle/generate-speech.ts
// STATUS: NEW - This endpoint generates high-quality, natural-sounding speech.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

// In a real-world scenario, you would use an SDK like 'elevenlabs-node'.
// For this example, we'll use a direct fetch call.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'Voice generation service is not configured.' });
  }

  try {
    await verifyUser(req);
    const { text, voiceId } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ error: 'Missing "text" or "voiceId".' });
    }

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('ElevenLabs API Error:', errorBody);
      throw new Error('Failed to generate speech.');
    }

    // Stream the audio back to the client
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body?.pipe(res);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Error in speech generation:', message);
    res.status(500).json({ error: 'Speech generation failed.' });
  }
}
