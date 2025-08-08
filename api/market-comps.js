// api/market-comps.js
// Placeholder for Zillow/Redfin integration.
// When you add ZILLOW_API_KEY or REDFIN_API_KEY in Vercel, this will call the provider.
// For now this returns safe mock data.

import axios from "axios";

export default async function handler(req, res) {
  const { address = "", city = "", state = "", zip = "" } = req.query;

  // Read environment keys (added later in Vercel)
  const zillowApiKey = process.env.ZILLOW_API_KEY;
  const redfinApiKey = process.env.REDFIN_API_KEY;

  try {
    // If keys exist, call the providers (placeholder endpoints — update to real endpoints after you get keys)
    let zillowData = null;
    if (zillowApiKey) {
      // Example — replace with official Zillow endpoint/params once you have the key
      const zillowUrl = `https://api.zillow.com/v1/property`;
      const r = await axios.get(zillowUrl, {
        headers: { Authorization: `Bearer ${zillowApiKey}` },
        params: { address, city, state, zip }
      });
      zillowData = r.data;
    }

    let redfinData = null;
    if (redfinApiKey) {
      // Example — replace with Redfin provider / RapidAPI call if you use RapidAPI
      const redfinUrl = `https://api.redfin.com/v1/property`;
      const r2 = await axios.get(redfinUrl, {
        headers: { Authorization: `Bearer ${redfinApiKey}` },
        params: { address, city, state, zip }
      });
      redfinData = r2.data;
    }

    // If no keys, return demo/mock data so UI still works
    if (!zillowData && !redfinData) {
      const mock = {
        address: `${address}${address ? ", " : ""}${city}${city ? ", " : ""}${state} ${zip}`.trim(),
        mode: "demo",
        source: "sample",
        comps: [
          { address: "123 Main St", price: 350000, beds: 3, baths: 2, sqft: 1500 },
          { address: "125 Main St", price: 355000, beds: 3, baths: 2, sqft: 1520 },
          { address: "127 Main St", price: 360000, beds: 3, baths: 2, sqft: 1550 }
        ]
      };
      return res.status(200).json(mock);
    }

    // Combine any provider data we retrieved
    const combinedResults = {
      address: `${address}, ${city}, ${state} ${zip}`.trim(),
      zillow: zillowData,
      redfin: redfinData
    };

    return res.status(200).json({ mode: "live-or-merged", ...combinedResults });

  } catch (error) {
    console.error("Error fetching market comps:", error?.message ?? error);
    return res.status(500).json({ error: "Failed to fetch market comps" });
  }
}
