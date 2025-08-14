import type { VercelRequest, VercelResponse } from '@vercel/node';

// This interface defines the expected structure of a single property from the ATTOM API.
// You may need to adjust this based on the actual response from the API.
interface AttomProperty {
  address: {
    oneLine: string;
  };
  building: {
    size: {
      grossSize: number;
    };
    rooms: {
      beds: number;
      bathstotal: number;
    };
  };
  assessment: {
    assessedValue: number;
  };
}

// This is our standardized format that the frontend component expects.
interface Comp {
  id: string;
  address: string;
  value: number;
  sqft: number;
  beds: number;
  baths: number;
}

/**
 * Normalizes the raw data from the ATTOM API into our clean, internal format.
 */
function normalizeAttomData(properties: AttomProperty[]): Comp[] {
  return properties.map((prop, index) => ({
    id: `attom-${index}-${Date.now()}`,
    address: prop.address?.oneLine || 'Address not available',
    value: prop.assessment?.assessedValue || 0,
    sqft: prop.building?.size?.grossSize || 0,
    beds: prop.building?.rooms?.beds || 0,
    baths: prop.building?.rooms?.bathstotal || 0,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const attomApiKey = process.env.ATTOM_API_KEY;

  // Security check: If the API key is not configured on the server, do not proceed.
  if (!attomApiKey) {
    console.error("ATTOM_API_KEY is not configured on the server.");
    return res.status(500).json({
      status: "API key is not configured",
      comps: [],
    });
  }

  // Get the address from the query parameters (e.g., /api/market-comps?address=123+Maple+St)
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ status: "Address parameter is required.", comps: [] });
  }

  // Construct the URL for the ATTOM API.
  // IMPORTANT: This is an example URL. You will need to replace it with the correct endpoint from the ATTOM documentation.
  const attomApiUrl = `https://api.attomdata.com/propertyapi/v1.0.0/property/address?address1=${encodeURIComponent(address)}`;

  try {
    const response = await fetch(attomApiUrl, {
      method: 'GET',
      headers: {
        'apikey': attomApiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // If the API returns an error, pass it along for easier debugging.
      const errorBody = await response.text();
      throw new Error(`ATTOM API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    
    // Normalize the data into the format our frontend expects.
    const normalizedComps = normalizeAttomData(data.property || []);

    return res.status(200).json({
      status: "live",
      comps: normalizedComps,
    });

  } catch (error) {
    console.error("Error fetching from ATTOM API:", error);
    return res.status(500).json({
      status: `API request failed: ${(error as Error).message}`,
      comps: [],
    });
  }
}