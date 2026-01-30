// FILE: api/boardroom/transcribe.ts
// Transcription API endpoint - converts audio to text using OpenAI Whisper
// Fallback for browsers without native speech recognition

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
  maxDuration: 30,
};

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Parse the multipart form data
    const { fields, files } = await parseForm(req);
    
    const audioFile = files.audio;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Handle array or single file
    const file = Array.isArray(audioFile) ? audioFile[0] : audioFile;
    
    console.log(`🎤 Transcribing audio: ${file.size} bytes, type: ${file.mimetype}`);

    // Transcribe using OpenAI Whisper
    const transcript = await transcribeWithWhisper(file.filepath, file.mimetype || 'audio/webm');

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    return res.status(200).json({ 
      text: transcript,
      duration_ms: 0, // Could calculate from audio
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: 'Transcription failed' });
  }
}

// ============================================================================
// FORM PARSING
// ============================================================================

function parseForm(req: VercelRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
      allowEmptyFiles: false,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// ============================================================================
// WHISPER TRANSCRIPTION
// ============================================================================

async function transcribeWithWhisper(
  filePath: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Read the file
  const fileBuffer = fs.readFileSync(filePath);
  
  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'audio/m4a': 'm4a',
  };
  const ext = extMap[mimeType] || 'webm';

  // Create form data
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: `audio.${ext}`,
    contentType: mimeType,
  });
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');
  formData.append('response_format', 'json');
  // Optional: Add prompt to improve accuracy
  formData.append('prompt', 'This is a business conversation with an AI executive board. Common terms include: strategy, revenue, growth, market, investment, customers, product, team.');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Whisper API error:', errorText);
    throw new Error(`Whisper API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

// ============================================================================
// ALTERNATIVE: GROQ WHISPER (FASTER)
// ============================================================================

async function transcribeWithGroq(
  filePath: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Fall back to OpenAI
    return transcribeWithWhisper(filePath, mimeType);
  }

  const fileBuffer = fs.readFileSync(filePath);
  
  const extMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
  };
  const ext = extMap[mimeType] || 'webm';

  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: `audio.${ext}`,
    contentType: mimeType,
  });
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'en');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    },
    body: formData as any,
  });

  if (!response.ok) {
    console.error('Groq Whisper error, falling back to OpenAI');
    return transcribeWithWhisper(filePath, mimeType);
  }

  const data = await response.json();
  return data.text || '';
}