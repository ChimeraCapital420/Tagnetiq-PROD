// FILE: api/oracle/transcribe.ts
// Oracle Phase 1 — Dedicated Whisper transcription for voice commands
// SEPARATE from /api/boardroom/transcribe (admin-only, heavy pipeline)
// This endpoint is lightweight: short audio clips (< 10s), user-facing, rate-aware
// NOTE: No Supabase client needed — uses verifyUser from _lib/security.js

import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { verifyUser } from '../_lib/security.js';

export const config = {
  maxDuration: 15,
};

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API_KEY });

// Max audio size: 2MB — voice commands are short (< 10 seconds)
const MAX_AUDIO_SIZE = 2 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifyUser(req);

    // Parse multipart form data
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    // Get the raw body as Buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks);

    if (body.length > MAX_AUDIO_SIZE) {
      return res.status(413).json({ error: 'Audio too large. Keep commands under 10 seconds.' });
    }

    // Extract boundary from content-type
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'Missing multipart boundary' });
    }

    // Parse multipart to extract audio file and language
    const { audioBuffer, filename, language } = parseMultipart(body, boundary);

    if (!audioBuffer || audioBuffer.length < 1000) {
      return res.status(400).json({ error: 'No audio data received' });
    }

    // Create a File object for OpenAI SDK
    const audioFile = new File(
      [audioBuffer],
      filename || 'command.webm',
      { type: 'audio/webm' }
    );

    // Whisper transcription — optimized for short commands
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language || undefined,
      prompt: 'scan, vault, search, navigate, open, help, arena, dashboard',
      temperature: 0.0,
    });

    const text = (transcription.text || '').trim();

    return res.status(200).json({ text });

  } catch (error: any) {
    const message = error.message || 'Transcription failed';
    if (message.includes('Authentication')) {
      return res.status(401).json({ error: message });
    }
    console.error('Oracle transcribe error:', message);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

// =============================================================================
// MULTIPART PARSER (lightweight, no external deps)
// =============================================================================

function parseMultipart(body: Buffer, boundary: string): {
  audioBuffer: Buffer | null;
  filename: string | null;
  language: string | null;
} {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let audioBuffer: Buffer | null = null;
  let filename: string | null = null;
  let language: string | null = null;

  const parts = splitBuffer(body, boundaryBuffer);

  for (const part of parts) {
    const partStr = part.toString('utf-8', 0, Math.min(part.length, 500));

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = partStr.substring(0, headerEnd);
    const bodyStart = headerEnd + 4;

    let bodyEnd = part.length;
    if (part[bodyEnd - 2] === 0x0d && part[bodyEnd - 1] === 0x0a) {
      bodyEnd -= 2;
    }

    if (headers.includes('name="audio"') || headers.includes('name="file"')) {
      audioBuffer = part.subarray(bodyStart, bodyEnd);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      filename = filenameMatch ? filenameMatch[1] : null;
    } else if (headers.includes('name="language"')) {
      language = part.subarray(bodyStart, bodyEnd).toString('utf-8').trim();
    }
  }

  return { audioBuffer, filename, language };
}

function splitBuffer(buf: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;

  while (start < buf.length) {
    const idx = buf.indexOf(delimiter, start);
    if (idx === -1) {
      parts.push(buf.subarray(start));
      break;
    }
    if (idx > start) {
      parts.push(buf.subarray(start, idx));
    }
    start = idx + delimiter.length;
  }

  return parts;
}