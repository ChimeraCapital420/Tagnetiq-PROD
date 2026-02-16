// FILE: src/lib/oracle/gamification/index.ts
// Points, badges, streaks, leaderboard
// Mobile-first: all point calculations run server-side, client just renders

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// POINT VALUES
// =============================================================================

export const POINT_ACTIONS = {
  scan_item: 10,
  vault_item: 5,
  oracle_conversation: 3,
  first_scan_of_day: 25,         // Streak bonus
  hunt_mode_buy: 15,
  hunt_mode_skip: 2,             // Still earns something for discipline
  listing_created: 20,
  sale_logged: 50,
  sale_profit_bonus: 1,          // Per dollar of profit
  learning_step_completed: 15,
  learning_path_completed: 100,
  feedback_given: 5,
  community_introduction: 30,
  watchlist_alert_acted_on: 10,
  consecutive_day_streak: 10,    // Per day in streak
  referred_user: 200,
} as const;

export type PointAction = keyof typeof POINT_ACTIONS;

// =============================================================================
// BADGES
// =============================================================================

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'scanning' | 'selling' | 'learning' | 'community' | 'milestone' | 'streak';
  requirement: number;
  requirementType: string;
}

export const BADGES: Badge[] = [
  // Scanning
  { id: 'first_scan', name: 'First Look', description: 'Scan your first item', icon: '🔍', category: 'scanning', requirement: 1, requirementType: 'total_scans' },
  { id: 'scanner_10', name: 'Eagle Eye', description: 'Scan 10 items', icon: '🦅', category: 'scanning', requirement: 10, requirementType: 'total_scans' },
  { id: 'scanner_50', name: 'Treasure Hunter', description: 'Scan 50 items', icon: '🗺️', category: 'scanning', requirement: 50, requirementType: 'total_scans' },
  { id: 'scanner_100', name: 'Master Appraiser', description: 'Scan 100 items', icon: '👁️', category: 'scanning', requirement: 100, requirementType: 'total_scans' },
  { id: 'scanner_500', name: 'The Oracle\'s Eye', description: 'Scan 500 items', icon: '🔮', category: 'scanning', requirement: 500, requirementType: 'total_scans' },
  { id: 'multi_category', name: 'Renaissance Flipper', description: 'Scan items in 5+ categories', icon: '🎨', category: 'scanning', requirement: 5, requirementType: 'unique_categories' },

  // Selling
  { id: 'first_sale', name: 'First Flip', description: 'Log your first sale', icon: '💰', category: 'selling', requirement: 1, requirementType: 'total_sales' },
  { id: 'profit_100', name: 'Triple Digits', description: 'Earn $100 in total profit', icon: '💵', category: 'selling', requirement: 100, requirementType: 'total_profit' },
  { id: 'profit_1000', name: 'Grand Flipper', description: 'Earn $1,000 in total profit', icon: '🤑', category: 'selling', requirement: 1000, requirementType: 'total_profit' },
  { id: 'profit_10000', name: 'Five Figure Club', description: 'Earn $10,000 in total profit', icon: '💎', category: 'selling', requirement: 10000, requirementType: 'total_profit' },
  { id: 'listing_10', name: 'Content Machine', description: 'Create 10 listings with Oracle', icon: '📝', category: 'selling', requirement: 10, requirementType: 'total_listings' },

  // Learning
  { id: 'first_lesson', name: 'Student', description: 'Complete your first learning step', icon: '📖', category: 'learning', requirement: 1, requirementType: 'lessons_completed' },
  { id: 'path_complete', name: 'Graduate', description: 'Complete a full learning path', icon: '🎓', category: 'learning', requirement: 1, requirementType: 'paths_completed' },
  { id: 'lessons_25', name: 'Scholar', description: 'Complete 25 learning steps', icon: '🧠', category: 'learning', requirement: 25, requirementType: 'lessons_completed' },

  // Community
  { id: 'first_intro', name: 'Connector', description: 'Accept your first Oracle introduction', icon: '🤝', category: 'community', requirement: 1, requirementType: 'introductions_accepted' },
  { id: 'feedback_10', name: 'Oracle Trainer', description: 'Give 10 feedback ratings', icon: '⭐', category: 'community', requirement: 10, requirementType: 'feedback_given' },

  // Streaks
  { id: 'streak_3', name: 'Hat Trick', description: '3-day scan streak', icon: '🔥', category: 'streak', requirement: 3, requirementType: 'current_streak' },
  { id: 'streak_7', name: 'On Fire', description: '7-day scan streak', icon: '🔥🔥', category: 'streak', requirement: 7, requirementType: 'current_streak' },
  { id: 'streak_30', name: 'Unstoppable', description: '30-day scan streak', icon: '⚡', category: 'streak', requirement: 30, requirementType: 'current_streak' },

  // Milestones
  { id: 'points_1000', name: 'Rising Star', description: 'Earn 1,000 total points', icon: '⭐', category: 'milestone', requirement: 1000, requirementType: 'total_points' },
  { id: 'points_10000', name: 'Legend', description: 'Earn 10,000 total points', icon: '🏆', category: 'milestone', requirement: 10000, requirementType: 'total_points' },
  { id: 'points_100000', name: 'Oracle Elite', description: 'Earn 100,000 total points', icon: '👑', category: 'milestone', requirement: 100000, requirementType: 'total_points' },
];

