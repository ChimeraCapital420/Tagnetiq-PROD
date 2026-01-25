// FILE: src/lib/hydra/fetchers/ebay.ts
// HYDRA v5.2 - eBay Market Data Fetcher

import type { MarketDataSource } from '../types.js';

export async function fetchEbayData(itemName: string, category?: string): Promise<MarketDataSource> {
  const startTime = Date.now();
  
  try {
    // Build search query
    let searchQuery = itemName;
    
    // Category-specific query enhancements
    if (category === 'coins' || category === 'banknotes') {
      searchQuery = `${itemName} -replica -copy -fake`;
    } else if (category === 'pokemon_cards' || category === 'trading_cards') {
      searchQuery = `${itemName} -repack -custom -proxy`;
    }
    
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // eBay Browse API endpoint (sandbox for testing, production requires app credentials)
    const ebayApiUrl = process.env.EBAY_API_URL || 'https://api.ebay.com/buy/browse/v1';
    const ebayAppId = process.env.EBAY_APP_ID;
    const ebayAccessToken = process.env.EBAY_ACCESS_TOKEN;
    
    if (!ebayAppId && !ebayAccessToken) {
      console.log('⚠️ eBay API credentials not configured, using fallback');
      return createFallbackResult(itemName, searchQuery);
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    };
    
    if (ebayAccessToken) {
      headers['Authorization'] = `Bearer ${ebayAccessToken}`;
    }
    
    // Search for sold/completed items
    const searchUrl = `${ebayApiUrl}/item_summary/search?q=${encodedQuery}&filter=buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|LIKE_NEW|VERY_GOOD|GOOD}&limit=20&sort=price`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      console.error(`❌ eBay API error: ${response.status} ${response.statusText}`);
      return createFallbackResult(itemName, searchQuery);
    }
    
    const data = await response.json();
    const items = data.itemSummaries || [];
    
    if (items.length === 0) {
      return {
        source: 'ebay',
        available: false,
        query: searchQuery,
        totalListings: 0,
        error: 'No listings found',
      };
    }
    
    // Extract prices
    const prices = items
      .map((item: any) => parseFloat(item.price?.value || '0'))
      .filter((p: number) => p > 0)
      .sort((a: number, b: number) => a - b);
    
    const lowest = prices[0] || 0;
    const highest = prices[prices.length - 1] || 0;
    const average = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
    const median = prices[Math.floor(prices.length / 2)] || average;
    
    // Build sample listings
    const sampleListings = items.slice(0, 5).map((item: any) => ({
      title: item.title || 'Unknown',
      price: parseFloat(item.price?.value || '0'),
      condition: item.condition || 'Unknown',
      url: item.itemWebUrl || `https://www.ebay.com/itm/${item.itemId}`,
    }));
    
    console.log(`✅ eBay: Found ${items.length} listings in ${Date.now() - startTime}ms`);
    
    return {
      source: 'ebay',
      available: true,
      query: searchQuery,
      totalListings: data.total || items.length,
      priceAnalysis: {
        lowest,
        highest,
        average: parseFloat(average.toFixed(2)),
        median: parseFloat(median.toFixed(2)),
      },
      suggestedPrices: {
        goodDeal: parseFloat((median * 0.75).toFixed(2)),
        fairMarket: parseFloat(median.toFixed(2)),
        sellPrice: parseFloat((median * 1.1).toFixed(2)),
      },
      sampleListings,
      metadata: {
        responseTime: Date.now() - startTime,
        apiVersion: 'browse_v1',
      },
    };
    
  } catch (error) {
    console.error('❌ eBay fetch error:', error);
    return {
      source: 'ebay',
      available: false,
      query: itemName,
      totalListings: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function createFallbackResult(itemName: string, query: string): MarketDataSource {
  // Generate eBay search URL for manual lookup
  const searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sop=15&LH_Complete=1&LH_Sold=1`;
  
  return {
    source: 'ebay',
    available: true,
    query,
    totalListings: 0,
    sampleListings: [{
      title: `Search eBay for "${itemName}"`,
      price: 0,
      condition: 'N/A',
      url: searchUrl,
    }],
    metadata: {
      fallback: true,
      searchUrl,
    },
  };
}