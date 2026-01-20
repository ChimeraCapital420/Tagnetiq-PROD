// FILE: api/map/data.ts (COMPLETELY REVISED)

import { supaAdmin } from '../_lib/supaAdmin.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// A simple in-memory cache for geocoded locations to reduce redundant API calls.
const geoCache = new Map<string, { lat: number; lon: number }>();

// Geocoding function using a free, public API.
// In a high-volume production environment, you'd use a paid service with an API key.
const geocodeLocation = async (locationText: string): Promise<{ lat: number; lon: number } | null> => {
  if (geoCache.has(locationText)) {
    return geoCache.get(locationText)!;
  }
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationText)}&format=json&limit=1`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      const location = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      geoCache.set(locationText, location);
      return location;
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Admin auth check would go here
  const { metric } = req.query;

  try {
    let query = supaAdmin.from('profiles').select('id, location_text, created_at').not('location_text', 'is', null);

    const now = new Date();
    if (metric === 'new_signups') {
      const ninetySixHoursAgo = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', ninetySixHoursAgo);
    } else if (metric === 'beta_testers') {
      // Assuming beta testers are identified by being in the 'beta_testers' table
      // This requires a more complex join, so we'll fetch IDs first.
      const { data: testerIds, error: testerIdError } = await supaAdmin.from('beta_testers').select('user_id');
      if (testerIdError) throw testerIdError;
      const ids = testerIds.map(t => t.user_id);
      query = query.in('id', ids);
    }
    
    const { data: profiles, error } = await query;
    if (error) throw error;
    
    const geocodingPromises = profiles.map(p => geocodeLocation(p.location_text));
    const locations = await Promise.all(geocodingPromises);

    // Filter out null results and format for the heatmap layer: [lat, lon, intensity]
    const geoData = locations
      .filter(loc => loc !== null)
      .map(loc => [loc!.lat, loc!.lon, 1]); // Intensity is set to 1 for each user

    return res.status(200).json(geoData);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Error fetching map data:', message);
    return res.status(500).json({ error: message });
  }
}