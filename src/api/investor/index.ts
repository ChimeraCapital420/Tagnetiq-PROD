// FILE: src/api/investor/index.ts
// Complete investor API with security, caching, and optimization

import express from 'express';
import { requireAuth, requireInvestor } from '@/middleware/rbac';
import { rateLimit } from 'express-rate-limit';
import NodeCache from 'node-cache';
import { supabase } from '@/lib/supabase-server';

const router = express.Router();
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

// Rate limiting for investor endpoints
const investorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply middleware to all investor routes
router.use(requireAuth);
router.use(requireInvestor);
router.use(investorLimiter);

// GET /api/investor/metrics
router.get('/metrics', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const cacheKey = `investor-metrics-${days}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Parallel queries for better performance
    const [
      userMetrics,
      scanMetrics,
      betaMetrics,
      growthData
    ] = await Promise.all([
      // Total users and DAU
      supabase.rpc('get_user_metrics', { days_ago: days }),
      
      // Scan metrics
      supabase.rpc('get_scan_metrics', { days_ago: days }),
      
      // Beta program metrics
      supabase.rpc('get_beta_metrics'),
      
      // Growth timeline data
      supabase.rpc('get_growth_data', { days_ago: days })
    ]);

    const metrics = {
      totalUsers: userMetrics.data?.total_users || 0,
      dau: userMetrics.data?.dau || 0,
      totalScans: scanMetrics.data?.total_scans || 0,
      feedbackVolume: betaMetrics.data?.feedback_count || 0,
      totalBetaInvites: betaMetrics.data?.total_invites || 0,
      totalBetaTesters: betaMetrics.data?.total_testers || 0,
      betaConversionRate: betaMetrics.data?.conversion_rate || 0,
      growthData: growthData.data || [],
      tam: { total: '$1.3T', serviceable: '$125B', obtainable: '$1B' },
      projections: { q4_2025: '$5M ARR', q1_2026: '$12M ARR' }
    };

    // Cache the results
    cache.set(cacheKey, metrics);
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching investor metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/investor/arena-metrics
router.get('/arena-metrics', async (req, res) => {
  try {
    const cacheKey = 'arena-metrics';
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }

    const { data, error } = await supabase.rpc('get_arena_metrics');
    
    if (error) throw error;

    const metrics = {
      userEngagement: {
        dau: data.daily_active_users || 0,
        mau: data.monthly_active_users || 0
      },
      contentVelocity: {
        newChallengesToday: data.new_challenges_today || 0,
        newListingsToday: data.new_listings_today || 0
      },
      socialInteraction: {
        newConversationsToday: data.new_conversations_today || 0,
        alertsTriggeredToday: data.alerts_triggered_today || 0
      },
      ecosystemHealth: {
        totalActiveChallenges: data.total_active_challenges || 0
      }
    };

    cache.set(cacheKey, metrics);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching arena metrics:', error);
    res.status(500).json({ error: 'Failed to fetch arena metrics' });
  }
});

// GET /api/investor/kpis
router.get('/kpis', async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_core_kpis');
    
    if (error) throw error;
    
    res.json({
      totalUsers: data.total_users || 0,
      dau: data.daily_active_users || 0,
      totalScans: data.total_scans || 0
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// POST /api/investor/invite
router.post('/invite', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Check if already invited
    const { data: existing } = await supabase
      .from('investor_invites')
      .select('id')
      .eq('invitee_email', email)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'This person has already been invited' });
    }

    // Create invite record
    const { data, error } = await supabase
      .from('investor_invites')
      .insert({
        inviter_id: req.user!.id,
        invitee_email: email,
        status: 'sent'
      })
      .select()
      .single();

    if (error) throw error;

    // TODO: Send actual email via email service
    console.log(`Would send investor invite email to ${email}`);

    res.json({ success: true, invite: data });
  } catch (error) {
    console.error('Error sending invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// GET /api/investor/live-feed
router.get('/live-feed', async (req, res) => {
  try {
    // Generate realistic mock event
    const eventTypes = ['USER_SIGNUP', 'ASSET_VAULTED', 'CHALLENGE_COMPLETED', 'HIGH_VALUE_SCAN', 'ARENA_SALE'];
    const locations = ['New York, NY', 'London, UK', 'Tokyo, JP', 'San Francisco, CA', 'Berlin, DE'];
    const assets = ['1952 Mickey Mantle Card', 'Rolex Submariner', 'First Edition Charizard', 'Bitcoin Wallet'];
    const challenges = ['Vintage Watch Authentication', 'Comic Book Grading', 'Sneaker Verification'];
    
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const event: any = {
      type: eventType,
      timestamp: new Date().toISOString()
    };

    switch (eventType) {
      case 'USER_SIGNUP':
        event.location = locations[Math.floor(Math.random() * locations.length)];
        break;
      case 'ASSET_VAULTED':
        event.asset = assets[Math.floor(Math.random() * assets.length)];
        break;
      case 'CHALLENGE_COMPLETED':
        event.challenge = challenges[Math.floor(Math.random() * challenges.length)];
        break;
      case 'HIGH_VALUE_SCAN':
        event.location = locations[Math.floor(Math.random() * locations.length)];
        break;
      case 'ARENA_SALE':
        event.value = `$${Math.floor(Math.random() * 9000 + 1000)}`;
        break;
    }

    res.json(event);
  } catch (error) {
    console.error('Error generating live feed event:', error);
    res.status(500).json({ error: 'Failed to generate event' });
  }
});

export default router;