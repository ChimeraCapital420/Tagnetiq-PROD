// FILE: api/oracle/voices.ts
// Oracle Voice Discovery — fetches from ElevenLabs API + curated picks
// GET /api/oracle/voices?lang=en&gender=female&search=nova
// Tier gating: free/starter=none, pro=curated, elite=curated+ElevenLabs library

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// CURATED ORACLE VOICES (Pro+)
// =============================================================================

const CURATED_VOICES = [
  // ── English ─────────────────────────────────────────────
  {
    id: 'oracle-nova-en',
    elevenlabs_id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Nova',
    language: 'en',
    gender: 'female' as const,
    accent: 'American',
    description: 'Confident and professional with a modern edge',
    preview_text: 'Hey, I think I found something worth looking at in your vault.',
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-will-en',
    elevenlabs_id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    language: 'en',
    gender: 'male' as const,
    accent: 'American',
    description: 'Distinguished and authoritative with refined articulation',
    preview_text: 'Let me break down what I see here — this is interesting.',
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-sage-en',
    elevenlabs_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sage',
    language: 'en',
    gender: 'neutral' as const,
    accent: 'International',
    description: 'Wise and calming with perfect clarity',
    preview_text: 'Welcome back. I have been thinking about something you said last time.',
    tier: 'pro',
    curated: true,
  },
  // ── Spanish ─────────────────────────────────────────────
  {
    id: 'oracle-luna-es',
    elevenlabs_id: 'MF3mGyEYCl7XYWbV9V6O',
    name: 'Luna',
    language: 'es',
    gender: 'female' as const,
    accent: 'Castilian',
    description: 'Elegante y sofisticada con calidez natural',
    preview_text: 'Oye, creo que encontré algo interesante en tu bóveda.',
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-sol-es',
    elevenlabs_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Sol',
    language: 'es',
    gender: 'male' as const,
    accent: 'Latin American',
    description: 'Amigable y confiable con energía positiva',
    preview_text: 'Saludos. Déjame analizar lo que tienes aquí.',
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-will-es',
    elevenlabs_id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    language: 'es',
    gender: 'male' as const,
    accent: 'American',
    description: 'Distinguido y autoritario con articulación refinada',
    preview_text: 'Hola. Vamos a ver qué tenemos aquí.',
    tier: 'pro',
    curated: true,
  },
  // ── French ──────────────────────────────────────────────
  {
    id: 'oracle-amelie-fr',
    elevenlabs_id: 'VR6AewLTigWG4xSOukaG',
    name: 'Amélie',
    language: 'fr',
    gender: 'female' as const,
    accent: 'Parisian',
    description: "Sophistiquée et précise avec une touche d'élégance",
    preview_text: "Bonjour. Je pense avoir trouvé quelque chose d'intéressant.",
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-will-fr',
    elevenlabs_id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    language: 'fr',
    gender: 'male' as const,
    accent: 'American',
    description: 'Distingué et autoritaire avec une articulation raffinée',
    preview_text: 'Bonjour. Regardons ce que nous avons ici.',
    tier: 'pro',
    curated: true,
  },
  // ── Italian ─────────────────────────────────────────────
  {
    id: 'oracle-marco-it',
    elevenlabs_id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Marco',
    language: 'it',
    gender: 'male' as const,
    accent: 'Tuscan',
    description: 'Carismatico e professionale con passione italiana',
    preview_text: 'Ciao. Analizziamo insieme quello che hai trovato.',
    tier: 'pro',
    curated: true,
  },
  {
    id: 'oracle-will-it',
    elevenlabs_id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    language: 'it',
    gender: 'male' as const,
    accent: 'American',
    description: 'Distinto e autorevole con articolazione raffinata',
    preview_text: 'Saluti. Vediamo cosa abbiamo qui.',
    tier: 'pro',
    curated: true,
  },
];

// =============================================================================
// ELEVENLABS API CACHE (1 hour)
// =============================================================================

