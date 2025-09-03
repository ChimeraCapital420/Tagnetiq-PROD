// FILE: src/api/arena/index.ts
// Arena API with performance optimization and atomic transactions

import express from 'express';
import { requireAuth, AuthenticatedRequest } from '@/middleware/rbac';
import { supabase } from '@/lib/supabase-server';
import { z } from 'zod';
import NodeCache from 'node-cache';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 60 }); // 1 minute cache for listings

// Rate limiting
const arenaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || req.ip
});

// Apply middleware
router.use(requireAuth);
router.use(arenaLimiter);

// Validation schemas
const createChallengeSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(1000),
  category: z.string(),
  wager_amount: z.number().min(1).max(10000),
  time_limit: z.number().min(1).max(168), // hours
  max_participants: z.number().min(2).max(100),
  rules: z.array(z.string()).optional()
});

const createListingSchema = z.object({
  vault_item_id: z.string().uuid(),
  title: z.string().min(5).max(100),
  description: z.string().min(20).max(2000),
  price: z.number().min(0.01),
  condition: z.enum(['mint', 'near-mint', 'excellent', 'good', 'fair', 'poor']),
  images: z.array(z.string().url()).min(1).max(10),
  shipping_included: z.boolean(),
  accepts_trades: z.boolean()
});

// GET /api/arena/marketplace
router.get('/marketplace', async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 24, 100);
    const category = req.query.category as string;
    const sort = req.query.sort as string || 'newest';
    const search = req.query.search as string;
    
    const cacheKey = `marketplace:${page}:${limit}:${category}:${sort}:${search}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const offset = (page - 1) * limit;

    let query = supabase
      .from('arena_listings')
      .select(`
        *,
        seller:profiles!seller_id(id, email, avatar_url),
        vault_item:vault_items(name, category, images)
      `, { count: 'exact' })
      .eq('status', 'active')
      .is('deleted_at', null);

    if (category) {
      query = query.eq('vault_item.category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    switch (sort) {
      case 'price-low':
        query = query.order('price', { ascending: true });
        break;
      case 'price-high':
        query = query.order('price', { ascending: false });
        break;
      case 'ending-soon':
        query = query.order('expires_at', { ascending: true });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    const response = {
      listings: data,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    };

    cache.set(cacheKey, response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// POST /api/arena/challenges - Atomic challenge creation
router.post('/challenges', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createChallengeSchema.parse(req.body);
    
    // Use database transaction for atomic operations
    const { data: challenge, error } = await supabase.rpc('create_arena_challenge', {
      p_creator_id: req.user!.id,
      p_title: validatedData.title,
      p_description: validatedData.description,
      p_category: validatedData.category,
      p_wager_amount: validatedData.wager_amount,
      p_time_limit: validatedData.time_limit,
      p_max_participants: validatedData.max_participants,
      p_rules: validatedData.rules || []
    });

    if (error) throw error;

    // Clear relevant caches
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.includes('challenges')) {
        cache.del(key);
      }
    });

    res.status(201).json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid challenge data', details: error.errors });
    }
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// POST /api/arena/listings - Atomic listing creation
router.post('/listings', async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createListingSchema.parse(req.body);
    
    // Verify ownership of vault item
    const { data: vaultItem } = await supabase
      .from('vault_items')
      .select('user_id')
      .eq('id', validatedData.vault_item_id)
      .single();

    if (!vaultItem || vaultItem.user_id !== req.user!.id) {
      return res.status(403).json({ error: 'You do not own this vault item' });
    }

    // Create listing atomically
    const { data: listing, error } = await supabase.rpc('create_arena_listing', {
      p_seller_id: req.user!.id,
      p_vault_item_id: validatedData.vault_item_id,
      p_title: validatedData.title,
      p_description: validatedData.description,
      p_price: validatedData.price,
      p_condition: validatedData.condition,
      p_images: validatedData.images,
      p_shipping_included: validatedData.shipping_included,
      p_accepts_trades: validatedData.accepts_trades
    });

    if (error) throw error;

    // Clear marketplace cache
    cache.flushAll();

    res.status(201).json(listing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid listing data', details: error.errors });
    }
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// GET /api/arena/messages - Optimized with pagination
router.get('/messages', async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const { data: conversations, error, count } = await supabase
      .from('arena_conversations')
      .select(`
        *,
        participant1:profiles!participant1_id(id, email, avatar_url),
        participant2:profiles!participant2_id(id, email, avatar_url),
        last_message:arena_messages(content, created_at)
      `, { count: 'exact' })
      .or(`participant1_id.eq.${req.user!.id},participant2_id.eq.${req.user!.id}`)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      conversations,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/arena/messages/:conversationId
router.post('/messages/:conversationId', async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user is part of conversation
    const { data: conversation } = await supabase
      .from('arena_conversations')
      .select('participant1_id, participant2_id')
      .eq('id', conversationId)
      .single();

    if (!conversation || 
        (conversation.participant1_id !== req.user!.id && 
         conversation.participant2_id !== req.user!.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Send message atomically
    const { data: message, error } = await supabase.rpc('send_arena_message', {
      p_conversation_id: conversationId,
      p_sender_id: req.user!.id,
      p_content: content.trim()
    });

    if (error) throw error;

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/arena/alerts
router.get('/alerts', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: alerts, error } = await supabase
      .from('arena_alerts')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// PUT /api/arena/alerts/:id/read
router.put('/alerts/:id/read', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('arena_alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', req.user!.id);

    if (error) throw error;

    res.status(204).send();
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// GET /api/arena/leaderboard
router.get('/leaderboard', async (req: AuthenticatedRequest, res) => {
  try {
    const timeframe = req.query.timeframe as string || 'all-time';
    const category = req.query.category as string;
    
    const cacheKey = `leaderboard:${timeframe}:${category}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const { data: leaderboard, error } = await supabase.rpc('get_arena_leaderboard', {
      p_timeframe: timeframe,
      p_category: category
    });

    if (error) throw error;

    const response = {
      leaderboard: leaderboard || [],
      timeframe,
      category,
      updated_at: new Date().toISOString()
    };

    cache.set(cacheKey, response, 300); // Cache for 5 minutes
    res.json(response);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;