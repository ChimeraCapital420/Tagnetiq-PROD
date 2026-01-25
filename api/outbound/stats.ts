// OUTBOUND CLICK STATISTICS v1.0
// Purpose: Retrieve analytics for outbound clicks (for partnership negotiations)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Admin API key for stats access (set in environment)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin access
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!ADMIN_API_KEY || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized - Admin API key required' });
  }

  try {
    const { view, provider, days } = req.query;
    const daysBack = parseInt(days as string) || 30;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startDateStr = startDate.toISOString();

    // Different views available
    switch (view) {
      case 'provider_summary':
        return await getProviderSummary(res, startDateStr);
      
      case 'daily':
        return await getDailyStats(res, startDateStr, provider as string);
      
      case 'top_items':
        return await getTopItems(res, startDateStr, provider as string);
      
      case 'partnership_report':
        return await getPartnershipReport(res, startDateStr, provider as string);
      
      default:
        return await getOverview(res, startDateStr);
    }

  } catch (error: any) {
    console.error('❌ [Outbound Stats] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
}

// ==================== STAT FUNCTIONS ====================

async function getOverview(res: VercelResponse, startDate: string) {
  // Total clicks
  const { count: totalClicks } = await supabase
    .from('outbound_clicks')
    .select('*', { count: 'exact', head: true })
    .gte('clicked_at', startDate);

  // Unique users
  const { data: uniqueUsers } = await supabase
    .from('outbound_clicks')
    .select('user_id')
    .gte('clicked_at', startDate)
    .not('user_id', 'is', null);

  const uniqueUserCount = new Set(uniqueUsers?.map(u => u.user_id)).size;

  // Clicks by provider
  const { data: byProvider } = await supabase
    .from('outbound_clicks')
    .select('provider')
    .gte('clicked_at', startDate);

  const providerCounts: Record<string, number> = {};
  byProvider?.forEach(row => {
    providerCounts[row.provider] = (providerCounts[row.provider] || 0) + 1;
  });

  // Clicks by category
  const { data: byCategory } = await supabase
    .from('outbound_clicks')
    .select('item_category')
    .gte('clicked_at', startDate);

  const categoryCounts: Record<string, number> = {};
  byCategory?.forEach(row => {
    if (row.item_category) {
      categoryCounts[row.item_category] = (categoryCounts[row.item_category] || 0) + 1;
    }
  });

  return res.status(200).json({
    period: {
      start: startDate,
      end: new Date().toISOString()
    },
    summary: {
      total_clicks: totalClicks || 0,
      unique_users: uniqueUserCount,
      providers_used: Object.keys(providerCounts).length
    },
    by_provider: Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([provider, count]) => ({ provider, clicks: count })),
    by_category: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, clicks: count }))
  });
}

async function getProviderSummary(res: VercelResponse, startDate: string) {
  const { data } = await supabase
    .from('outbound_clicks')
    .select('provider, user_id, estimated_value, clicked_at')
    .gte('clicked_at', startDate);

  if (!data || data.length === 0) {
    return res.status(200).json({ providers: [] });
  }

  // Group by provider
  const providerStats: Record<string, {
    clicks: number;
    unique_users: Set<string>;
    total_value: number;
    first_click: string;
    last_click: string;
  }> = {};

  data.forEach(row => {
    if (!providerStats[row.provider]) {
      providerStats[row.provider] = {
        clicks: 0,
        unique_users: new Set(),
        total_value: 0,
        first_click: row.clicked_at,
        last_click: row.clicked_at
      };
    }
    
    const stats = providerStats[row.provider];
    stats.clicks++;
    if (row.user_id) stats.unique_users.add(row.user_id);
    if (row.estimated_value) stats.total_value += row.estimated_value;
    if (row.clicked_at < stats.first_click) stats.first_click = row.clicked_at;
    if (row.clicked_at > stats.last_click) stats.last_click = row.clicked_at;
  });

  const providers = Object.entries(providerStats)
    .map(([provider, stats]) => ({
      provider,
      total_clicks: stats.clicks,
      unique_users: stats.unique_users.size,
      avg_item_value: stats.total_value / stats.clicks || 0,
      total_item_value: stats.total_value,
      first_click: stats.first_click,
      last_click: stats.last_click,
      // Estimated value for negotiations
      estimated_monthly_value: (stats.clicks / 30) * (stats.total_value / stats.clicks || 10)
    }))
    .sort((a, b) => b.total_clicks - a.total_clicks);

  return res.status(200).json({ providers });
}

