// FILE: api/oracle/create.ts
// Unified content creation endpoint for Oracle
// Generates listings in user's voice, videos via InVideo, images via DALL-E 3, brag cards
// Tier-gated: listings = Pro+, video/image = Elite
//
// ENV VARS: OPEN_AI_API_KEY, ANTHROPIC_SECRET (matches existing Vercel config)
//
// POST /api/oracle/create
// { mode, itemId?, platform?, tone?, images?, instructions?, style?, videoParams? }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildListingPrompt, buildVideoScriptPrompt, buildBragCardPrompt } from '../../src/lib/oracle/prompt/creator-context.js';
import { getVoiceProfile, buildVoiceProfile } from '../../src/lib/oracle/voice-profile/index.js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Resolve OpenAI key — match existing codebase pattern
const OPENAI_KEY = process.env.OPEN_AI_API_KEY || process.env.OPEN_AI_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_SECRET;

export const config = {
  maxDuration: 60,
};

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
    .select('subscription_tier, role')
    .eq('id', userId)
    .single();

  // Admin and developer roles always get elite access
  const role = data?.role || 'user';
  if (role === 'admin' || role === 'developer') return 'elite';
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

    // Award gamification points (non-blocking)
    awardCreationPoints(user.id, mode).catch(() => {});

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
// GAMIFICATION BRIDGE
// =============================================================================

async function awardCreationPoints(userId: string, mode: string) {
  try {
    const { awardPoints } = await import('../../src/lib/oracle/gamification/index.js');
    if (mode === 'listing' || mode === 'description') {
      await awardPoints(supabaseAdmin, userId, 'listing_created');
    }
  } catch {
    // Non-critical
  }
}

// =============================================================================
// OPENAI HELPER — uses correct env var
// =============================================================================

