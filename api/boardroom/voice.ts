// FILE: api/boardroom/voice.ts
// ═══════════════════════════════════════════════════════════════════════
// BOARDROOM VOICE — Energy-Aware Text-to-Speech
// ═══════════════════════════════════════════════════════════════════════
//
// Sprint 2: Memory-Aware Voice
//
// Voice is personality, not a feature. Prometheus sounds different when
// the founder is exhausted vs. fired up. Griffin stays measured in crisis
// while Glitch goes full energy in celebration.
//
// WHAT CHANGED (Sprint 2):
//   ✓ Energy detection from recent messages or client hints
//   ✓ Per-member voice personality adjustments via voice-personality.ts
//   ✓ Merged ElevenLabs settings: base DB settings + energy overlay
//   ✓ Energy context in response metadata
//   ✓ AbortController timeout (18s) — no more hanging requests
//   ✓ Smart text truncation (sentence boundary, 2500 chars)
//   ✓ Streaming endpoint fixed (was unreachable)
//   ✓ Mobile-first: Content-Length headers, efficient payloads
//   ✓ Turbo model for English (2-3x faster), multilingual for non-ASCII
//
// IMPORTS:
//   voice-personality.ts → pure functions, no DB, no API calls
//   energy.ts → detectEnergy (pure function, ~0ms)
//
// ═══════════════════════════════════════════════════════════════════════

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security.js';
import { detectEnergy } from '../../src/lib/boardroom/energy.js';
import {
  getEnergyAwareVoiceSettings,
  type MergedVoiceSettings,
} from '../../src/lib/boardroom/voice-personality.js';

export const config = {
  maxDuration: 25,
};

// =============================================================================
// CONSTANTS
// =============================================================================

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

/** Default voice if member doesn't have one assigned (Adam) */
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

/** ElevenLabs fetch timeout — leave 5s for Vercel overhead + response */
const ELEVENLABS_TIMEOUT_MS = 18_000;

/**
 * Max text length for TTS — 2500 chars ≈ ~2 minutes of speech.
 * Longer text causes ElevenLabs multilingual_v2 to timeout on Vercel.
 * Users can read the full text in chat — TTS is for the key message.
 */
const MAX_TTS_TEXT_LENGTH = 2500;

// =============================================================================
// TYPES
// =============================================================================

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

// =============================================================================
// ACCESS VERIFICATION
// =============================================================================

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

// =============================================================================
// MEMBER VOICE SETTINGS (from DB)
// =============================================================================

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

// =============================================================================
// ENERGY DETECTION — from client hint or recent messages
// =============================================================================

/**
 * Resolve the founder's current energy for voice adaptation.
 *
 * Priority:
 *   1. Server-side detection from recent_messages (most accurate)
 *   2. Client energy hint (validated against whitelist)
 *   3. Default: 'neutral'
 *
 * Mobile-first: client sends energy hint to save server time.
 * Server validates but trusts the hint when no messages provided.
 */
function resolveFounderEnergy(
  clientEnergyHint?: string,
  recentMessages?: Array<{ role: string; content: string }>,
): string {
  // Server-side detection from recent messages (most accurate)
  if (recentMessages && recentMessages.length > 0) {
    const userMessages = recentMessages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1].content;
      return detectEnergy(lastUserMessage);
    }
  }

  // Client hint — validate against known energy levels
  const VALID_ENERGIES = new Set([
    'neutral', 'excited', 'frustrated', 'focused', 'curious', 'casual',
    'anxious', 'exhausted', 'determined', 'fired_up', 'celebratory',
  ]);

  if (clientEnergyHint && VALID_ENERGIES.has(clientEnergyHint)) {
    return clientEnergyHint;
  }

  return 'neutral';
}

// =============================================================================
// TEXT TRUNCATION — Smart sentence boundary
// =============================================================================

/**
 * Truncate text at a sentence boundary. Nobody wants speech cut mid-word.
 * Mobile-first: shorter audio = faster delivery to phone speakers.
 */
