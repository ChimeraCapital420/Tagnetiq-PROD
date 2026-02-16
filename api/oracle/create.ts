// FILE: api/oracle/create.ts
// Unified content creation endpoint for Oracle
// Generates listings in user's voice, videos via InVideo, images, brag cards
// Tier-gated: listings = Pro+, video/image = Elite
//
// POST /api/oracle/create
// { mode, itemId?, platform?, tone?, images?, instructions?, style?, videoParams? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildListingPrompt, buildVideoScriptPrompt, buildBragCardPrompt } from '../../src/lib/oracle/prompt/creator-context.js';
import { getVoiceProfile, buildVoiceProfile } from '../../src/lib/oracle/voice-profile/index.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// =============================================================================
// AUTH HELPER
// =============================================================================

async function verifyUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return user;
}

// =============================================================================
// TIER CHECK
// =============================================================================

async function getUserTier(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  return data?.subscription_tier || 'free';
}

const TIER_ACCESS: Record<string, string[]> = {
  free: [],
  starter: ['description'],
  pro: ['listing', 'description', 'brag_card'],
  elite: ['listing', 'description', 'brag_card', 'image', 'video'],
};

// =============================================================================
// HANDLER
// =============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await verifyUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const tier = await getUserTier(user.id);
    const {
      mode,
      itemId,
      platform = 'ebay',
      instructions,
      style = 'showcase',
      videoParams,
    } = req.body;

    // Tier check
    const allowedModes = TIER_ACCESS[tier] || [];
    if (!allowedModes.includes(mode)) {
      return res.status(403).json({
        error: 'Upgrade required',
        message: `${mode} creation requires ${mode === 'video' || mode === 'image' ? 'Elite' : 'Pro'} tier`,
        requiredTier: mode === 'video' || mode === 'image' ? 'elite' : 'pro',
      });
    }

    // Get or build voice profile
    let voiceProfile = await getVoiceProfile(user.id);
    if (!voiceProfile) {
      // Try to build from recent conversations
      const { data: recentConvos } = await supabaseAdmin
        .from('oracle_conversations')
        .select('messages')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recentConvos?.length) {
        const allMessages = recentConvos.flatMap(c => c.messages || []);
        voiceProfile = await buildVoiceProfile(user.id, allMessages);
      }
    }

    // Route to appropriate handler
    switch (mode) {
      case 'listing':
        return await handleListing(req, res, user.id, platform, itemId, instructions, voiceProfile);

      case 'description':
        return await handleDescription(req, res, user.id, platform, itemId, instructions, voiceProfile);

      case 'video':
        return await handleVideo(req, res, user.id, itemId, style, videoParams, voiceProfile);

      case 'brag_card':
        return await handleBragCard(req, res, user.id, itemId);

      case 'image':
        return await handleImage(req, res, user.id, itemId, instructions);

      default:
        return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }

  } catch (err: any) {
    console.error('[Oracle/Create] Error:', err);
    return res.status(500).json({ error: 'Content creation failed' });
  }
}

// =============================================================================
// LISTING GENERATION
// =============================================================================

async function handleListing(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  platform: string,
  itemId: string | undefined,
  instructions: string | undefined,
  voiceProfile: any,
) {
  // Pull item data from vault if itemId provided
  let itemData: any = {};
  if (itemId) {
    const { data } = await supabaseAdmin
      .from('vault_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single();

    if (data) {
      itemData = {
        name: data.name || data.title,
        category: data.category,
        condition: data.condition,
        estimatedValue: data.estimated_value ? {
          low: data.estimated_value * 0.8,
          high: data.estimated_value * 1.2,
        } : undefined,
      };
    }
  }

  // Use item name from request body if not from vault
  const itemName = itemData.name || req.body.itemName || 'Item';

  const prompt = buildListingPrompt({
    voiceProfile,
    platform,
    itemName,
    itemCategory: itemData.category || req.body.category,
    condition: itemData.condition || req.body.condition,
    estimatedValue: itemData.estimatedValue || req.body.estimatedValue,
    userInstructions: instructions,
    images: req.body.imageCount,
  });

  // Generate listing via OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert marketplace listing writer. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return res.status(500).json({ error: 'Listing generation failed' });
  }

  const result = await response.json();
  const listing = JSON.parse(result.choices[0].message.content);

  return res.status(200).json({
    mode: 'listing',
    listing: {
      ...listing,
      platform,
      voiceMatched: voiceProfile !== null && voiceProfile.messageCount >= 10,
    },
    editable: true,
  });
}

