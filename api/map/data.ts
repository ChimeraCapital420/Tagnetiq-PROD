// FILE: api/map/data.ts
// Investor Map Data API - REAL DATA ONLY
// Queries profiles.location_text (free text field)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// US State coordinates
const US_STATE_COORDS: Record<string, [number, number]> = {
  'AL': [32.806671, -86.791130], 'ALABAMA': [32.806671, -86.791130],
  'AK': [61.370716, -152.404419], 'ALASKA': [61.370716, -152.404419],
  'AZ': [33.729759, -111.431221], 'ARIZONA': [33.729759, -111.431221],
  'AR': [34.969704, -92.373123], 'ARKANSAS': [34.969704, -92.373123],
  'CA': [36.116203, -119.681564], 'CALIFORNIA': [36.116203, -119.681564],
  'CO': [39.059811, -105.311104], 'COLORADO': [39.059811, -105.311104],
  'CT': [41.597782, -72.755371], 'CONNECTICUT': [41.597782, -72.755371],
  'DE': [39.318523, -75.507141], 'DELAWARE': [39.318523, -75.507141],
  'FL': [27.766279, -81.686783], 'FLORIDA': [27.766279, -81.686783],
  'GA': [33.040619, -83.643074], 'GEORGIA': [33.040619, -83.643074],
  'HI': [21.094318, -157.498337], 'HAWAII': [21.094318, -157.498337],
  'ID': [44.240459, -114.478828], 'IDAHO': [44.240459, -114.478828],
  'IL': [40.349457, -88.986137], 'ILLINOIS': [40.349457, -88.986137],
  'IN': [39.849426, -86.258278], 'INDIANA': [39.849426, -86.258278],
  'IA': [42.011539, -93.210526], 'IOWA': [42.011539, -93.210526],
  'KS': [38.526600, -96.726486], 'KANSAS': [38.526600, -96.726486],
  'KY': [37.668140, -84.670067], 'KENTUCKY': [37.668140, -84.670067],
  'LA': [31.169546, -91.867805], 'LOUISIANA': [31.169546, -91.867805],
  'ME': [44.693947, -69.381927], 'MAINE': [44.693947, -69.381927],
  'MD': [39.063946, -76.802101], 'MARYLAND': [39.063946, -76.802101],
  'MA': [42.230171, -71.530106], 'MASSACHUSETTS': [42.230171, -71.530106],
  'MI': [43.326618, -84.536095], 'MICHIGAN': [43.326618, -84.536095],
  'MN': [45.694454, -93.900192], 'MINNESOTA': [45.694454, -93.900192],
  'MS': [32.741646, -89.678696], 'MISSISSIPPI': [32.741646, -89.678696],
  'MO': [38.456085, -92.288368], 'MISSOURI': [38.456085, -92.288368],
  'MT': [46.921925, -110.454353], 'MONTANA': [46.921925, -110.454353],
  'NE': [41.125370, -98.268082], 'NEBRASKA': [41.125370, -98.268082],
  'NV': [38.313515, -117.055374], 'NEVADA': [38.313515, -117.055374],
  'NH': [43.452492, -71.563896], 'NEW HAMPSHIRE': [43.452492, -71.563896],
  'NJ': [40.298904, -74.521011], 'NEW JERSEY': [40.298904, -74.521011],
  'NM': [34.840515, -106.248482], 'NEW MEXICO': [34.840515, -106.248482],
  'NY': [42.165726, -74.948051], 'NEW YORK': [42.165726, -74.948051],
  'NC': [35.630066, -79.806419], 'NORTH CAROLINA': [35.630066, -79.806419],
  'ND': [47.528912, -99.784012], 'NORTH DAKOTA': [47.528912, -99.784012],
  'OH': [40.388783, -82.764915], 'OHIO': [40.388783, -82.764915],
  'OK': [35.565342, -96.928917], 'OKLAHOMA': [35.565342, -96.928917],
  'OR': [44.572021, -122.070938], 'OREGON': [44.572021, -122.070938],
  'PA': [40.590752, -77.209755], 'PENNSYLVANIA': [40.590752, -77.209755],
  'RI': [41.680893, -71.511780], 'RHODE ISLAND': [41.680893, -71.511780],
  'SC': [33.856892, -80.945007], 'SOUTH CAROLINA': [33.856892, -80.945007],
  'SD': [44.299782, -99.438828], 'SOUTH DAKOTA': [44.299782, -99.438828],
  'TN': [35.747845, -86.692345], 'TENNESSEE': [35.747845, -86.692345],
  'TX': [31.054487, -97.563461], 'TEXAS': [31.054487, -97.563461],
  'UT': [40.150032, -111.862434], 'UTAH': [40.150032, -111.862434],
  'VT': [44.045876, -72.710686], 'VERMONT': [44.045876, -72.710686],
  'VA': [37.769337, -78.169968], 'VIRGINIA': [37.769337, -78.169968],
  'WA': [47.400902, -121.490494], 'WASHINGTON': [47.400902, -121.490494],
  'WV': [38.491226, -80.954453], 'WEST VIRGINIA': [38.491226, -80.954453],
  'WI': [44.268543, -89.616508], 'WISCONSIN': [44.268543, -89.616508],
  'WY': [42.755966, -107.302490], 'WYOMING': [42.755966, -107.302490],
  'DC': [38.897438, -77.026817], 'WASHINGTON DC': [38.897438, -77.026817],
};