// =============================================================================
// LEVEL THRESHOLDS
// =============================================================================

export function getLevelFromPoints(points: number): { level: number; title: string; nextThreshold: number; progress: number } {
  const levels = [
    { threshold: 0, title: 'Newcomer' },
    { threshold: 100, title: 'Scout' },
    { threshold: 500, title: 'Hunter' },
    { threshold: 1500, title: 'Dealer' },
    { threshold: 4000, title: 'Merchant' },
    { threshold: 8000, title: 'Expert' },
    { threshold: 15000, title: 'Master' },
    { threshold: 30000, title: 'Grandmaster' },
    { threshold: 60000, title: 'Legend' },
    { threshold: 100000, title: 'Oracle Elite' },
  ];

  let current = levels[0];
  let next = levels[1];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (points >= levels[i].threshold) {
      current = levels[i];
      next = levels[i + 1] || { threshold: current.threshold * 2, title: 'Beyond' };
      break;
    }
  }

  const levelIndex = levels.indexOf(current);
  const progress = next
    ? Math.min(100, Math.round(((points - current.threshold) / (next.threshold - current.threshold)) * 100))
    : 100;

  return {
    level: levelIndex + 1,
    title: current.title,
    nextThreshold: next?.threshold || current.threshold * 2,
    progress,
  };
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Award points for an action. Returns new total and any badges earned.
 */
