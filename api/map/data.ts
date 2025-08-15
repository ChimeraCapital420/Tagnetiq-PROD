// FILE: api/map/data.ts (CREATED NEW FILE)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// A simple in-memory cache to avoid repeated lookups during a session
const locationCache = new Map<string, { lat: number; lon: number }>();

// A mock geolocation function. In production, this would use a service like MaxMind.
const geolocateIp = (ip: string) => {
  if (locationCache.has(ip)) {
    return locationCache.get(ip);
  }
  // Simulate random locations across the globe for demo purposes
  const lat = Math.random() * 170 - 85;
  const lon = Math.random() * 360 - 180;
  const location = { lat, lon };
  locationCache.set(ip, location);
  return location;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // TODO: Add robust admin auth check here.
  const { metric } = req.query;

  try {
    let users = [];
    const now = new Date();

    switch (metric) {
      case 'new_signups':
        // Fetches users created in the last 96 hours
        const ninetySixHoursAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
        const { data: newUsers, error: newUsersError } = await supaAdmin
            .from('users')
            .select('id, email, last_sign_in_at, raw_user_meta_data')
            .gte('created_at', ninetySixHoursAgo);
        if (newUsersError) throw newUsersError;
        users = newUsers;
        break;

      case 'beta_testers':
        // Fetches users who are in the beta testers table
        const { data: betaUsers, error: betaUsersError } = await supaAdmin
            .from('beta_testers')
            .select('users (id, email, last_sign_in_at, raw_user_meta_data)');
        if (betaUsersError) throw betaUsersError;
        users = betaUsers.map((bt: any) => bt.users);
        break;
      
      case 'total_users':
      default:
        // Fetches all users by default
        const { data: allUsers, error: allUsersError } = await supaAdmin
            .from('users')
            .select('id, email, last_sign_in_at, raw_user_meta_data');
        if (allUsersError) throw allUsersError;
        users = allUsers;
        break;
    }

    // Map users to geo-data points
    const geoData = users.map(user => {
        // We will simulate an IP for geolocation purposes
        const mockIp = `8.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const location = geolocateIp(mockIp);
        return {
            id: user.id,
            email: user.email,
            last_sign_in_at: user.last_sign_in_at,
            lat: location?.lat,
            lon: location?.lon
        };
    }).filter(u => u.lat && u.lon); // Ensure we only return users with a location

    return res.status(200).json(geoData);

  } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      console.error('Error fetching map data:', message);
      return res.status(500).json({ error: message });
  }
}