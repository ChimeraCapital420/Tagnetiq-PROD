// FILE: api/_lib/security.ts
// STATUS: COMPREHENSIVE SECURITY HARDENING - Multi-layer protection

import { supaAdmin } from './supaAdmin';
import type { VercelRequest } from '@vercel/node';
import { User } from '@supabase/supabase-js';
import crypto from 'crypto';

// SECURITY: Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // per window

// SECURITY: Request signature validation for critical endpoints
const CRITICAL_ENDPOINTS = ['/api/vault/items', '/api/arena/challenge', '/api/vault/export-pdf'];

interface SecurityOptions {
  requireMFA?: boolean;
  requireAdmin?: boolean;
  rateLimit?: { maxRequests: number; windowMs: number };
  requireSignature?: boolean;
}

/**
 * Verifies the JWT from the request and fetches the user.
 * Enhanced with comprehensive security checks.
 */
export async function verifyUser(req: VercelRequest, options: SecurityOptions = {}): Promise<User> {
  // SECURITY: Extract and validate token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication error: Invalid authorization header format.');
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 10) {
    throw new Error('Authentication error: Invalid token format.');
  }

  // SECURITY: Rate limiting per user/IP
  await enforceRateLimit(req, options.rateLimit);

  // SECURITY: Request signature validation for critical operations
  if (options.requireSignature && isCriticalEndpoint(req.url || '')) {
    await validateRequestSignature(req, token);
  }

  // SECURITY: Validate JWT and get user
  const { data: { user }, error } = await supaAdmin.auth.getUser(token);
  if (error || !user) {
    // SECURITY: Log failed authentication attempts
    console.warn(`Authentication failed from IP: ${getClientIP(req)}, URL: ${req.url}`, {
      error: error?.message,
      timestamp: new Date().toISOString()
    });
    throw new Error('Authentication error: Invalid or expired token.');
  }

  // SECURITY: Check if user account is active
  const { data: profile, error: profileError } = await supaAdmin
    .from('profiles')
    .select('id, mfa_enrolled, role, account_status, last_login, failed_login_attempts')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Authentication error: User profile not found.');
  }

  // SECURITY: Account status checks
  if (profile.account_status === 'suspended') {
    throw new Error('Authentication error: Account suspended.');
  }

  if (profile.account_status === 'locked') {
    throw new Error('Authentication error: Account locked due to security concerns.');
  }

  // SECURITY: Failed login attempt monitoring
  if (profile.failed_login_attempts >= 5) {
    const lockDuration = Math.min(Math.pow(2, profile.failed_login_attempts - 5), 3600); // Exponential backoff, max 1 hour
    await supaAdmin
      .from('profiles')
      .update({ account_status: 'temporarily_locked', locked_until: new Date(Date.now() + lockDuration * 1000) })
      .eq('id', user.id);
    throw new Error('Authentication error: Too many failed attempts. Account temporarily locked.');
  }

  // SECURITY: MFA requirement check
  if (options.requireMFA && !profile.mfa_enrolled) {
    throw new Error('Authentication error: Multi-factor authentication required for this operation.');
  }

  // SECURITY: Admin requirement check
  if (options.requireAdmin && profile.role !== 'admin') {
    throw new Error('Authorization error: Administrator privileges required.');
  }

  // SECURITY: Update last successful login
  supaAdmin
    .from('profiles')
    .update({ 
      last_login: new Date().toISOString(),
      failed_login_attempts: 0 // Reset on successful auth
    })
    .eq('id', user.id)
    .then(); // Fire and forget

  return user;
}

/**
 * Enhanced admin verification with additional security layers
 */
export async function verifyUserIsAdmin(req: VercelRequest): Promise<User> {
  return verifyUser(req, { 
    requireAdmin: true, 
    requireMFA: true,
    requireSignature: true,
    rateLimit: { maxRequests: 20, windowMs: RATE_LIMIT_WINDOW } // Stricter rate limiting
  });
}

/**
 * SECURITY: Rate limiting enforcement
 */
async function enforceRateLimit(req: VercelRequest, customLimit?: { maxRequests: number; windowMs: number }) {
  const clientIP = getClientIP(req);
  const key = `rate_limit:${clientIP}`;
  const now = Date.now();
  
  const limit = customLimit || { maxRequests: RATE_LIMIT_MAX_REQUESTS, windowMs: RATE_LIMIT_WINDOW };
  
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + limit.windowMs });
    return;
  }
  
  if (current.count >= limit.maxRequests) {
    // SECURITY: Log rate limit violations
    console.warn(`Rate limit exceeded for IP: ${clientIP}, URL: ${req.url}`, {
      attempts: current.count,
      timestamp: new Date().toISOString()
    });
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  
  current.count++;
  rateLimitStore.set(key, current);
}

/**
 * SECURITY: Request signature validation for critical endpoints
 */
async function validateRequestSignature(req: VercelRequest, token: string) {
  const signature = req.headers['x-request-signature'] as string;
  if (!signature) {
    throw new Error('Security error: Request signature required for this operation.');
  }

  const timestamp = req.headers['x-timestamp'] as string;
  if (!timestamp || Math.abs(Date.now() - parseInt(timestamp)) > 300000) { // 5 minute window
    throw new Error('Security error: Request timestamp invalid or expired.');
  }

  const payload = JSON.stringify(req.body) + timestamp + token;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.REQUEST_SIGNATURE_SECRET || 'fallback-secret')
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Security error: Invalid request signature.');
  }
}

/**
 * SECURITY: Get real client IP address
 */
function getClientIP(req: VercelRequest): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
         (req.headers['x-real-ip'] as string) ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * SECURITY: Check if endpoint requires enhanced security
 */
function isCriticalEndpoint(url: string): boolean {
  return CRITICAL_ENDPOINTS.some(endpoint => url.includes(endpoint));
}

/**
 * SECURITY: Audit log function for sensitive operations
 */
export async function auditLog(
  userId: string, 
  action: string, 
  resource: string, 
  details?: Record<string, any>
) {
  try {
    await supaAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        resource,
        details: details || {},
        timestamp: new Date().toISOString(),
        ip_address: details?.ip_address || 'unknown'
      });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    // Don't throw - logging failures shouldn't break the main operation
  }
}

/**
 * SECURITY: Input sanitization and validation
 */
export function sanitizeInput(input: any, type: 'string' | 'number' | 'email' | 'url'): any {
  if (input === null || input === undefined) return input;

  switch (type) {
    case 'string':
      return String(input).trim().substring(0, 10000); // Prevent extremely long strings
    case 'number':
      const num = Number(input);
      return isNaN(num) ? 0 : Math.max(-999999999, Math.min(999999999, num));
    case 'email':
      const email = String(input).toLowerCase().trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
    case 'url':
      const url = String(input).trim();
      try {
        new URL(url);
        return url.substring(0, 2000);
      } catch {
        return '';
      }
    default:
      return input;
  }
}

/**
 * SECURITY: Clean up rate limit store periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/* 
REQUIRED DATABASE SCHEMA UPDATES:

-- Add audit logging table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Add security fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Create indexes for security queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
*/