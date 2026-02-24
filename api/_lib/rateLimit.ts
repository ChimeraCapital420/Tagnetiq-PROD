// FILE: api/_lib/rateLimit.ts
// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER — In-Memory Sliding Window for Vercel Serverless
// ═══════════════════════════════════════════════════════════════════════════════
//
// Called at the top of expensive API handlers to prevent abuse.
// Uses in-memory Map — resets on cold start (acceptable tradeoff for
// zero-cost, zero-latency burst protection).
//
// Usage:
//   import { rateLimit, LIMITS } from './_lib/rateLimit.js';
//
//   const rl = rateLimit(req, LIMITS.EXPENSIVE);  // or LIMITS.STANDARD
//   if (!rl.allowed) {
//     res.setHeader('Retry-After', String(rl.retryAfter));
//     return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter });
//   }
//
// Upgrade path: Swap the Map for Upstash Redis when you need distributed
// rate limiting across edge nodes. The interface stays the same.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { VercelRequest } from '@vercel/node';

// ── Preset Limits ─────────────────────────────────────────────────────────────

export const LIMITS = {
  /** /api/analyze, /api/refine-analysis — multi-AI calls, expensive */
  EXPENSIVE: { maxRequests: 10, windowMs: 60_000, label: 'expensive' },

  /** /api/investor/*, /api/boardroom/* — admin polling */
  ADMIN: { maxRequests: 30, windowMs: 60_000, label: 'admin' },

  /** /api/arena/* — user-facing, higher traffic */
  STANDARD: { maxRequests: 60, windowMs: 60_000, label: 'standard' },

  /** /api/test-providers — dev/debug only */
  DEBUG: { maxRequests: 5, windowMs: 60_000, label: 'debug' },

  /** Global fallback */
  GLOBAL: { maxRequests: 120, windowMs: 60_000, label: 'global' },
} as const;

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
  label: string;
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter?: number;
  ip: string;
}

// ── Sliding Window Store ──────────────────────────────────────────────────────
// Shared across function invocations within the same Vercel instance.
// Resets on cold start — this is a feature, not a bug:
//   - Catches burst abuse (bot hammering endpoint)
//   - Won't catch slow sustained abuse (need Redis for that)
//   - Zero cost, zero latency, zero dependencies

interface WindowEntry {
  timestamps: number[];
  blocked: boolean;
  blockUntil: number;
}

const store = new Map<string, WindowEntry>();

// Cleanup stale entries periodically
const CLEANUP_INTERVAL = 5 * 60_000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - 120_000;
  for (const [key, entry] of store) {
    if (!entry.blocked && entry.timestamps.every(t => t < cutoff)) {
      store.delete(key);
    }
  }

  // Hard cap: prevent memory exhaustion from distributed attacks
  if (store.size > 5_000) {
    store.clear();
  }
}

// ── Extract Client IP ─────────────────────────────────────────────────────────

function getClientIP(req: VercelRequest): string {
  // Vercel sets x-forwarded-for automatically
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp.trim();
  }

  return 'unknown';
}

// ── Main Rate Limit Function ──────────────────────────────────────────────────

/**
 * Check rate limit for the current request.
 * Call at the top of your handler, before any expensive work.
 *
 * @param req - Vercel request object
 * @param config - Rate limit config (use LIMITS presets)
 * @returns Result with allowed/remaining/retryAfter
 */
export function rateLimit(req: VercelRequest, config: RateLimitConfig): RateLimitResult {
  cleanup();

  const ip = getClientIP(req);
  const key = `${ip}:${config.label}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get or create entry
  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], blocked: false, blockUntil: 0 };
    store.set(key, entry);
  }

  // Check penalty box
  if (entry.blocked && now < entry.blockUntil) {
    const retryAfter = Math.ceil((entry.blockUntil - now) / 1000);
    return { allowed: false, limit: config.maxRequests, remaining: 0, retryAfter, ip };
  }

  // Clear expired block
  if (entry.blocked && now >= entry.blockUntil) {
    entry.blocked = false;
    entry.timestamps = [];
  }

  // Slide window
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  // Check limit
  if (entry.timestamps.length >= config.maxRequests) {
    // Penalty: block until window clears + 10s cooldown
    const oldest = entry.timestamps[0];
    const blockDuration = (oldest + config.windowMs - now) + 10_000;
    entry.blocked = true;
    entry.blockUntil = now + blockDuration;

    const retryAfter = Math.ceil(blockDuration / 1000);
    console.warn(`⛔ RATE LIMITED: ${ip} → ${config.label} | Retry-After: ${retryAfter}s`);
    return { allowed: false, limit: config.maxRequests, remaining: 0, retryAfter, ip };
  }

  // Allow — record timestamp
  entry.timestamps.push(now);
  const remaining = config.maxRequests - entry.timestamps.length;

  return { allowed: true, limit: config.maxRequests, remaining, ip };
}

/**
 * Convenience: apply rate limit and send 429 if exceeded.
 * Returns true if the request was blocked (caller should return immediately).
 *
 * Usage:
 *   if (applyRateLimit(req, res, LIMITS.EXPENSIVE)) return;
 */
export function applyRateLimit(
  req: VercelRequest,
  res: any,
  config: RateLimitConfig
): boolean {
  const result = rateLimit(req, config);

  // Always set rate limit headers
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
      retryAfter: result.retryAfter,
    });
    return true; // Blocked
  }

  return false; // Allowed
}