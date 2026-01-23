// FILE: api/ebay/price-check.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const query = req.query.q as string || req.query.query as string;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'Query parameter "q" required (min 2 chars)' });
  }

  const appId = process.env.EBAY_APP_ID || process.env.EBAY_API_TOKEN || process.env.EBAY_CLIENT_ID;
  
  if (!appId) {
    return res.status(500).json({ success: false, error: 'eBay API not configured' });
  }

  try {
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': 'true',
      'keywords': query,
      'paginationInput.entriesPerPage': '50',
      'sortOrder': 'EndTimeSoonest',
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true'
    });

    const response = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`);
    const data = await response.json();
    const searchResult = data.findCompletedItemsResponse?.[0];
    const items = searchResult?.searchResult?.[0]?.item || [];

    // Extract prices
    const prices = items
      .map((item: any) => parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'))
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);

    if (prices.length === 0) {
      return res.status(200).json({ 
        success: true, 
        query, 
        message: 'No sold listings found',
        sampleSize: 0 
      });
    }

    const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const median = prices[Math.floor(prices.length / 2)];

    return res.status(200).json({
      success: true,
      query,
      priceAnalysis: {
        averagePrice: Math.round(avg * 100) / 100,
        medianPrice: Math.round(median * 100) / 100,
        lowestPrice: prices[0],
        highestPrice: prices[prices.length - 1],
        sampleSize: prices.length
      },
      recentSales: items.slice(0, 5).map((item: any) => ({
        title: item.title?.[0],
        price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || '0'),
        date: item.listingInfo?.[0]?.endTime?.[0],
        url: item.viewItemURL?.[0]
      }))
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}