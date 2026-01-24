// FILE: api/retailed/barcode.ts
// Retailed Sneaker Barcode Lookup (UPC/EAN)

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

const RETAILED_BASE_URL = 'https://app.retailed.io/api/v1';

interface VariantDoc {
  id: string;
  products: string[];
  barcodeFormats: string;
  model: string;
  sku: string;
  title: string;
  category: string;
  brand: string;
  colorway?: string;
  gender?: string;
  releaseDate?: string;
  retailPrice?: number;
  image?: string;
}

interface RetailedVariantResponse {
  docs: VariantDoc[];
  totalDocs: number;
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

  const { upc, ean, barcode } = req.query;

  const barcodeValue = upc || ean || barcode;

  if (!barcodeValue) {
    return res.status(400).json({
      error: 'Missing barcode',
      message: 'Provide upc, ean, or barcode parameter',
      examples: [
        '/api/retailed/barcode?upc=884500475069',
        '/api/retailed/barcode?ean=5702016914306',
        '/api/retailed/barcode?barcode=884500475069'
      ]
    });
  }

  // Validate barcode format (should be numeric, 8-14 digits)
  const cleanBarcode = String(barcodeValue).replace(/\D/g, '');
  if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
    return res.status(400).json({
      error: 'Invalid barcode format',
      message: 'Barcode should be 8-14 digits (UPC-A is 12, EAN-13 is 13)',
      provided: barcodeValue
    });
  }

  try {
    // Query variants by barcode ID
    const response = await fetch(
      `${RETAILED_BASE_URL}/db/variants?where[or][0][and][0][id][equals]=${cleanBarcode}`,
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

    const data: RetailedVariantResponse = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return res.status(200).json({
        success: true,
        barcode: cleanBarcode,
        found: false,
        message: 'No product found for this barcode',
        suggestion: 'Try searching by SKU instead: /api/retailed/search?sku=...'
      });
    }

    const variant = data.docs[0];

    const result = {
      success: true,
      barcode: cleanBarcode,
      found: true,
      product: {
        sku: variant.sku,
        title: variant.title,
        brand: variant.brand,
        model: variant.model,
        category: variant.category,
        colorway: variant.colorway,
        gender: variant.gender,
        releaseDate: variant.releaseDate,
        retailPrice: variant.retailPrice,
        image: variant.image,
        barcodeFormats: variant.barcodeFormats
      },
      // For Hydra integration
      valuationContext: {
        category: 'sneakers',
        subcategory: variant.gender === 'men' ? 'mens-sneakers' : 
                     variant.gender === 'women' ? 'womens-sneakers' : 
                     'sneakers',
        identifiers: {
          upc: cleanBarcode,
          sku: variant.sku,
          brand: variant.brand,
          model: variant.model,
          colorway: variant.colorway
        },
        retailPrice: variant.retailPrice,
        description: variant.title
      },
      // Link to get prices
      pricingUrl: `/api/retailed/prices?sku=${encodeURIComponent(variant.sku)}`
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Retailed barcode lookup failed:', error);
    return res.status(500).json({
      error: 'Barcode lookup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}