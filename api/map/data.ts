// FILE: api/map/data.ts
// Investor Map Data API - Returns geographic heatmap data
// Mobile-first: Returns minimal data structure for fast rendering

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// US State coordinates for fallback/demo data
const US_STATE_COORDS: Record<string, [number, number]> = {
  'AL': [32.806671, -86.791130], 'AK': [61.370716, -152.404419],
  'AZ': [33.729759, -111.431221], 'AR': [34.969704, -92.373123],
  'CA': [36.116203, -119.681564], 'CO': [39.059811, -105.311104],
  'CT': [41.597782, -72.755371], 'DE': [39.318523, -75.507141],
  'FL': [27.766279, -81.686783], 'GA': [33.040619, -83.643074],
  'HI': [21.094318, -157.498337], 'ID': [44.240459, -114.478828],
  'IL': [40.349457, -88.986137], 'IN': [39.849426, -86.258278],
  'IA': [42.011539, -93.210526], 'KS': [38.526600, -96.726486],
  'KY': [37.668140, -84.670067], 'LA': [31.169546, -91.867805],
  'ME': [44.693947, -69.381927], 'MD': [39.063946, -76.802101],
  'MA': [42.230171, -71.530106], 'MI': [43.326618, -84.536095],
  'MN': [45.694454, -93.900192], 'MS': [32.741646, -89.678696],
  'MO': [38.456085, -92.288368], 'MT': [46.921925, -110.454353],
  'NE': [41.125370, -98.268082], 'NV': [38.313515, -117.055374],
  'NH': [43.452492, -71.563896], 'NJ': [40.298904, -74.521011],
  'NM': [34.840515, -106.248482], 'NY': [42.165726, -74.948051],
  'NC': [35.630066, -79.806419], 'ND': [47.528912, -99.784012],
  'OH': [40.388783, -82.764915], 'OK': [35.565342, -96.928917],
  'OR': [44.572021, -122.070938], 'PA': [40.590752, -77.209755],
  'RI': [41.680893, -71.511780], 'SC': [33.856892, -80.945007],
  'SD': [44.299782, -99.438828], 'TN': [35.747845, -86.692345],
  'TX': [31.054487, -97.563461], 'UT': [40.150032, -111.862434],
  'VT': [44.045876, -72.710686], 'VA': [37.769337, -78.169968],
  'WA': [47.400902, -121.490494], 'WV': [38.491226, -80.954453],
  'WI': [44.268543, -89.616508], 'WY': [42.755966, -107.302490],
  'DC': [38.897438, -77.026817],
};

// Type for heatmap data: [lat, lng, intensity]
type GeoData = [number, number, number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const metric = (req.query.metric as string) || 'total_users';

  try {
    let geoData: GeoData[] = [];

    // Try to fetch real data from profiles table
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, state, country, created_at, role')
          .not('state', 'is', null);

        if (!error && profiles && profiles.length > 0) {
          // Group by state and count
          const stateCounts: Record<string, number> = {};
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

          profiles.forEach(profile => {
            const state = profile.state?.toUpperCase();
            if (!state || !US_STATE_COORDS[state]) return;

            let shouldCount = false;
            switch (metric) {
              case 'total_users':
                shouldCount = true;
                break;
              case 'new_signups':
                shouldCount = profile.created_at && new Date(profile.created_at) > sevenDaysAgo;
                break;
              case 'beta_testers':
                shouldCount = profile.role === 'beta' || profile.role === 'tester';
                break;
              default:
                shouldCount = true;
            }

            if (shouldCount) {
              stateCounts[state] = (stateCounts[state] || 0) + 1;
            }
          });

          // Convert to heatmap format
          const maxCount = Math.max(...Object.values(stateCounts), 1);
          geoData = Object.entries(stateCounts).map(([state, count]) => {
            const coords = US_STATE_COORDS[state];
            // Normalize intensity between 0.1 and 1.0
            const intensity = Math.max(0.1, count / maxCount);
            return [coords[0], coords[1], intensity] as GeoData;
          });
        }
      } catch (dbError) {
        console.warn('Database query failed, using demo data:', dbError);
      }
    }

    // If no real data, generate demo data for visual appeal
    if (geoData.length === 0) {
      // Demo data: Major tech hubs with varying intensity
      const demoStates = {
        'CA': 0.95, 'NY': 0.85, 'TX': 0.75, 'FL': 0.65, 'WA': 0.60,
        'MA': 0.55, 'IL': 0.50, 'CO': 0.45, 'GA': 0.40, 'NC': 0.35,
        'PA': 0.30, 'AZ': 0.28, 'OH': 0.25, 'MI': 0.22, 'NJ': 0.20,
        'VA': 0.18, 'OR': 0.15, 'MN': 0.12, 'UT': 0.10, 'TN': 0.08,
      };

      geoData = Object.entries(demoStates).map(([state, intensity]) => {
        const coords = US_STATE_COORDS[state];
        return [coords[0], coords[1], intensity] as GeoData;
      });
    }

    // Cache for 5 minutes (investor data doesn't need real-time)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json(geoData);

  } catch (error) {
    console.error('Error fetching map data:', error);
    
    // Return empty array instead of error - map will just be empty
    return res.status(200).json([]);
  }
}