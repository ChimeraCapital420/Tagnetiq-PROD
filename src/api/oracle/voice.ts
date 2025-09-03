// FILE: src/api/oracle/voice.ts
// Premium voice generation API endpoint

import express from 'express';
import { requireAuth, AuthenticatedRequest } from '@/middleware/rbac';
import { z } from 'zod';
import { ElevenLabsClient } from 'elevenlabs';
import NodeCache from 'node-cache';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache for voice audio

// Initialize ElevenLabs client (or other TTS provider)
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY!
});

// Voice ID mapping to actual provider voice IDs
const VOICE_MAPPING: Record<string, string> = {
  'oracle-nova-en': 'EXAVITQu4vr4xnSDxMaL', // Example ElevenLabs voice ID
  'oracle-atlas-en': 'TxGEqnHWrfWFTfGW9XjX',
  'oracle-sage-en': 'MF3mGyEYCl7XYWbV9V6O',
  'oracle-luna-es': 'ThT5KcBeYPX3keUQqHPh',
  'oracle-sol-es': 'VR6AewLTigWG4xSOukaG',
  'oracle-amelie-fr': 'GBv7mTt0atIp3Br8iCZE',
  'oracle-marco-it': 'EjL8YqOqrHCjLe2lEu8m'
};

const generateSpeechSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string()
});

// Apply auth middleware
router.use(requireAuth);

// POST /api/oracle/generate-speech
router.post('/generate-speech', async (req: AuthenticatedRequest, res) => {
  try {
    const { text, voiceId } = generateSpeechSchema.parse(req.body);
    
    // Check if user has premium voice access (could be based on subscription tier)
    const userProfile = await getUserProfile(req.user!.id);
    if (!userProfile.settings?.premium_voice_enabled) {
      return res.status(403).json({ error: 'Premium voices not enabled for this account' });
    }

    // Get the actual provider voice ID
    const providerVoiceId = VOICE_MAPPING[voiceId];
    if (!providerVoiceId) {
      return res.status(400).json({ error: 'Invalid voice ID' });
    }

    // Check cache first
    const cacheKey = `voice:${voiceId}:${createHash(text)}`;
    const cached = cache.get<Buffer>(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached);
    }

    // Generate speech using ElevenLabs (or your preferred provider)
    const audioStream = await elevenlabs.textToSpeech.convert({
      voice_id: providerVoiceId,
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.5,
        use_speaker_boost: true
      }
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Cache the result
    cache.set(cacheKey, audioBuffer);

    // Send the audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cache', 'MISS');
    res.send(audioBuffer);

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data' });
    }
    
    console.error('Voice generation error:', error);
    
    // Don't expose internal errors to client
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// GET /api/oracle/voices
router.get('/voices', async (req: AuthenticatedRequest, res) => {
  try {
    // Return available voices based on user's subscription/settings
    const userProfile = await getUserProfile(req.user!.id);
    const hasUltraTier = userProfile.settings?.voice_tier === 'ultra';
    
    const voices = Object.keys(VOICE_MAPPING).map(id => {
      const voice = PREMIUM_VOICES.find(v => v.id === id);
      return {
        id,
        name: voice?.name,
        language: voice?.language,
        tier: voice?.tier,
        available: voice?.tier === 'standard' || 
                   (voice?.tier === 'premium' && userProfile.settings?.premium_voice_enabled) ||
                   (voice?.tier === 'ultra' && hasUltraTier)
      };
    });

    res.json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Helper functions
async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single();
    
  if (error) throw error;
  return data;
}

function createHash(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16);
}

// Premium voice metadata (same as in the component)
const PREMIUM_VOICES = [
  {
    id: 'oracle-nova-en',
    name: 'Nova',
    language: 'en',
    gender: 'female',
    tier: 'premium'
  },
  // ... rest of voices
];

export default router;