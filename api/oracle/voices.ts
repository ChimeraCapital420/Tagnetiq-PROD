// FILE: api/oracle/voices.ts
// Oracle Voice Discovery Endpoint - Lists available premium voices

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_SECRET!
);

// Premium voice catalog with ElevenLabs voice IDs
const PREMIUM_VOICES = [
  // English voices
  {
    id: 'oracle-nova-en',
    name: 'Nova',
    language: 'en',
    gender: 'female',
    accent: 'American',
    description: 'Confident and professional with a modern edge',
    preview_text: 'Hello, I am Nova, your Tagnetiq Oracle. Let me analyze this asset for you.',
    tier: 'premium',
    elevenlabs_id: 'EXAVITQu4vr4xnSDxMaL' // Example - replace with actual
  },
  {
    id: 'oracle-atlas-en',
    name: 'Atlas',
    language: 'en',
    gender: 'male',
    accent: 'British',
    description: 'Distinguished and authoritative with refined articulation',
    preview_text: 'Greetings, I am Atlas. Together, we shall uncover the true value of your assets.',
    tier: 'premium',
    elevenlabs_id: 'pNInz6obpgDQGcFmaJgB' // Example - replace with actual
  },
  {
    id: 'oracle-sage-en',
    name: 'Sage',
    language: 'en',
    gender: 'neutral',
    accent: 'International',
    description: 'Wise and calming with perfect clarity',
    preview_text: 'Welcome. I am Sage, here to guide you through your asset evaluation journey.',
    tier: 'ultra',
    elevenlabs_id: 'yoZ06aMxZJJ28mfd3POQ' // Example - replace with actual
  },
  // Spanish voices
  {
    id: 'oracle-luna-es',
    name: 'Luna',
    language: 'es',
    gender: 'female',
    accent: 'Castilian',
    description: 'Elegante y sofisticada con calidez natural',
    preview_text: 'Hola, soy Luna, tu Oráculo de Tagnetiq. Permíteme analizar este activo para ti.',
    tier: 'premium',
    elevenlabs_id: 'MF3mGyEYCl7XYWbV9V6O' // Example - replace with actual
  },
  {
    id: 'oracle-sol-es',
    name: 'Sol',
    language: 'es',
    gender: 'male',
    accent: 'Latin American',
    description: 'Amigable y confiable con energía positiva',
    preview_text: 'Saludos, soy Sol. Juntos descubriremos el verdadero valor de tus activos.',
    tier: 'standard',
    elevenlabs_id: 'TxGEqnHWrfWFTfGW9XjX' // Example - replace with actual
  },
  // French voices
  {
    id: 'oracle-amelie-fr',
    name: 'Amélie',
    language: 'fr',
    gender: 'female',
    accent: 'Parisian',
    description: 'Sophistiquée et précise avec une touche d\'élégance',
    preview_text: 'Bonjour, je suis Amélie, votre Oracle Tagnetiq. Laissez-moi analyser cet actif pour vous.',
    tier: 'premium',
    elevenlabs_id: 'VR6AewLTigWG4xSOukaG' // Example - replace with actual
  },
  // Italian voices
  {
    id: 'oracle-marco-it',
    name: 'Marco',
    language: 'it',
    gender: 'male',
    accent: 'Tuscan',
    description: 'Carismatico e professionale con passione italiana',
    preview_text: 'Ciao, sono Marco, il tuo Oracolo Tagnetiq. Analizziamo insieme questo bene.',
    tier: 'premium',
    elevenlabs_id: 'onwK4e9ZLuTAKqWW03F9' // Example - replace with actual
  }
];

async function verifyAuth(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // In production, you might also fetch voices from ElevenLabs API
    // const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    //   headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! }
    // });
    // const elevenLabsVoices = await response.json();

    // Return simplified voice list
    const voices = PREMIUM_VOICES.map(voice => ({
      id: voice.id,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
      accent: voice.accent,
      description: voice.description,
      tier: voice.tier
    }));

    res.status(200).json({ voices });
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
}