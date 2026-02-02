// FILE: api/partner/docs.ts
// Partner API Documentation
// Returns OpenAPI-style documentation

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DOMAIN = process.env.NEXT_PUBLIC_APP_URL || 'https://tagnetiq.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');

  const docs = {
    openapi: '3.0.0',
    info: {
      title: 'TagnetIQ Partner API',
      version: '1.0.0',
      description: 'Access TagnetIQ marketplace listings programmatically. Perfect for building apps, integrations, and custom storefronts.',
      contact: {
        email: 'api@tagnetiq.com',
        url: `${DOMAIN}/support`,
      },
    },
    servers: [
      {
        url: `${DOMAIN}/api/partner`,
        description: 'Production',
      },
    ],
    security: [
      { ApiKeyAuth: [] },
    ],
    paths: {
      '/listings': {
        get: {
          summary: 'List all active listings',
          description: 'Returns paginated list of active, public listings. Supports filtering, sorting, and field selection.',
          tags: ['Listings'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
            { name: 'min_price', in: 'query', schema: { type: 'number' }, description: 'Minimum price' },
            { name: 'max_price', in: 'query', schema: { type: 'number' }, description: 'Maximum price' },
            { name: 'condition', in: 'query', schema: { type: 'string' }, description: 'Filter by condition' },
            { name: 'verified_only', in: 'query', schema: { type: 'boolean' }, description: 'Only verified listings' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search in title' },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['created_at', 'asking_price', 'updated_at'] }, description: 'Sort field' },
            { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Sort order' },
            { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' }, description: 'Listings created after this date' },
            { name: 'fields', in: 'query', schema: { type: 'string' }, description: 'Comma-separated list of fields to return' },
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ListingsResponse' },
                },
              },
            },
            401: { description: 'Invalid or missing API key' },
            429: { description: 'Rate limit exceeded' },
          },
        },
      },
      '/listing/{id}': {
        get: {
          summary: 'Get single listing',
          description: 'Returns detailed information about a specific listing.',
          tags: ['Listings'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Listing ID' },
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ListingResponse' },
                },
              },
            },
            404: { description: 'Listing not found' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Your TagnetIQ API key. Get one at /settings/api',
        },
      },
      schemas: {
        Listing: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            price: {
              type: 'object',
              properties: {
                asking: { type: 'number' },
                estimated: { type: 'number' },
                currency: { type: 'string', default: 'USD' },
              },
            },
            category: { type: 'string' },
            condition: { type: 'string' },
            images: {
              type: 'object',
              properties: {
                primary: { type: 'string', format: 'uri' },
                additional: { type: 'array', items: { type: 'string', format: 'uri' } },
              },
            },
            verified: { type: 'boolean' },
            seller: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                location: { type: 'string' },
                verified: { type: 'boolean' },
              },
            },
            urls: {
              type: 'object',
              properties: {
                listing: { type: 'string', format: 'uri' },
                api: { type: 'string', format: 'uri' },
              },
            },
            timestamps: {
              type: 'object',
              properties: {
                created: { type: 'string', format: 'date-time' },
                updated: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        ListingsResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Listing' },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                total_pages: { type: 'integer' },
                has_more: { type: 'boolean' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                api_version: { type: 'string' },
                request_id: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        ListingResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Listing' },
            meta: { type: 'object' },
          },
        },
      },
    },
    'x-rate-limits': {
      free: { requests_per_day: 100, listings_per_request: 20 },
      basic: { requests_per_day: 1000, listings_per_request: 50 },
      pro: { requests_per_day: 10000, listings_per_request: 100 },
      enterprise: { requests_per_day: 100000, listings_per_request: 500 },
    },
    'x-quickstart': {
      step1: 'Get your API key at /settings/api',
      step2: 'Include X-API-Key header in all requests',
      step3: 'Start with GET /api/partner/listings',
      example: `curl -H "X-API-Key: YOUR_KEY" ${DOMAIN}/api/partner/listings`,
    },
  };

  return res.status(200).json(docs);
}