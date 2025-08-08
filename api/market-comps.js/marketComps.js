import axios from 'axios';

export default async function handler(req, res) {
  const { address } = req.query;

  try {
    // Zillow integration
    if (process.env.ZILLOW_API_KEY) {
      const result = await axios.get(`https://api.zillow.com/v1/...`, {
        params: { address },
        headers: { Authorization: `Bearer ${process.env.ZILLOW_API_KEY}` }
      });
      return res.status(200).json({ mode: 'live', source: 'zillow', data: result.data });
    }

    // Redfin integration
    if (process.env.REDFIN_API_KEY) {
      const result = await axios.get(`https://api.redfin.com/...`, {
        params: { address },
        headers: { Authorization: `Bearer ${process.env.REDFIN_API_KEY}` }
      });
      return res.status(200).json({ mode: 'live', source: 'redfin', data: result.data });
    }

    // Demo fallback if no keys set
    return res.status(200).json({
      mode: 'demo',
      source: 'sample',
      data: [
        { address: '123 Main St', price: 350000, beds: 3, baths: 2, sqft: 1500 },
        { address: '125 Main St', price: 355000, beds: 3, baths: 2, sqft: 1520 },
        { address: '127 Main St', price: 360000, beds: 3, baths: 2, sqft: 1550 }
      ]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Market comps fetch failed' });
  }
}
