// FILE: api/retailed/search.ts
// Retailed Sneaker/Streetwear Search

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const RETAILED_BASE_URL = 'https://app.retailed.io/api/v1';

interface RetailedProduct {
  id: string;
  name: string;
  sku: string;
  image: string;
  releasedAt: string;
  sizing: string;
  initialPrice: number;
  colorway: string;
  createdAt: string;
  updatedAt: string | null;
  brand: {
    id: string;
    name: string;
  } | null;
}

interface RetailedResponse {
  docs: RetailedProduct[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

function formatProductResult(product: RetailedProduct) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    brand: product.brand?.name || null,
    colorway: product.colorway,
    releaseDate: product.releasedAt,
    retailPrice: product.initialPrice,
    sizing: product.sizing, // man, woman, youth, etc.
    image: product.image,
    
    // For Hydra integration
    valuationContext: {
      category: 'sneakers',
      subcategory: product.sizing === 'man' ? 'mens-sneakers' : 
                   product.sizing === 'woman' ? 'womens-sneakers' : 
                   'sneakers',
      identifiers: {
        retailedId: product.id,
        sku: product.sku,
        brand: product.brand?.name,
        colorway: product.colorway,
        releaseDate: product.releasedAt
      },
      retailPrice: product.initialPrice,
      description: `${product.brand?.name || ''} ${product.name} - ${product.colorway}`
    }
  };
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

  const {
    q,           // General search query
    query,       // Alias for q
    sku,         // SKU lookup (e.g., DH6927-140)
    brand,       // Brand filter
    page = '1',
    limit = '20'
  } = req.query;

  const searchQuery = q || query;

  if (!searchQuery && !sku && !brand) {
    return res.status(400).json({
      error: 'Missing search parameters',
      message: 'Provide at least one: q, sku, or brand',
      examples: [
        '/api/retailed/search?q=jordan+4',
        '/api/retailed/search?sku=DH6927-140',
        '/api/retailed/search?brand=Nike&q=dunk',
        '/api/retailed/search?q=yeezy+350'
      ]
    });
  }

  try {
    // Build query parameters for Retailed API
    const params = new URLSearchParams({
      limit: String(Math.min(Number(limit), 50)),
      page: String(page)
    });

    // Build where clause
    const whereClauses: string[] = [];
    
    if (sku) {
      // Exact or partial SKU match
      whereClauses.push(`where[or][0][and][0][sku][contains]=${encodeURIComponent(String(sku))}`);
    }
    
    if (searchQuery) {
      // Search in name
      whereClauses.push(`where[or][0][and][0][name][contains]=${encodeURIComponent(String(searchQuery))}`);
    }

    const queryString = `${params.toString()}${whereClauses.length ? '&' + whereClauses.join('&') : ''}`;

    const response = await fetch(
      `${RETAILED_BASE_URL}/db/products?${queryString}`,
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

    const data: RetailedResponse = await response.json();
    
    const results = Array.isArray(data.docs) 
      ? data.docs.map(formatProductResult) 
      : [];

    return res.status(200).json({
      success: true,
      query: searchQuery || sku || brand,
      totalResults: data.totalDocs || 0,
      page: data.page || Number(page),
      pageSize: data.limit || Number(limit),
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false,
      hasPrevPage: data.hasPrevPage || false,
      results
    });

  } catch (error) {
    console.error('Retailed search failed:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}