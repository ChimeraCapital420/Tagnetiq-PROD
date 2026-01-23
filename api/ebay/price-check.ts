// FILE: api/ebay/price-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const clientId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay credentials not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  });

  if (!response.ok) {
    throw new Error(`OAuth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000)
  };

  return cachedToken.token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = (req.query.q as string) || (req.query.query as string);
  
  if (!query || query.length < 2) {
    return res.status(400).json({ 
      success: false, 
      error: 'Query parameter "q" required (min 2 chars)' 
    });
  }

  try {
    const accessToken = await getAccessToken();

    // Get up to 50 listings for price analysis
    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Browse API error: ${response.status}`);
    }

    const data = await response.json();
    const items = data.itemSummaries || [];

    if (items.length === 0) {
      return res.status(200).json({
        success: true,
        query,
        message: 'No listings found',
        priceAnalysis: null,
        timestamp: new Date().toISOString()
      });
    }

    // Extract prices (Buy It Now only for accurate pricing)
    const prices = items
      .filter((item: any) => item.buyingOptions?.includes('FIXED_PRICE'))
      .map((item: any) => {
        const price = parseFloat(item.price?.value || '0');
        const shipping = item.shippingOptions?.[0]?.shippingCost?.value;
        return price + (shipping ? parseFloat(shipping) : 0);
      })
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);

    if (prices.length === 0) {
      return res.status(200).json({
        success: true,
        query,
        message: 'No Buy It Now listings found for price analysis',
        priceAnalysis: null,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate statistics
    const sum = prices.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / prices.length;
    const median = prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

    // Suggested prices
    const buyPrice = Math.round(median * 0.80 * 100) / 100; // 20% below median = good deal
    const fairPrice = Math.round(median * 100) / 100;
    const sellPrice = Math.round(median * 1.05 * 100) / 100; // 5% above median

    return res.status(200).json({
      success: true,
      query,
      dataSource: 'active_listings',
      note: 'Prices based on current active listings, not completed sales',
      priceAnalysis: {
        averagePrice: Math.round(avg * 100) / 100,
        medianPrice: Math.round(median * 100) / 100,
        lowestPrice: Math.round(prices[0] * 100) / 100,
        highestPrice: Math.round(prices[prices.length - 1] * 100) / 100,
        sampleSize: prices.length,
        currency: 'USD'
      },
      suggestedPrices: {
        goodDeal: buyPrice,
        fairMarket: fairPrice,
        sellPrice: sellPrice
      },
      sampleListings: items.slice(0, 5).map((item: any) => ({
        title: item.title,
        price: parseFloat(item.price?.value || '0'),
        condition: item.condition,
        url: item.itemWebUrl
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}