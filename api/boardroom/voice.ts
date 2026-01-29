// FILE: api/boardroom/voice.ts
// ElevenLabs text-to-speech for board member responses

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Default voice if member doesn't have one assigned
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

async function verifyBoardroomAccess(userId: string): Promise<boolean> {
  const { data } = await supaAdmin
    .from('boardroom_access')
    .select('access_level, expires_at')
    .eq('user_id', userId)
    .single();

  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

// Get voice settings for a board member
async function getMemberVoice(memberSlug: string): Promise<{ voiceId: string; settings: VoiceSettings }> {
  const { data: member } = await supaAdmin
    .from('boardroom_members')
    .select('voice_id, voice_settings')
    .eq('slug', memberSlug)
    .single();

  return {
    voiceId: member?.voice_id || DEFAULT_VOICE_ID,
    settings: member?.voice_settings || {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
    },
  };
}

// Track voice usage
async function trackVoiceUsage(userId: string, memberSlug: string, charCount: number, duration?: number) {
  await supaAdmin
    .from('boardroom_voice_usage')
    .insert({
      user_id: userId,
      member_slug: memberSlug,
      character_count: charCount,
      audio_duration_seconds: duration,
    });
}

// Generate speech using ElevenLabs
async function generateSpeech(text: string, voiceId: string, settings: VoiceSettings): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarity_boost,
        style: settings.style || 0.5,
        use_speaker_boost: settings.use_speaker_boost ?? true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs error:', errorText);
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  return response.arrayBuffer();
}

// Get available voices from ElevenLabs
async function getAvailableVoices() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch voices');
  }

  const data = await response.json();
  return data.voices;
}

// Get subscription/usage info
async function getUsageInfo() {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch usage info');
  }

  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    if (!await verifyBoardroomAccess(user.id)) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // GET - Get voice info, available voices, or usage stats
    if (req.method === 'GET') {
      const { action, member } = req.query;

      // Check if ElevenLabs is configured
      if (!ELEVENLABS_API_KEY) {
        return res.status(200).json({
          configured: false,
          message: 'Add ELEVENLABS_API_KEY to Vercel environment variables to enable voice',
        });
      }

      if (action === 'voices') {
        const voices = await getAvailableVoices();
        return res.status(200).json({ voices });
      }

      if (action === 'usage') {
        const usage = await getUsageInfo();
        return res.status(200).json(usage);
      }

      if (member) {
        const voice = await getMemberVoice(member as string);
        return res.status(200).json(voice);
      }

      // Default: return config status and member voice assignments
      const { data: members } = await supaAdmin
        .from('boardroom_members')
        .select('slug, name, voice_id, voice_settings')
        .eq('is_active', true)
        .order('display_order');

      const usage = await getUsageInfo().catch(() => null);

      return res.status(200).json({
        configured: true,
        members: members || [],
        subscription: usage,
      });
    }

    // POST - Generate speech for text
    if (req.method === 'POST') {
      const { text, member_slug, message_id } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      if (!ELEVENLABS_API_KEY) {
        return res.status(400).json({ error: 'Voice not configured. Add ELEVENLABS_API_KEY to environment.' });
      }

      // Limit text length to prevent abuse (ElevenLabs charges per character)
      const maxChars = 5000;
      const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

      // Get voice settings for member
      const { voiceId, settings } = await getMemberVoice(member_slug || 'griffin');

      // Generate speech
      const audioBuffer = await generateSpeech(truncatedText, voiceId, settings);

      // Track usage
      await trackVoiceUsage(user.id, member_slug || 'unknown', truncatedText.length);

      // Return audio as base64 or stream
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      return res.status(200).json({
        audio: base64Audio,
        format: 'mp3',
        character_count: truncatedText.length,
        member_slug,
        voice_id: voiceId,
      });
    }

    // POST with streaming response (alternative endpoint)
    if (req.method === 'POST' && req.query.stream === 'true') {
      const { text, member_slug } = req.body;

      if (!text || !ELEVENLABS_API_KEY) {
        return res.status(400).json({ error: 'Text and API key required' });
      }

      const { voiceId, settings } = await getMemberVoice(member_slug || 'griffin');
      const audioBuffer = await generateSpeech(text, voiceId, settings);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      return res.send(Buffer.from(audioBuffer));
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('Voice API error:', error);
    
    if (error.message.includes('Authentication')) {
      return res.status(401).json({ error: error.message });
    }
    
    return res.status(500).json({ error: error.message || 'Voice generation failed' });
  }
}