// Major cities mapped to state codes (for parsing location_text)
const CITY_TO_STATE: Record<string, string> = {
  'LOS ANGELES': 'CA', 'SAN FRANCISCO': 'CA', 'SAN DIEGO': 'CA', 'SACRAMENTO': 'CA',
  'NEW YORK': 'NY', 'NYC': 'NY', 'BROOKLYN': 'NY', 'MANHATTAN': 'NY',
  'HOUSTON': 'TX', 'DALLAS': 'TX', 'AUSTIN': 'TX', 'SAN ANTONIO': 'TX',
  'MIAMI': 'FL', 'ORLANDO': 'FL', 'TAMPA': 'FL', 'JACKSONVILLE': 'FL',
  'CHICAGO': 'IL', 'SEATTLE': 'WA', 'DENVER': 'CO', 'PHOENIX': 'AZ',
  'BOSTON': 'MA', 'ATLANTA': 'GA', 'DETROIT': 'MI', 'MINNEAPOLIS': 'MN',
  'PORTLAND': 'OR', 'LAS VEGAS': 'NV', 'PHILADELPHIA': 'PA', 'CHARLOTTE': 'NC',
};

// Parse location_text to extract state
function extractStateFromLocation(locationText: string | null): string | null {
  if (!locationText) return null;
  
  const upper = locationText.toUpperCase().trim();
  
  // Check for state abbreviation (e.g., "CA", "NY, USA")
  for (const key of Object.keys(US_STATE_COORDS)) {
    if (key.length === 2 && upper.includes(key)) {
      // Make sure it's a standalone abbreviation, not part of a word
      const regex = new RegExp(`\\b${key}\\b`);
      if (regex.test(upper)) {
        return key;
      }
    }
  }
  
  // Check for full state name
  for (const key of Object.keys(US_STATE_COORDS)) {
    if (key.length > 2 && upper.includes(key)) {
      // Return the 2-letter code
      const twoLetter = Object.keys(US_STATE_COORDS).find(k => 
        k.length === 2 && US_STATE_COORDS[k][0] === US_STATE_COORDS[key][0]
      );
      return twoLetter || null;
    }
  }
  
  // Check for city names
  for (const [city, state] of Object.entries(CITY_TO_STATE)) {
    if (upper.includes(city)) {
      return state;
    }
  }
  
  return null;
}

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

  try {
    let geoData: GeoData[] = [];
    let totalUsers = 0;
    let usersWithLocation = 0;

    // Fetch REAL data from profiles.location_text
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, location_text, created_at');

    if (error) {
      console.error('Error fetching profiles:', error);
      return res.status(200).json({
        data: [],
        meta: { totalUsers: 0, usersWithLocation: 0, note: 'Database query failed' }
      });
    }

    totalUsers = profiles?.length || 0;

    if (profiles && profiles.length > 0) {
      // Group by state and count
      const stateCounts: Record<string, number> = {};

      profiles.forEach(profile => {
        const state = extractStateFromLocation(profile.location_text);
        if (state && US_STATE_COORDS[state]) {
          stateCounts[state] = (stateCounts[state] || 0) + 1;
          usersWithLocation++;
        }
      });

      // Convert to heatmap format
      if (Object.keys(stateCounts).length > 0) {
        const maxCount = Math.max(...Object.values(stateCounts), 1);
        geoData = Object.entries(stateCounts).map(([state, count]) => {
          const coords = US_STATE_COORDS[state];
          // Normalize intensity between 0.3 and 1.0 (ensure visibility)
          const intensity = Math.max(0.3, count / maxCount);
          return [coords[0], coords[1], intensity] as GeoData;
        });
      }
    }

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    
    // Return data with metadata
    return res.status(200).json({
      data: geoData,
      meta: {
        totalUsers,
        usersWithLocation,
        source: 'database',
        note: geoData.length === 0 
          ? 'No users have set their location yet' 
          : `Showing ${usersWithLocation} users with location data`
      }
    });

  } catch (error) {
    console.error('Error fetching map data:', error);
    return res.status(200).json({
      data: [],
      meta: { totalUsers: 0, usersWithLocation: 0, error: 'Failed to fetch data' }
    });
  }
}