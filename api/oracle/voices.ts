// FILE: api/oracle/voices.ts
// Oracle Voice Discovery Endpoint - Lists available premium voices

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY_KEY!
);

// Premium voice catalog with ElevenLabs voice IDs
// REPLACE THESE IDs WITH YOUR ACTUAL ELEVENLABS VOICE IDs
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
    elevenlabs_id: '21m00Tcm4TlvDq8ikWAM' // Rachel voice - REPLACE WITH YOUR CHOSEN VOICE ID
  },
  {
   id: 'oracle-will-en',
   name: 'Will',
   language: 'en',  // Must be just 'en' for English
   gender: 'male',
   accent: 'American',  // Fixed spelling
   description: 'Distinguished and authoritative with refined articulation',
   preview_text: 'Greetings, I am Will. Together, we shall uncover the true value of your assets.',
   tier: 'premium',
   elevenlabs_id: 'bIHbv24MWmeRgasZH58o'
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
    elevenlabs_id: 'EXAVITQu4vr4xnSDxMaL' // Bella voice - REPLACE WITH YOUR CHOSEN VOICE ID
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
    elevenlabs_id: 'MF3mGyEYCl7XYWbV9V6O' // REPLACE WITH YOUR SPANISH VOICE ID
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
    elevenlabs_id: 'TxGEqnHWrfWFTfGW9XjX' // REPLACE WITH YOUR SPANISH VOICE ID
  },
  {
   id: 'oracle-will-es',
   name: 'Will',
   language: 'es',  // Spanish
   gender: 'male',
   accent: 'American',
   description: 'Distinguido y autoritario con articulación refinada',
   preview_text: 'Saludos, soy Will, tu Oráculo Tagnetiq.',
   tier: 'premium',
   elevenlabs_id: 'bIHbv24MWmeRgasZH58o'  // Same voice ID
  },
  // French voices
  {
   id: 'oracle-will-fr',
   name: 'Will',
   language: 'fr',  // French
   gender: 'male',
   accent: 'American',
   description: 'Distingué et autoritaire avec une articulation raffinée',
   preview_text: 'Bonjour, je suis Will, votre Oracle Tagnetiq.',
   tier: 'premium',
   elevenlabs_id: 'bIHbv24MWmeRgasZH58o'  // Same voice ID
  },
  {
    id: 'oracle-amelie-fr',
    name: 'Amélie',
    language: 'fr',
    gender: 'female',
    accent: 'Parisian',
    description: 'Sophistiquée et précise avec une touche d\'élégance',
    preview_text: 'Bonjour, je suis Amélie, votre Oracle Tagnetiq. Laissez-moi analyser cet actif pour vous.',
    tier: 'premium',
    elevenlabs_id: 'VR6AewLTigWG4xSOukaG' // REPLACE WITH YOUR FRENCH VOICE ID
  },
  // Italian voices
  {
   id: 'oracle-will-it',
   name: 'Will',
   language: 'it',  
   gender: 'male',
   accent: 'American',
   description: 'Distinto e autorevole con articolazione raffinata', // Italian translation
   preview_text: 'Saluti, sono Will, il tuo Oracolo Tagnetiq.', // Italian greeting
   tier: 'premium',
   elevenlabs_id: 'bIHbv24MWmeRgasZH58o'
  },
  {
    id: 'oracle-marco-it',
    name: 'Marco',
    language: 'it',
    gender: 'male',
    accent: 'Tuscan',
    description: 'Carismatico e professionale con passione italiana',
    preview_text: 'Ciao, sono Marco, il tuo Oracolo Tagnetiq. Analizziamo insieme questo bene.',
    tier: 'premium',
    elevenlabs_id: 'onwK4e9ZLuTAKqWW03F9' // REPLACE WITH YOUR ITALIAN VOICE ID
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