let elevenLabsCache: { voices: any[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function fetchElevenLabsVoices(): Promise<any[]> {
  if (elevenLabsCache && Date.now() - elevenLabsCache.fetchedAt < CACHE_TTL_MS) {
    return elevenLabsCache.voices;
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return [];
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[Voices] ElevenLabs error:', response.status);
      return elevenLabsCache?.voices || [];
    }

    const data = await response.json();
    const voices = (data.voices || []).map((v: any) => ({
      id: `el-${v.voice_id}`,
      elevenlabs_id: v.voice_id,
      name: v.name,
      language: detectLanguage(v),
      gender: detectGender(v),
      accent: v.labels?.accent || null,
      description: buildDescription(v),
      preview_url: v.preview_url || null,
      tier: 'elite',
      curated: false,
      category: v.category || 'premade',
    }));

    elevenLabsCache = { voices, fetchedAt: Date.now() };
    return voices;
  } catch (err) {
    console.error('[Voices] Fetch failed:', err);
    return elevenLabsCache?.voices || [];
  }
}

function detectLanguage(voice: any): string {
  const lang = (voice.labels?.language || '').toLowerCase();
  const map: Record<string, string> = {
    english: 'en', spanish: 'es', french: 'fr', italian: 'it',
    german: 'de', portuguese: 'pt', dutch: 'nl', polish: 'pl',
    russian: 'ru', japanese: 'ja', korean: 'ko', chinese: 'zh',
    arabic: 'ar', hindi: 'hi', turkish: 'tr', swedish: 'sv',
    norwegian: 'no', danish: 'da', finnish: 'fi', czech: 'cs',
    romanian: 'ro', hungarian: 'hu', greek: 'el', hebrew: 'he',
    thai: 'th', vietnamese: 'vi', indonesian: 'id', ukrainian: 'uk',
    tagalog: 'tl', filipino: 'tl', malay: 'ms',
  };
  for (const [name, code] of Object.entries(map)) {
    if (lang.includes(name)) return code;
  }
  return 'multi';
}

function detectGender(voice: any): 'male' | 'female' | 'neutral' {
  const g = (voice.labels?.gender || '').toLowerCase();
  if (g.includes('female') || g.includes('woman')) return 'female';
  if (g.includes('male') || g.includes('man')) return 'male';
  return 'neutral';
}

function buildDescription(voice: any): string {
  const labels = voice.labels || {};
  const parts: string[] = [];
  if (labels.use_case) parts.push(labels.use_case);
  if (labels.descriptive) parts.push(labels.descriptive);
  if (labels.age) parts.push(labels.age);
  return parts.length > 0 ? parts.join(' — ') : voice.description || 'ElevenLabs voice';
}

// =============================================================================
// AUTH + TIER
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single();
  return { user, tier: profile?.subscription_tier || 'free' };
}

// =============================================================================
// LANGUAGE DISPLAY NAMES
// =============================================================================

const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Español', fr: 'Français', it: 'Italiano',
  de: 'Deutsch', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
  ru: 'Русский', ja: '日本語', ko: '한국어', zh: '中文',
  ar: 'العربية', hi: 'हिन्दी', tr: 'Türkçe', sv: 'Svenska',
  multi: 'Multilingual',
};

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await verifyUser(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  const { tier } = auth;
  const langFilter = (req.query.lang as string) || null;
  const genderFilter = (req.query.gender as string) || null;
  const search = (req.query.search as string) || null;

  try {
    // Tier gate: free/starter get nothing
    if (tier === 'free' || tier === 'starter') {
      return res.status(200).json({
        voices: [],
        tier,
        message: 'Upgrade to Pro for premium Oracle voices',
        languages: [],
        total: 0,
      });
    }

    // Pro: curated only
    let allVoices: any[] = CURATED_VOICES.map(v => ({
      id: v.id,
      name: v.name,
      language: v.language,
      gender: v.gender,
      accent: v.accent,
      description: v.description,
      preview_text: v.preview_text,
      tier: v.tier,
      curated: v.curated,
    }));

    // Elite: add full ElevenLabs library
    if (tier === 'elite') {
      const elVoices = await fetchElevenLabsVoices();
      const curatedElevenIds = new Set(CURATED_VOICES.map(v => v.elevenlabs_id));
      const unique = elVoices.filter(v => !curatedElevenIds.has(v.elevenlabs_id));

      allVoices = [...allVoices, ...unique.map(v => ({
        id: v.id,
        name: v.name,
        language: v.language,
        gender: v.gender,
        accent: v.accent,
        description: v.description,
        preview_url: v.preview_url,
        tier: 'elite',
        curated: false,
        category: v.category,
      }))];
    }

    // Filters
    if (langFilter && langFilter !== 'all') {
      allVoices = allVoices.filter(v => v.language === langFilter || v.language === 'multi');
    }
    if (genderFilter && genderFilter !== 'all') {
      allVoices = allVoices.filter(v => v.gender === genderFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      allVoices = allVoices.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.accent || '').toLowerCase().includes(q) ||
        (v.description || '').toLowerCase().includes(q)
      );
    }

    // Sort: curated first, then alpha
    allVoices.sort((a: any, b: any) => {
      if (a.curated && !b.curated) return -1;
      if (!a.curated && b.curated) return 1;
      return a.name.localeCompare(b.name);
    });

    // Available languages with display names
    const langCodes = [...new Set(allVoices.map(v => v.language))].sort();
    const languages = langCodes.map(code => ({
      code,
      name: LANG_NAMES[code] || code,
      count: allVoices.filter(v => v.language === code).length,
    }));

    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(200).json({
      voices: allVoices,
      tier,
      languages,
      total: allVoices.length,
    });
  } catch (error) {
    console.error('[Voices] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch voices' });
  }
}
