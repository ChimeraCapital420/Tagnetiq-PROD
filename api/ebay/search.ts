// FILE: api/ebay/search.ts
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
  // CORS
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

  const limit = Math.min(parseInt(req.query.limit as string || '20'), 50);
  const sort = req.query.sort as string || 'BEST_MATCH'; // PRICE, -PRICE, NEWLY_LISTED

  try {
    const accessToken = await getAccessToken();

    const params = new URLSearchParams({
      q: query,
      limit: String(limit)
    });

    if (sort && sort !== 'BEST_MATCH') {
      params.append('sort', sort.toLowerCase());
    }

    const response = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Browse API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    const listings = (data.itemSummaries || []).map((item: any) => {
      const price = parseFloat(item.price?.value || '0');
      const shipping = item.shippingOptions?.[0]?.shippingCost?.value;
      const shippingCost = shipping ? parseFloat(shipping) : 0;

      return {
        itemId: item.itemId,
        title: item.title,
        price,
        currency: item.price?.currency || 'USD',
        shippingCost,
        totalPrice: price + shippingCost,
        condition: item.condition || 'Unknown',
        imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || '',
        itemUrl: item.itemWebUrl,
        seller: {
          username: item.seller?.username || 'Unknown',
          feedbackScore: item.seller?.feedbackScore || 0,
          feedbackPercent: item.seller?.feedbackPercentage || '0'
        },
        location: item.itemLocation?.country || 'Unknown',
        listingType: item.buyingOptions?.includes('AUCTION') ? 'Auction' : 'Buy It Now'
      };
    });

    return res.status(200).json({
      success: true,
      query,
      total: data.total || listings.length,
      count: listings.length,
      listings,
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