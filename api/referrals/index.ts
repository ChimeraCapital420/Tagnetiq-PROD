// FILE: api/referrals/index.ts
// Referral/Affiliate Program API
// Generate referral links, track clicks, attribute sales

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../_lib/security';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

// Referral reward tiers
const REWARD_TIERS = {
  standard: {
    signup_reward: 5,        // $5 credit for referrer when referee signs up
    first_sale_reward: 10,   // $10 credit when referee makes first sale
    commission_rate: 0.02,   // 2% of referee's sales (lifetime, capped)
    commission_cap: 100,     // Max $100 total commission per referee
  },
  premium: {
    signup_reward: 10,
    first_sale_reward: 25,
    commission_rate: 0.03,
    commission_cap: 250,
  },
  ambassador: {
    signup_reward: 25,
    first_sale_reward: 50,
    commission_rate: 0.05,
    commission_cap: 1000,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET: Get referral stats for authenticated user
  if (req.method === 'GET') {
    const user = await verifyUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await getReferralStats(user.id);
    return res.status(200).json(stats);
  }

  // POST: Generate referral link or track referral
  if (req.method === 'POST') {
    const { action } = req.body;

    switch (action) {
      case 'generate_link':
        return handleGenerateLink(req, res);
      case 'track_click':
        return handleTrackClick(req, res);
      case 'track_signup':
        return handleTrackSignup(req, res);
      case 'track_sale':
        return handleTrackSale(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Generate unique referral link
async function handleGenerateLink(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { campaign, listing_id } = req.body;

  // Check for existing referral code
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', user.id)
    .single();

  let code = existing?.code;

  if (!code) {
    // Generate new unique code
    code = generateReferralCode(user.id);

    // Get user's tier (default to standard)
    const tier = await getUserTier(user.id);

    await supabase.from('referral_codes').insert({
      user_id: user.id,
      code,
      tier,
      created_at: new Date().toISOString(),
    });
  }

  // Build referral URL
  let url = `${DOMAIN}/join?ref=${code}`;
  
  if (campaign) {
    url += `&utm_campaign=${encodeURIComponent(campaign)}`;
  }
  
  if (listing_id) {
    url = `${DOMAIN}/marketplace/${listing_id}?ref=${code}`;
  }

  return res.status(200).json({
    code,
    url,
    short_url: `${DOMAIN}/r/${code}`,
    share_text: `Join me on TagnetIQ - the marketplace for collectors! Use my link to sign up: ${url}`,
    social_links: {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Found an amazing marketplace for collectors! Join TagnetIQ with my link:`)}%20${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`Join me on TagnetIQ! ${url}`)}`,
      email: `mailto:?subject=${encodeURIComponent('Check out TagnetIQ!')}&body=${encodeURIComponent(`I've been using TagnetIQ to buy and sell collectibles. Join with my link: ${url}`)}`,
    },
  });
}

// Track referral link click
async function handleTrackClick(req: VercelRequest, res: VercelResponse) {
  const { code, page, user_agent, referrer } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Missing referral code' });
  }

  // Verify code exists
  const { data: refCode } = await supabase
    .from('referral_codes')
    .select('user_id')
    .eq('code', code)
    .single();

  if (!refCode) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  // Log click
  await supabase.from('referral_clicks').insert({
    code,
    referrer_id: refCode.user_id,
    page: page || '/',
    user_agent: user_agent || req.headers['user-agent'],
    referrer_url: referrer,
    ip_hash: hashIP(getClientIP(req)),
    created_at: new Date().toISOString(),
  });

  // Update click count
  await supabase.rpc('increment_referral_clicks', { ref_code: code });

  return res.status(200).json({ success: true });
}

// Track successful signup from referral
async function handleTrackSignup(req: VercelRequest, res: VercelResponse) {
  const { code, new_user_id } = req.body;

  if (!code || !new_user_id) {
    return res.status(400).json({ error: 'Missing code or user_id' });
  }

  // Get referrer info
  const { data: refCode } = await supabase
    .from('referral_codes')
    .select('user_id, tier')
    .eq('code', code)
    .single();

  if (!refCode) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  // Prevent self-referral
  if (refCode.user_id === new_user_id) {
    return res.status(400).json({ error: 'Cannot refer yourself' });
  }

  // Check if already referred
  const { data: existingRef } = await supabase
    .from('referrals')
    .select('id')
    .eq('referee_id', new_user_id)
    .single();

  if (existingRef) {
    return res.status(400).json({ error: 'User already referred' });
  }

  // Create referral record
  const tier = refCode.tier || 'standard';
  const rewards = REWARD_TIERS[tier as keyof typeof REWARD_TIERS];

  await supabase.from('referrals').insert({
    referrer_id: refCode.user_id,
    referee_id: new_user_id,
    code,
    status: 'signed_up',
    tier,
    signup_reward: rewards.signup_reward,
    commission_rate: rewards.commission_rate,
    commission_cap: rewards.commission_cap,
    created_at: new Date().toISOString(),
  });

  // Credit referrer (signup bonus)
  await creditReferrer(refCode.user_id, rewards.signup_reward, 'signup', new_user_id);

  // Update referral count
  await supabase.rpc('increment_referral_signups', { ref_code: code });

  return res.status(200).json({ 
    success: true, 
    reward_credited: rewards.signup_reward,
  });
}

// Track sale by referred user (for commission)
async function handleTrackSale(req: VercelRequest, res: VercelResponse) {
  const { seller_id, sale_amount, listing_id } = req.body;

  if (!seller_id || !sale_amount) {
    return res.status(400).json({ error: 'Missing seller_id or sale_amount' });
  }

  // Check if seller was referred
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referee_id', seller_id)
    .single();

  if (!referral) {
    return res.status(200).json({ success: true, commission: 0, reason: 'not_referred' });
  }

  // Calculate commission
  const commission = Math.min(
    sale_amount * referral.commission_rate,
    referral.commission_cap - (referral.total_commission || 0)
  );

  if (commission <= 0) {
    return res.status(200).json({ 
      success: true, 
      commission: 0, 
      reason: 'commission_cap_reached' 
    });
  }

  // Credit referrer
  await creditReferrer(referral.referrer_id, commission, 'sale', seller_id, listing_id);

  // Update referral totals
  await supabase
    .from('referrals')
    .update({
      total_commission: (referral.total_commission || 0) + commission,
      total_sales: (referral.total_sales || 0) + sale_amount,
      status: referral.status === 'signed_up' ? 'first_sale' : referral.status,
    })
    .eq('id', referral.id);

  // First sale bonus
  if (referral.status === 'signed_up' && referral.first_sale_reward) {
    await creditReferrer(referral.referrer_id, referral.first_sale_reward, 'first_sale', seller_id);
  }

  return res.status(200).json({ 
    success: true, 
    commission,
  });
}

// Get user's referral stats
async function getReferralStats(userId: string) {
  const { data: code } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: referrals } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId);

  const { data: credits } = await supabase
    .from('referral_credits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const totalEarnings = (credits || []).reduce((sum, c) => sum + c.amount, 0);
  const pendingCredits = (credits || []).filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
  const paidCredits = (credits || []).filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);

  const tier = code?.tier || 'standard';
  const rewards = REWARD_TIERS[tier as keyof typeof REWARD_TIERS];

  return {
    code: code?.code,
    tier,
    rewards,
    stats: {
      clicks: code?.click_count || 0,
      signups: referrals?.length || 0,
      active_referrals: referrals?.filter(r => r.status !== 'signed_up').length || 0,
    },
    earnings: {
      total: totalEarnings,
      pending: pendingCredits,
      paid: paidCredits,
    },
    recent_credits: credits || [],
    referrals: (referrals || []).map(r => ({
      status: r.status,
      created_at: r.created_at,
      total_sales: r.total_sales,
      commission_earned: r.total_commission,
    })),
    share_url: code ? `${DOMAIN}/r/${code.code}` : null,
  };
}

// Credit referrer's account
async function creditReferrer(
  userId: string, 
  amount: number, 
  type: 'signup' | 'first_sale' | 'sale',
  sourceUserId: string,
  listingId?: string
) {
  await supabase.from('referral_credits').insert({
    user_id: userId,
    amount,
    type,
    source_user_id: sourceUserId,
    listing_id: listingId,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // Could also add to a balance field on profiles
}

// Generate unique referral code
function generateReferralCode(userId: string): string {
  const hash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex');
  return hash.slice(0, 8).toUpperCase();
}

// Get user's tier based on activity
async function getUserTier(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_verified, total_sales_count')
    .eq('id', userId)
    .single();

  if (!profile) return 'standard';

  // Ambassador: 50+ sales or verified
  if ((profile.total_sales_count || 0) >= 50) return 'ambassador';
  
  // Premium: 10+ sales
  if ((profile.total_sales_count || 0) >= 10) return 'premium';

  return 'standard';
}

// Hash IP for privacy
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.IP_SALT || 'tagnetiq').digest('hex').slice(0, 16);
}

// Get client IP
function getClientIP(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}