// =============================================================================
// DESCRIPTION ONLY (lighter weight)
// =============================================================================

async function handleDescription(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  platform: string,
  itemId: string | undefined,
  instructions: string | undefined,
  voiceProfile: any,
) {
  const itemName = req.body.itemName || 'Item';

  const prompt = `Write a ${platform} listing description for: ${itemName}
${instructions ? `Instructions: ${instructions}` : ''}
${voiceProfile?.messageCount >= 10 ? `Voice style: ${voiceProfile.vocabularyLevel}, ${voiceProfile.toneMarkers?.join(', ') || 'neutral'}` : ''}
Keep it concise, honest, and optimized for the platform. Return as plain text, no JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    return res.status(500).json({ error: 'Description generation failed' });
  }

  const result = await response.json();

  return res.status(200).json({
    mode: 'description',
    text: result.choices[0].message.content,
    editable: true,
  });
}

// =============================================================================
// VIDEO GENERATION (InVideo MCP)
// =============================================================================

async function handleVideo(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  itemId: string | undefined,
  style: string,
  videoParams: any,
  voiceProfile: any,
) {
  const itemName = req.body.itemName || 'Item';
  const videoPlatform = videoParams?.platform || 'tiktok';

  // Generate script first
  const scriptPrompt = buildVideoScriptPrompt({
    itemName,
    itemCategory: req.body.category,
    estimatedValue: req.body.estimatedValue,
    style: style as any,
    platform: videoPlatform as any,
    voiceProfile,
  });

  const scriptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a viral video script writer for product showcases. Respond ONLY with valid JSON.' },
        { role: 'user', content: scriptPrompt },
      ],
      max_tokens: 800,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  if (!scriptResponse.ok) {
    return res.status(500).json({ error: 'Script generation failed' });
  }

  const scriptResult = await scriptResponse.json();
  const script = JSON.parse(scriptResult.choices[0].message.content);

  // Return script for now — InVideo generation can be triggered separately
  // This keeps the initial response fast and the video generates async
  return res.status(200).json({
    mode: 'video',
    script,
    videoStatus: 'script_ready',
    editable: true,
    message: 'Script generated. Approve to start video generation.',
  });
}

// =============================================================================
// BRAG CARD
// =============================================================================

async function handleBragCard(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  itemId: string | undefined,
) {
  const { itemName, buyPrice, sellPrice, sourceStory } = req.body;

  if (!buyPrice || !sellPrice) {
    return res.status(400).json({ error: 'buyPrice and sellPrice required for brag cards' });
  }

  const profit = sellPrice - buyPrice;
  const roi = Math.round((profit / buyPrice) * 100);

  const prompt = buildBragCardPrompt({
    itemName: itemName || 'Mystery Flip',
    buyPrice,
    sellPrice,
    profit,
    roi,
    sourceStory,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Generate social media brag card data. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    return res.status(500).json({ error: 'Brag card generation failed' });
  }

  const result = await response.json();
  const card = JSON.parse(result.choices[0].message.content);

  return res.status(200).json({
    mode: 'brag_card',
    text: JSON.stringify(card),
    editable: true,
    card,
  });
}

// =============================================================================
// IMAGE GENERATION
// =============================================================================

async function handleImage(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  itemId: string | undefined,
  instructions: string | undefined,
) {
  // Placeholder — can integrate with DALL-E, Flux, or other image gen
  // For now, return a structured prompt that could be used client-side
  const itemName = req.body.itemName || 'Item';

  const imagePrompt = `Professional product photo: ${itemName}. ${instructions || 'Clean white background, studio lighting, high detail.'}`;

  return res.status(200).json({
    mode: 'image',
    prompt: imagePrompt,
    imageUrl: null,
    message: 'Image generation coming soon. Prompt generated for manual use.',
    editable: true,
  });
}