function truncateForTTS(text: string): string {
  if (text.length <= MAX_TTS_TEXT_LENGTH) return text;

  // Find the last sentence boundary before the limit
  const truncated = text.substring(0, MAX_TTS_TEXT_LENGTH);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastExclaim = truncated.lastIndexOf('! ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const lastNewline = truncated.lastIndexOf('\n');

  const cutPoint = Math.max(lastPeriod, lastExclaim, lastQuestion, lastNewline);

  if (cutPoint > MAX_TTS_TEXT_LENGTH * 0.5) {
    // Good sentence boundary found in the second half
    return text.substring(0, cutPoint + 1).trim();
  }

  // No good boundary — just cut at the limit
  return truncated.trim() + '...';
}

// =============================================================================
// SPEECH GENERATION — with timeout + model selection
// =============================================================================

async function generateSpeech(
  text: string,
  voiceId: string,
  settings: MergedVoiceSettings,
): Promise<ArrayBuffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Turbo model for English (2-3x faster), multilingual for non-ASCII
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  const modelId = hasNonAscii ? 'eleven_multilingual_v2' : 'eleven_turbo_v2_5';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarity_boost,
          style: settings.style,
          use_speaker_boost: settings.use_speaker_boost,
        },
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[Voice] ElevenLabs timed out after ${ELEVENLABS_TIMEOUT_MS}ms (text: ${text.length} chars)`);
      throw new Error('Voice generation timed out — try shorter text');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Voice] ElevenLabs error:', response.status, errorText);
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  return response.arrayBuffer();
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

async function trackVoiceUsage(
  userId: string,
  memberSlug: string,
  charCount: number,
  energy?: string,
  duration?: number,
) {
  await supaAdmin
    .from('boardroom_voice_usage')
    .insert({
      user_id: userId,
      member_slug: memberSlug,
      character_count: charCount,
      audio_duration_seconds: duration,
      // Sprint 2: track energy for analytics
      metadata: energy ? { energy } : undefined,
    })
    .then(() => {
      console.log(`[Voice] Tracked: ${memberSlug}, ${charCount} chars, energy=${energy || 'neutral'}`);
    })
    .catch((err: any) => {
      // Non-blocking — don't fail the request over tracking
      console.warn('[Voice] Usage tracking failed:', err.message);
    });
}

// =============================================================================
// HELPER: Available voices / usage info
// =============================================================================

async function getAvailableVoices() {
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key not configured');

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  });

  if (!response.ok) throw new Error('Failed to fetch voices');
  const data = await response.json();
  return data.voices;
}

async function getUsageInfo() {
  if (!ELEVENLABS_API_KEY) throw new Error('ElevenLabs API key not configured');

  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
  });

  if (!response.ok) throw new Error('Failed to fetch usage info');
  return response.json();
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await verifyUser(req);

    if (!await verifyBoardroomAccess(user.id)) {
      return res.status(403).json({ error: 'Boardroom access not authorized.' });
    }

    // ── GET: Voice info, available voices, usage stats ──
    if (req.method === 'GET') {
      const { action, member } = req.query;

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

      // Default: config status + member voice assignments
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

    // ── POST: Generate energy-aware speech ──────────────
    if (req.method === 'POST') {
      const isStreamRequest = req.query.stream === 'true';

      const {
        text,
        member_slug,
        message_id,
        // Sprint 2: energy-aware fields
        energy: clientEnergyHint,
        recent_messages,
      } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      if (!ELEVENLABS_API_KEY) {
        return res.status(400).json({
          error: 'Voice not configured. Add ELEVENLABS_API_KEY to environment.',
        });
      }

      const slug = member_slug || 'griffin';

      // ── 1. Truncate text at sentence boundary ─────────
      const ttsText = truncateForTTS(text);

      // ── 2. Detect founder energy ──────────────────────
      const founderEnergy = resolveFounderEnergy(clientEnergyHint, recent_messages);

      // ── 3. Get base voice settings from DB ────────────
      const { voiceId, settings: baseSettings } = await getMemberVoice(slug);

      // ── 4. Merge with energy-aware adjustments ────────
      const { settings: mergedSettings, description: energyDescription } =
        getEnergyAwareVoiceSettings(slug, founderEnergy, baseSettings);

      console.log(
        `[Voice] ${slug} | energy=${founderEnergy} | ${energyDescription} | ` +
        `stability=${mergedSettings.stability.toFixed(2)} style=${mergedSettings.style.toFixed(2)} | ` +
        `${ttsText.length} chars${ttsText.length < text.length ? ' (truncated)' : ''}`,
      );

      // ── 5. Generate speech ────────────────────────────
      const genStart = Date.now();
      const audioBuffer = await generateSpeech(ttsText, voiceId, mergedSettings);
      const genTime = Date.now() - genStart;

      console.log(`[Voice] Generated in ${genTime}ms (${audioBuffer.byteLength} bytes)`);

      // ── 6. Track usage (non-blocking) ─────────────────
      trackVoiceUsage(user.id, slug, ttsText.length, founderEnergy);

      // ── 7. Return response ────────────────────────────

      // Streaming: raw audio bytes — optimal for mobile speakers
      if (isStreamRequest) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.byteLength);
        res.setHeader('X-Energy', founderEnergy);
        res.setHeader('X-Voice-Description', energyDescription);
        return res.send(Buffer.from(audioBuffer));
      }

      // JSON: base64 audio + metadata — for clients that need context
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      return res.status(200).json({
        audio: base64Audio,
        format: 'mp3',
        character_count: ttsText.length,
        member_slug: slug,
        voice_id: voiceId,
        generation_time_ms: genTime,
        // Sprint 2: energy context in response
        _voice: {
          energy: founderEnergy,
          description: energyDescription,
          settings_applied: {
            stability: mergedSettings.stability,
            similarity_boost: mergedSettings.similarity_boost,
            style: mergedSettings.style,
          },
          was_truncated: ttsText.length < text.length,
          original_length: text.length,
        },
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error('[Voice] API error:', error);

    if (error.message?.includes('Authentication')) {
      return res.status(401).json({ error: error.message });
    }

    if (error.message?.includes('timed out')) {
      return res.status(504).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message || 'Voice generation failed' });
  }
}