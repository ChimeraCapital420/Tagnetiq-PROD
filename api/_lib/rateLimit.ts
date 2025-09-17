// FILE: api/_lib/rateLimit.ts
// Rate limiting implementation for Vercel serverless functions

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory store (resets on each cold start)
// For production, use Redis or Upstash
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  keyGenerator?: (req: VercelRequest) => string; // Function to generate key
  message?: string; // Error message
}

export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  options: RateLimitOptions = {}
): Promise<boolean> {
  const {
    windowMs = 60 * 1000, // 1 minute default
    max = 10, // 10 requests default
    keyGenerator = (req) => req.headers['x-forwarded-for'] as string || 'anonymous',
    message = 'Too many requests, please try again later.'
  } = options;

  const key = keyGenerator(req);
  const now = Date.now();
  const windowStart = now - windowMs;

  // Clean up old entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < windowStart) {
      rateLimitStore.delete(k);
    }
  }

  // Get or create rate limit data
  const limitData = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

  // Reset if window expired
  if (limitData.resetTime < now) {
    limitData.count = 0;
    limitData.resetTime = now + windowMs;
  }

  // Increment counter
  limitData.count++;
  rateLimitStore.set(key, limitData);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', max.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - limitData.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());

  // Check if limit exceeded
  if (limitData.count > max) {
    res.status(429).json({ error: message });
    return false; // Request blocked
  }

  return true; // Request allowed
}

// Usage example:
// if (!await rateLimit(req, res, { max: 30, windowMs: 60000 })) return;