export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  action: PointAction,
  metadata?: { profit?: number; category?: string },
): Promise<{ pointsAwarded: number; newTotal: number; newBadges: Badge[] }> {
  let points = POINT_ACTIONS[action];

  // Profit bonus for sales
  if (action === 'sale_logged' && metadata?.profit && metadata.profit > 0) {
    points += Math.floor(metadata.profit * POINT_ACTIONS.sale_profit_bonus);
  }

  // Fetch current stats
  const { data: stats } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!stats) {
    // First interaction — create record
    await supabase.from('user_gamification').insert({
      user_id: userId,
      total_points: points,
      total_scans: action === 'scan_item' ? 1 : 0,
      total_sales: action === 'sale_logged' ? 1 : 0,
      total_profit: metadata?.profit || 0,
      total_listings: action === 'listing_created' ? 1 : 0,
      lessons_completed: action === 'learning_step_completed' ? 1 : 0,
      feedback_given: action === 'feedback_given' ? 1 : 0,
      current_streak: action === 'scan_item' ? 1 : 0,
      longest_streak: action === 'scan_item' ? 1 : 0,
      last_activity_date: new Date().toISOString().split('T')[0],
      badges_earned: [],
      unique_categories: metadata?.category ? [metadata.category] : [],
    });

    return { pointsAwarded: points, newTotal: points, newBadges: [] };
  }

  // Update stats
  const updates: Record<string, any> = {
    total_points: (stats.total_points || 0) + points,
  };

  const today = new Date().toISOString().split('T')[0];
  const lastActivity = stats.last_activity_date;

  // Streak logic
  if (action === 'scan_item') {
    updates.total_scans = (stats.total_scans || 0) + 1;

    if (lastActivity === today) {
      // Same day, no streak change
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastActivity === yesterday) {
        // Consecutive day
        const newStreak = (stats.current_streak || 0) + 1;
        updates.current_streak = newStreak;
        updates.longest_streak = Math.max(newStreak, stats.longest_streak || 0);
        // Streak bonus
        updates.total_points = updates.total_points + (POINT_ACTIONS.consecutive_day_streak * newStreak);
        // First scan of day bonus
        updates.total_points = updates.total_points + POINT_ACTIONS.first_scan_of_day;
      } else {
        // Streak broken
        updates.current_streak = 1;
        updates.total_points = updates.total_points + POINT_ACTIONS.first_scan_of_day;
      }
      updates.last_activity_date = today;
    }

    // Track unique categories
    if (metadata?.category) {
      const cats = new Set(stats.unique_categories || []);
      cats.add(metadata.category);
      updates.unique_categories = Array.from(cats);
    }
  }

  if (action === 'sale_logged') {
    updates.total_sales = (stats.total_sales || 0) + 1;
    updates.total_profit = (stats.total_profit || 0) + (metadata?.profit || 0);
  }
  if (action === 'listing_created') updates.total_listings = (stats.total_listings || 0) + 1;
  if (action === 'learning_step_completed') updates.lessons_completed = (stats.lessons_completed || 0) + 1;
  if (action === 'feedback_given') updates.feedback_given = (stats.feedback_given || 0) + 1;

  await supabase
    .from('user_gamification')
    .update(updates)
    .eq('user_id', userId);

  // Check for new badges
  const mergedStats = { ...stats, ...updates };
  const earnedIds = new Set(stats.badges_earned || []);
  const newBadges: Badge[] = [];

  for (const badge of BADGES) {
    if (earnedIds.has(badge.id)) continue;

    const value = mergedStats[badge.requirementType] ?? 0;
    if (value >= badge.requirement) {
      newBadges.push(badge);
      earnedIds.add(badge.id);
    }
  }

  if (newBadges.length > 0) {
    await supabase
      .from('user_gamification')
      .update({ badges_earned: Array.from(earnedIds) })
      .eq('user_id', userId);
  }

  return {
    pointsAwarded: points,
    newTotal: updates.total_points,
    newBadges,
  };
}

/**
 * Get user's gamification stats
 */
export async function getGamificationStats(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return {
      totalPoints: 0,
      level: getLevelFromPoints(0),
      badges: [],
      streak: { current: 0, longest: 0 },
      stats: {
        totalScans: 0, totalSales: 0, totalProfit: 0,
        totalListings: 0, lessonsCompleted: 0, feedbackGiven: 0,
      },
    };
  }

  const earnedBadgeIds = new Set(data.badges_earned || []);
  const earnedBadges = BADGES.filter(b => earnedBadgeIds.has(b.id));

  return {
    totalPoints: data.total_points || 0,
    level: getLevelFromPoints(data.total_points || 0),
    badges: earnedBadges,
    streak: {
      current: data.current_streak || 0,
      longest: data.longest_streak || 0,
    },
    stats: {
      totalScans: data.total_scans || 0,
      totalSales: data.total_sales || 0,
      totalProfit: data.total_profit || 0,
      totalListings: data.total_listings || 0,
      lessonsCompleted: data.lessons_completed || 0,
      feedbackGiven: data.feedback_given || 0,
    },
  };
}

/**
 * Get leaderboard (top users by points)
 */
export async function getLeaderboard(
  supabase: SupabaseClient,
  limit = 20,
) {
  const { data } = await supabase
    .from('user_gamification')
    .select('user_id, total_points, total_scans, total_sales, current_streak, badges_earned')
    .order('total_points', { ascending: false })
    .limit(limit);

  if (!data) return [];

  // Fetch display names
  const userIds = data.map(d => d.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);

  const nameMap = new Map((profiles || []).map(p => [p.id, p.display_name]));

  return data.map((entry, index) => ({
    rank: index + 1,
    userId: entry.user_id,
    displayName: nameMap.get(entry.user_id) || 'Anonymous',
    totalPoints: entry.total_points,
    level: getLevelFromPoints(entry.total_points),
    totalScans: entry.total_scans,
    totalSales: entry.total_sales,
    currentStreak: entry.current_streak,
    badgeCount: (entry.badges_earned || []).length,
  }));
}
