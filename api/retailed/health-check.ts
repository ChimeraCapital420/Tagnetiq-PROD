// FILE: api/retailed/health-check.ts
// Retailed Sneaker/Streetwear API Health Check

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const RETAILED_BASE_URL = 'https://app.retailed.io/api/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RETAILED_API_KEY;

  if (!apiKey) {
    return res.status(200).json({
      provider: 'retailed',
      status: 'unconfigured',
      message: 'RETAILED_API_KEY environment variable not set',
      timestamp: new Date().toISOString()
    });
  }

  const startTime = Date.now();

  try {
    // Test with a search for Jordan (popular SKU)
    const response = await fetch(
      `${RETAILED_BASE_URL}/db/products?where[or][0][and][0][sku][contains]=DH6927&limit=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(200).json({
        provider: 'retailed',
        status: 'unhealthy',
        message: `Retailed API returned ${response.status}: ${errorText}`,
        responseTime,
        timestamp: new Date().toISOString()
      });
    }

    const data = await response.json();
    const testProduct = data.docs?.[0];

    return res.status(200).json({
      provider: 'retailed',
      status: 'healthy',
      message: 'Retailed Sneaker API is operational',
      responseTime,
      testResult: testProduct ? {
        id: testProduct.id,
        name: testProduct.name,
        sku: testProduct.sku,
        brand: testProduct.brand?.name
      } : null,
      capabilities: {
        productSearch: true,
        skuLookup: true,
        upcLookup: true,
        pricingData: true,
        sizeVariants: true,
        multiMarketplace: true
      },
      coverage: 'StockX, GOAT, Flight Club, Stadium Goods',
      documentation: 'https://docs.retailed.io'
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Retailed health check failed:', error);

    return res.status(200).json({
      provider: 'retailed',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Failed to connect to Retailed API',
      responseTime,
      timestamp: new Date().toISOString()
    });
  }
}