async function getDailyStats(res: VercelResponse, startDate: string, provider?: string) {
  let query = supabase
    .from('outbound_clicks')
    .select('provider, clicked_at')
    .gte('clicked_at', startDate);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data } = await query;

  if (!data || data.length === 0) {
    return res.status(200).json({ daily: [] });
  }

  // Group by date
  const dailyStats: Record<string, Record<string, number>> = {};

  data.forEach(row => {
    const date = row.clicked_at.split('T')[0];
    if (!dailyStats[date]) dailyStats[date] = {};
    dailyStats[date][row.provider] = (dailyStats[date][row.provider] || 0) + 1;
  });

  const daily = Object.entries(dailyStats)
    .map(([date, providers]) => ({
      date,
      total: Object.values(providers).reduce((a, b) => a + b, 0),
      by_provider: providers
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.status(200).json({ daily });
}

async function getTopItems(res: VercelResponse, startDate: string, provider?: string) {
  let query = supabase
    .from('outbound_clicks')
    .select('item_name, item_category, provider, estimated_value')
    .gte('clicked_at', startDate)
    .not('item_name', 'is', null);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data } = await query;

  if (!data || data.length === 0) {
    return res.status(200).json({ items: [] });
  }

  // Group by item name
  const itemStats: Record<string, {
    clicks: number;
    category: string;
    provider: string;
    total_value: number;
  }> = {};

  data.forEach(row => {
    const key = row.item_name;
    if (!itemStats[key]) {
      itemStats[key] = {
        clicks: 0,
        category: row.item_category || 'unknown',
        provider: row.provider,
        total_value: 0
      };
    }
    itemStats[key].clicks++;
    if (row.estimated_value) itemStats[key].total_value += row.estimated_value;
  });

  const items = Object.entries(itemStats)
    .map(([name, stats]) => ({
      item_name: name,
      clicks: stats.clicks,
      category: stats.category,
      provider: stats.provider,
      avg_value: stats.total_value / stats.clicks || 0
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50);

  return res.status(200).json({ items });
}

async function getPartnershipReport(res: VercelResponse, startDate: string, provider?: string) {
  if (!provider) {
    return res.status(400).json({ error: 'Provider parameter required for partnership report' });
  }

  const { data } = await supabase
    .from('outbound_clicks')
    .select('*')
    .eq('provider', provider)
    .gte('clicked_at', startDate);

  if (!data || data.length === 0) {
    return res.status(200).json({
      provider,
      message: 'No clicks recorded for this provider in the given period'
    });
  }

  // Calculate comprehensive stats
  const uniqueUsers = new Set(data.filter(r => r.user_id).map(r => r.user_id)).size;
  const uniqueAnalyses = new Set(data.filter(r => r.analysis_id).map(r => r.analysis_id)).size;
  const totalValue = data.reduce((sum, r) => sum + (r.estimated_value || 0), 0);
  const avgConfidence = data.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / data.length;

  // Category breakdown
  const categories: Record<string, number> = {};
  data.forEach(r => {
    if (r.item_category) {
      categories[r.item_category] = (categories[r.item_category] || 0) + 1;
    }
  });

  // Country breakdown
  const countries: Record<string, number> = {};
  data.forEach(r => {
    if (r.ip_country) {
      countries[r.ip_country] = (countries[r.ip_country] || 0) + 1;
    }
  });

  return res.status(200).json({
    provider,
    period: {
      start: startDate,
      end: new Date().toISOString(),
      days: Math.ceil((new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    },
    traffic: {
      total_clicks: data.length,
      unique_users: uniqueUsers,
      unique_analyses: uniqueAnalyses,
      clicks_per_day: data.length / 30
    },
    value: {
      total_item_value_referred: totalValue,
      avg_item_value: totalValue / data.length || 0,
      avg_confidence_score: avgConfidence
    },
    demographics: {
      by_category: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => ({ category: cat, clicks: count })),
      by_country: Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([country, count]) => ({ country, clicks: count }))
    },
    partnership_pitch: {
      message: `TagNetIQ has referred ${data.length} qualified users to ${provider} over the past 30 days, representing $${totalValue.toFixed(2)} in potential item value. Our users have an average confidence score of ${(avgConfidence * 100).toFixed(1)}%, indicating high-quality, verified traffic.`,
      suggested_cpm: 5.00,
      suggested_cpc: 0.15,
      estimated_monthly_value: (data.length / 30) * 30 * 0.15
    }
  });
}