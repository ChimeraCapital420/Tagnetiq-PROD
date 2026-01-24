// FILE: api/retailed/prices.ts
// Retailed Sneaker Pricing - Multi-marketplace prices

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const RETAILED_BASE_URL = 'https://app.retailed.io/api/v1';

interface PriceDoc {
  id: string;
  productId: string;
  name: string;
  country: string;
  currency: string;
  currencySymbol: string;
  url: string;
  domain: string;
  urlSlug: string;
  price: number;
  lastCrawledAt: string;
  variants?: Array<{
    id: string;
    sku: string;
    title: string;
    brand: string;
    model: string;
    category: string;
    barcodeFormats?: string;
  }>;
}

interface RetailedPriceResponse {
  docs: PriceDoc[];
  totalDocs: number;
  limit: number;
  page: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RETAILED_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'Retailed API not configured',
      message: 'RETAILED_API_KEY environment variable not set'
    });
  }

  const { sku, upc, query } = req.query;

  if (!sku && !upc && !query) {
    return res.status(400).json({
      error: 'Missing search parameter',
      message: 'Provide sku, upc, or query parameter',
      examples: [
        '/api/retailed/prices?sku=DH6927-140',
        '/api/retailed/prices?upc=884500475069',
        '/api/retailed/prices?query=jordan+4+midnight+navy'
      ]
    });
  }

  try {
    // Build the query for the asks endpoint
    let queryString = '';
    
    if (sku) {
      queryString = `query=${encodeURIComponent(String(sku))}`;
    } else if (upc) {
      queryString = `query=${encodeURIComponent(String(upc))}`;
    } else if (query) {
      queryString = `query=${encodeURIComponent(String(query))}`;
    }

    const response = await fetch(
      `${RETAILED_BASE_URL}/db/products/asks?${queryString}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Retailed API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'Retailed API error',
        status: response.status,
        message: errorText
      });
    }

    const data: RetailedPriceResponse = await response.json();
    
    if (!data.docs || data.docs.length === 0) {
      return res.status(200).json({
        success: true,
        query: sku || upc || query,
        found: false,
        message: 'No pricing data found for this product',
        prices: []
      });
    }

    // Group prices by marketplace
    const pricesByMarketplace: Record<string, {
      marketplace: string;
      domain: string;
      country: string;
      currency: string;
      lowestAsk: number;
      url: string;
      lastUpdated: string;
    }> = {};

    let productInfo: {
      sku?: string;
      title?: string;
      brand?: string;
      model?: string;
      category?: string;
    } | null = null;

    data.docs.forEach((doc) => {
      const key = `${doc.domain}-${doc.country}`;
      
      // Extract product info from first doc with variants
      if (!productInfo && doc.variants && doc.variants.length > 0) {
        const variant = doc.variants[0];
        productInfo = {
          sku: variant.sku,
          title: variant.title,
          brand: variant.brand,
          model: variant.model,
          category: variant.category
        };
      }

      // Keep lowest price per marketplace
      if (!pricesByMarketplace[key] || doc.price < pricesByMarketplace[key].lowestAsk) {
        pricesByMarketplace[key] = {
          marketplace: doc.name,
          domain: doc.domain,
          country: doc.country,
          currency: doc.currency,
          lowestAsk: doc.price,
          url: doc.url,
          lastUpdated: doc.lastCrawledAt
        };
      }
    });

    const prices = Object.values(pricesByMarketplace).sort((a, b) => a.lowestAsk - b.lowestAsk);
    
    // Calculate price stats
    const allPrices = prices.map(p => p.lowestAsk).filter(p => p > 0);
    const lowestPrice = allPrices.length > 0 ? Math.min(...allPrices) : null;
    const highestPrice = allPrices.length > 0 ? Math.max(...allPrices) : null;
    const avgPrice = allPrices.length > 0 
      ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) 
      : null;

    return res.status(200).json({
      success: true,
      query: sku || upc || query,
      found: true,
      product: productInfo,
      priceStats: {
        lowestAsk: lowestPrice,
        highestAsk: highestPrice,
        averageAsk: avgPrice,
        marketplaceCount: prices.length
      },
      prices,
      // For Hydra integration
      valuationContext: {
        category: 'sneakers',
        identifiers: {
          sku: productInfo?.sku || sku,
          brand: productInfo?.brand,
          model: productInfo?.model
        },
        marketData: {
          lowestPrice,
          highestPrice,
          averagePrice: avgPrice,
          sources: prices.map(p => p.domain),
          currency: 'USD'
        },
        description: productInfo?.title || `${productInfo?.brand} ${productInfo?.model}`
      }
    });

  } catch (error) {
    console.error('Retailed prices fetch failed:', error);
    return res.status(500).json({
      error: 'Failed to fetch prices',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}