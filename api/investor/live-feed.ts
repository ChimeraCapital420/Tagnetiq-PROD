// FILE: api/investor/live-feed.ts (CREATE THIS NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper to format time since an event occurred
const timeSince = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return Math.floor(seconds) + "s ago";
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
        { data: users, error: userError },
        { data: scans, error: scanError },
        { data: feedbacks, error: feedbackError }
    ] = await Promise.all([
        supaAdmin.from('users').select('id, created_at, raw_user_meta_data').gte('created_at', twentyFourHoursAgo),
        supaAdmin.from('scan_history').select('id, created_at, category').gte('created_at', twentyFourHoursAgo),
        supaAdmin.from('feedback').select('id, created_at').gte('created_at', twentyFourHoursAgo)
    ]);

    if (userError) throw userError;
    if (scanError) throw scanError;
    if (feedbackError) throw feedbackError;

    const userEvents = (users || []).map(u => ({
        type: 'signup',
        description: `New user signed up`,
        timestamp: new Date(u.created_at),
    }));

    const scanEvents = (scans || []).map(s => ({
        type: 'scan',
        description: `New scan in '${s.category || 'General'}'`,
        timestamp: new Date(s.created_at),
    }));

    const feedbackEvents = (feedbacks || []).map(f => ({
        type: 'feedback',
        description: `New feedback submitted`,
        timestamp: new Date(f.created_at),
    }));

    const allEvents = [...userEvents, ...scanEvents, ...feedbackEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20) // Limit to the 20 most recent events
        .map(e => ({ ...e, timeAgo: timeSince(e.timestamp) }));

    return res.status(200).json(allEvents);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching live feed data:', message);
    return res.status(500).json({ error: message });
  }
}