async function callOpenAI(messages: any[], options: {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
} = {}) {
  if (!OPENAI_KEY) {
    throw new Error('OpenAI API key not configured (OPEN_AI_API_KEY)');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[OpenAI] Error:', response.status, err);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return response.json();
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

  const result = await callOpenAI([
    { role: 'system', content: 'You are an expert marketplace listing writer. Respond ONLY with valid JSON.' },
    { role: 'user', content: prompt },
  ], { jsonMode: true });

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

  const result = await callOpenAI(
    [{ role: 'user', content: prompt }],
    { maxTokens: 500 },
  );

  return res.status(200).json({
    mode: 'description',
    text: result.choices[0].message.content,
    editable: true,
  });
}

// =============================================================================
// VIDEO GENERATION — InVideo MCP
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

  // Step 1: Generate script via OpenAI
  const scriptPrompt = buildVideoScriptPrompt({
    itemName,
    itemCategory: req.body.category,
    estimatedValue: req.body.estimatedValue,
    style: style as any,
    platform: videoPlatform as any,
    voiceProfile,
  });

  const scriptResult = await callOpenAI([
    { role: 'system', content: 'You are a viral video script writer for product showcases. Respond ONLY with valid JSON with fields: hook, scenes[], callToAction, duration, music_suggestion.' },
    { role: 'user', content: scriptPrompt },
  ], { maxTokens: 800, temperature: 0.8, jsonMode: true });

  const script = JSON.parse(scriptResult.choices[0].message.content);

  // Step 2: Send to InVideo for rendering via Anthropic MCP
  const autoGenerate = videoParams?.autoGenerate !== false;

  if (autoGenerate && ANTHROPIC_KEY) {
    try {
      const fullScript = [
        script.hook || '',
        ...(script.scenes || []).map((s: any) => s.narration || s.text || s.description || ''),
        script.callToAction || '',
      ].filter(Boolean).join('\n\n');

      const vibeMap: Record<string, string> = {
        showcase: 'professional',
        unboxing: 'exciting',
        flip_story: 'storytelling',
        market_update: 'educational',
      };

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Generate a ${videoPlatform} video using InVideo with this script:\n\n${fullScript}\n\nTopic: ${itemName} ${style}\nVibe: ${vibeMap[style] || 'professional'}\nTarget audience: resellers and collectors`,
          }],
          mcp_servers: [{
            type: 'url',
            url: 'https://mcp.invideo.io/sse',
            name: 'invideo-mcp',
          }],
        }),
      });

      if (anthropicResponse.ok) {
        const mcpResult = await anthropicResponse.json();

        // Extract video URL from MCP tool results
        const toolResults = (mcpResult.content || [])
          .filter((item: any) => item.type === 'mcp_tool_result')
          .map((item: any) => item.content?.[0]?.text || '')
          .join('\n');

        let videoUrl = null;
        let videoId = null;
        try {
          const parsed = JSON.parse(toolResults);
          videoUrl = parsed.videoUrl || parsed.url || parsed.video_url || null;
          videoId = parsed.videoId || parsed.id || parsed.video_id || null;
        } catch {
          const urlMatch = toolResults.match(/https?:\/\/[^\s"']+(?:invideo|video)[^\s"']*/i);
          if (urlMatch) videoUrl = urlMatch[0];
        }

        const textContent = (mcpResult.content || [])
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        return res.status(200).json({
          mode: 'video',
          script,
          videoUrl,
          videoId,
          videoStatus: videoUrl ? 'ready' : 'processing',
          mcpMessage: textContent || null,
          editable: true,
          message: videoUrl
            ? 'Video generated! Review and share.'
            : 'Video is being rendered. Check back shortly.',
        });
      }

      console.warn('[InVideo MCP] Response not ok:', anthropicResponse.status);
    } catch (err) {
      console.warn('[InVideo MCP] Error (falling back to script):', err);
    }
  }

  // Fallback: return script only
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

  const result = await callOpenAI([
    { role: 'system', content: 'Generate social media brag card data. Respond ONLY with valid JSON.' },
    { role: 'user', content: prompt },
  ], { maxTokens: 300, temperature: 0.8, jsonMode: true });

  const card = JSON.parse(result.choices[0].message.content);

  return res.status(200).json({
    mode: 'brag_card',
    text: JSON.stringify(card),
    editable: true,
    card,
  });
}

// =============================================================================
// IMAGE GENERATION — DALL-E 3
// =============================================================================

async function handleImage(
  req: VercelRequest,
  res: VercelResponse,
  userId: string,
  itemId: string | undefined,
  instructions: string | undefined,
) {
  const itemName = req.body.itemName || 'Item';
  const imageStyle = req.body.imageStyle || 'product_photo';

  const stylePrompts: Record<string, string> = {
    product_photo: `Professional product photography of ${itemName}. Clean white background, studio lighting, high detail, commercial quality. ${instructions || ''}`,
    lifestyle: `Lifestyle product photography of ${itemName} in a natural setting. Warm lighting, aspirational composition. ${instructions || ''}`,
    social_media: `Eye-catching social media image featuring ${itemName}. Bold, vibrant, designed for engagement. Modern aesthetic. ${instructions || ''}`,
    thumbnail: `YouTube/TikTok thumbnail featuring ${itemName}. Bold text-friendly composition, high contrast, exciting energy. ${instructions || ''}`,
    vintage: `Vintage aesthetic product shot of ${itemName}. Film grain, warm tones, collectible presentation. ${instructions || ''}`,
  };

  const imagePrompt = stylePrompts[imageStyle] || stylePrompts.product_photo;

  if (!OPENAI_KEY) {
    return res.status(503).json({ error: 'Image generation not configured', prompt: imagePrompt });
  }

  try {
    const dalleResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: req.body.size || '1024x1024',
        quality: 'standard',
        response_format: 'url',
      }),
    });

    if (!dalleResponse.ok) {
      const err = await dalleResponse.text();
      console.error('[DALL-E] Error:', dalleResponse.status, err);
      return res.status(200).json({
        mode: 'image',
        prompt: imagePrompt,
        imageUrl: null,
        message: 'Image generation temporarily unavailable. Prompt saved.',
        editable: true,
      });
    }

    const dalleResult = await dalleResponse.json();
    const imageUrl = dalleResult.data?.[0]?.url || null;
    const revisedPrompt = dalleResult.data?.[0]?.revised_prompt || null;

    return res.status(200).json({
      mode: 'image',
      imageUrl,
      prompt: imagePrompt,
      revisedPrompt,
      editable: true,
      message: imageUrl ? 'Image generated!' : 'Generation complete but no image returned.',
    });

  } catch (err) {
    console.error('[DALL-E] Exception:', err);
    return res.status(200).json({
      mode: 'image',
      prompt: imagePrompt,
      imageUrl: null,
      message: 'Image generation failed. Prompt saved.',
      editable: true,
    });
  }
}
